/// <reference types="cypress" />

// spec/C3-E2E.pdf "Kompletan radni dan na berzi" — one big sequential
// scenario, walked DEO 1 through DEO 12. Has to run as a single
// `it` because every section depends on the state the previous one
// left behind (limit set → order placed → fills → portfolio shows
// up → sell flow → tax → reset).
//
// Lives against the seeded c3 fixtures: aktuar (200k RSD daily limit),
// supervizor, MSFT @ $450.10, XNYS exchange, bank's per-currency
// forex_book accounts.

const SUPERVISOR_EMAIL = 'supervizor@banka.local'
const SUPERVISOR_PASSWORD = 'Supervizor123!'
const ADMIN_EMAIL = 'admin@banka.local'
const ADMIN_PASSWORD = 'Admin123!'
const AGENT_EMAIL = 'aktuar@banka.local'
const AGENT_PASSWORD = 'Aktuar123!'
const TICKER = 'MSFT'
const BUY_QTY = 10
const SELL_QTY = 5

// Pinned MSFT prices. Override before BUY so the fill price is
// deterministic (= ask), regardless of any live AV refresh between
// resetBackend and the order placement. Override again before SELL
// so the SELL realizes a gain.
const BUY_PRICE = 450.1
const BUY_ASK = 450.1
const BUY_BID = 449.9
const SELL_PRICE = 470
const SELL_BID = 469.5
const SELL_ASK = 470.5

// Spec p.55-56: market commission cap is $7 USD; the order-total cap
// applies once per order and is prorated across fills.
const USD_COMMISSION_CAP = 7

// Sentinels — mirrors services/bank/internal/domain/domain.go.
const FOREX_BOOK_OWNER_ID = '00000000-0000-0000-0000-000000000020'
const STATE_TAX_OWNER_ID = '00000000-0000-0000-0000-000000000010'

function gatewayLogin(email: string, password: string): Cypress.Chainable<string> {
  return cy
    .request('POST', '/api/v1/auth/login', { email, password })
    .then((r) => r.body.accessToken as string)
}

// Bank's USD trading-book balance. Admin-only path (ListAccounts
// excludes forex_book unless the caller passes kind explicitly).
function forexBookUSDBalance(token: string): Cypress.Chainable<number> {
  return cy
    .request({
      url: `/api/v1/accounts?ownerClientId=${FOREX_BOOK_OWNER_ID}&kind=ACCOUNT_KIND_FOREX_BOOK`,
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => {
      const accounts = (r.body.accounts ?? []) as { currency?: string; balance?: string }[]
      const usd = accounts.find((a) => a.currency === 'CURRENCY_USD')
      expect(usd, 'forex_book USD account exists').to.not.equal(undefined)
      return Number(usd!.balance ?? '0')
    })
}

// State-tax destination account. Admin sees it via kind=state_tax.
function stateTaxRSDBalance(token: string): Cypress.Chainable<number> {
  return cy
    .request({
      url: `/api/v1/accounts?ownerClientId=${STATE_TAX_OWNER_ID}&kind=ACCOUNT_KIND_STATE_TAX`,
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => {
      const accounts = (r.body.accounts ?? []) as { currency?: string; balance?: string }[]
      const rsd = accounts.find((a) => a.currency === 'CURRENCY_RSD')
      expect(rsd, 'state-tax RSD account exists').to.not.equal(undefined)
      return Number(rsd!.balance ?? '0')
    })
}

// /v1/auth/me → employee.id for the currently-logged-in employee.
function meEmployeeID(token: string): Cypress.Chainable<string> {
  return cy
    .request({
      url: '/api/v1/auth/me',
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => r.body.employee.id as string)
}

// Admin upsertListing — sets price/ask/bid on (securityId, exchangeMic).
// Mirrors the FE PriceOverrideDialog so the test doesn't need the UI
// flow when it's just stage-setting between DEOs.
function pinListingPrice(
  token: string,
  securityId: string,
  exchangeMic: string,
  price: number,
  ask: number,
  bid: number,
) {
  return cy.request({
    method: 'PUT',
    url: '/api/v1/listings',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      securityId,
      exchangeMic,
      price: String(price),
      ask: String(ask),
      bid: String(bid),
    },
  })
}

function waitOrderDone(orderId: string, token: string) {
  // Poll the order until isDone=true or status=cancelled. The worker
  // ticks every EXECUTION_TICK_INTERVAL (default 10s); MSFT's volume
  // is thick enough that the cadence cap clamps to ~1 ms, so each
  // tick fires at least one fill. 10 shares typically resolves in
  // 3-6 ticks.
  function poll(remaining: number) {
    if (remaining <= 0) {
      throw new Error(`order ${orderId} did not complete after polling`)
    }
    return cy
      .request({
        url: `/api/v1/orders/${orderId}`,
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r) => {
        if (r.body.isDone === true) return
        cy.wait(5000)
        poll(remaining - 1)
      })
  }
  poll(36) // 36 × 5s = 180s ceiling
}

describe('Celina 3 (live) — kompletan radni dan na berzi (C3-E2E.pdf)', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('supervisor sets limit, agent trades MSFT round-trip, tax runs, limit resets', () => {
    // ───────────── Stage 0: pre-flight state capture ─────────────
    // Lock the live fixture's MSFT ask/bid so the BUY fill price is
    // deterministic. AV refreshes (when wired) would otherwise drift
    // the seeded $450.10 ± a few cents between resetBackend and the
    // first fill, which then propagates into cost_basis_amt and
    // proceeds_amt and breaks the numeric invariants below.
    //
    // Also grabs the agent's employeeId (for later tax/realized
    // lookups) and the bank's USD trading-book balance + state-tax
    // RSD balance (the two ledger accounts that have to converge by
    // end-of-day for the agent's round-trip + tax run to be
    // self-consistent).
    gatewayLogin(ADMIN_EMAIL, ADMIN_PASSWORD).then((adminTok) => {
      cy.wrap(adminTok).as('adminTok')
      cy.request({
        url: '/api/v1/securities?search=MSFT&type=SECURITY_TYPE_STOCK',
        headers: { Authorization: `Bearer ${adminTok}` },
      }).then((r) => {
        const msftId = r.body.items[0].security.id as string
        cy.wrap(msftId).as('securityId')
        pinListingPrice(adminTok, msftId, 'XNYS', BUY_PRICE, BUY_ASK, BUY_BID)
      })
      forexBookUSDBalance(adminTok).then((b) => cy.wrap(b).as('usdBookBefore'))
      stateTaxRSDBalance(adminTok).then((b) => cy.wrap(b).as('stateTaxBefore'))
    })
    gatewayLogin(AGENT_EMAIL, AGENT_PASSWORD).then((agentTok) =>
      meEmployeeID(agentTok).then((id) => cy.wrap(id).as('agentId')),
    )

    // ───────────── DEO 1 ─────────────
    // Supervizor podesava agenta — 200k RSD limit (already the seed
    // default; we explicitly resave it so the audit log assertion has
    // something to look at).
    cy.loginAsSupervisor()
    cy.visit('/portal/aktuari')
    cy.contains('h1', 'Aktuari', { timeout: 15000 }).should('be.visible')
    cy.contains('tr', 'aktuar@banka.local', { timeout: 10000 }).click()
    cy.url({ timeout: 10000 }).should('match', /\/portal\/aktuari\/[0-9a-f-]+/)

    cy.get('[data-cy="daily-limit-input"]', { timeout: 10000 })
      .invoke('val')
      .then((v) => expect(Number(v)).to.eq(200000))
    cy.get('[data-cy="daily-limit-input"]').clear().type('200000')
    cy.get('[data-cy="save-limit"]').click()

    cy.get('[data-cy="used-limit-display"]', { timeout: 10000 }).should('contain', '0,00')

    // ───────────── DEO 2 ─────────────
    // Agent loguje, otvara katalog, pretrazuje MSFT, otvara detalj.
    cy.clearCookies()
    cy.window().then((w) => w.sessionStorage.clear())
    cy.loginAsAgent()
    cy.visit('/portal/trgovina')
    cy.contains('h1', 'Trgovina', { timeout: 15000 }).should('be.visible')

    // Agent (aktuar) sees all four security types in tabs.
    cy.get('[data-cy="tab-SECURITY_TYPE_STOCK"]').should('be.visible')
    cy.get('[data-cy="tab-SECURITY_TYPE_FUTURE"]').should('be.visible')
    cy.get('[data-cy="tab-SECURITY_TYPE_FOREX"]').should('be.visible')
    cy.get('[data-cy="tab-SECURITY_TYPE_OPTION"]').should('be.visible')

    cy.get('[data-cy="filter-search"]').clear().type(TICKER)
    cy.contains('tr', TICKER, { timeout: 10000 }).click()
    cy.url({ timeout: 10000 }).should('match', /\/portal\/trgovina\/[0-9a-f-]+/)
    cy.url().then((url) => {
      const securityId = url.match(/\/portal\/trgovina\/([0-9a-f-]+)/)![1]
      cy.wrap(securityId).as('securityId')
    })

    // ───────────── DEO 3 ─────────────
    // Agent kreira BUY Market order za 10 MSFT — qty only, no
    // limit/stop, source = bankin USD account.
    cy.get('#order-form').within(() => {
      cy.get('#of-qty').clear().type(String(BUY_QTY))
      cy.get('#of-acct').find('option').contains('USD').then((opt) => {
        cy.get('#of-acct').select(opt.attr('value') as string)
      })
      // Order type derived from blank limit/stop = Market — confirmed
      // by the Pregled showing "Tržišni".
      cy.get('[data-cy="needs-approval"]', { timeout: 8000 })
        .should('be.visible')
        .and('contain', 'odobrenje')
      cy.get('[data-cy="order-submit"]').click()
    })

    // Confirm-modal previews qty / type / approx total + commission,
    // then submit (DEO 3 spec bullets: "broj hartija, tip ordera,
    // pribliznoj ukupnoj ceni" + "iznos provizije ...").
    cy.get('[data-cy="order-confirm-dialog"]').should('be.visible')
    cy.contains('[data-cy="order-confirm-dialog"]', 'Tržišni').should('be.visible')
    cy.contains('[data-cy="order-confirm-dialog"]', String(BUY_QTY)).should('be.visible')
    cy.contains('[data-cy="order-confirm-dialog"]', 'Approx. vrednost').should('be.visible')
    cy.contains('[data-cy="order-confirm-dialog"]', 'Provizija').should('be.visible')
    cy.contains('[data-cy="order-confirm-dialog"]', 'Ukupno').should('be.visible')
    cy.get('[data-cy="order-confirm-submit"]').click()

    // ───────────── DEO 4 ─────────────
    // Order ide na pending zbog limita; supervizor odobrava.
    cy.visit('/portal/trgovina/nalozi')
    cy.contains('h1', 'Pregled naloga', { timeout: 15000 }).should('be.visible')
    cy.get('[data-cy="filter-status"]').select('pending')
    cy.contains('tr', TICKER, { timeout: 15000 }).should('contain', 'Na čekanju')

    cy.clearCookies()
    cy.window().then((w) => w.sessionStorage.clear())
    cy.loginAsSupervisor()
    cy.visit('/portal/trgovina/nalozi/cekajuci')
    cy.contains('h1', 'Pregled naloga', { timeout: 15000 }).should('be.visible')

    // Spec p.57 column list: agent, order type, asset, quantity,
    // contract size, price per unit, direction, remaining portions,
    // status. The FE adds a leading "Kreirano" and a trailing actions
    // cell — assert the spec-required ones are all present.
    const expectedOrderListCols = [
      'Agent',
      'Tip',
      'Hartija',
      'Količina',
      'Veličina ugovora',
      'Cena/jed.',
      'Smer',
      'Preostalo',
      'Status',
    ]
    cy.get('table thead tr th').then(($ths) => {
      const got = $ths.toArray().map((th) => th.textContent?.trim() ?? '')
      expectedOrderListCols.forEach((col) =>
        expect(got, `order-list column "${col}"`).to.include(col),
      )
    })

    // Capture the order id via API rather than DOM-scraping (the row
    // doesn't render the UUID; the Approve button on the row is the
    // entry point). The supervisor sees every pending row.
    gatewayLogin(SUPERVISOR_EMAIL, SUPERVISOR_PASSWORD).then((tok) => {
      cy.wrap(tok).as('supervisorTok')
      cy.request({
        url: '/api/v1/orders?status=pending',
        headers: { Authorization: `Bearer ${tok}` },
      }).then((r) => {
        const buyOrderId = r.body.orders[0].id as string
        cy.wrap(buyOrderId).as('buyOrderId')
      })

      cy.contains('tr', TICKER, { timeout: 15000 })
        .within(() => cy.get('[data-cy="approve-order"]').click())

      // "Approved By" populated post-approval (spec p.57). Order
      // detail's Odobrio row picks up the supervisor's employee UUID.
      cy.get<string>('@buyOrderId').then((id) => {
        cy.request({
          url: `/api/v1/orders/${id}`,
          headers: { Authorization: `Bearer ${tok}` },
        }).then((r) => {
          // approvedBy is a UUID-shaped non-empty string.
          expect(r.body.approvedBy, 'approvedBy populated post-approval').to.match(
            /^[0-9a-f-]{36}$/,
          )
        })
        cy.visit(`/portal/trgovina/nalozi/${id}`)
        cy.contains('Odobrio', { timeout: 10000 })
          .parents('div')
          .first()
          .invoke('text')
          .then((t) => expect(t).to.match(/[0-9a-f-]{36}/))
      })

      // ───────────── DEO 5 ─────────────
      // Market order izvrsava u delovima. Poll via API — the worker
      // ticks every EXECUTION_TICK_INTERVAL (10s default); MSFT's
      // thick volume keeps cadenceMaxInterval at the 1ms floor, so
      // each tick fires a fill.
      cy.get<string>('@buyOrderId').then((id) => {
        waitOrderDone(id, tok)
        cy.request({
          url: `/api/v1/orders/${id}`,
          headers: { Authorization: `Bearer ${tok}` },
        }).then((doneR) => {
          expect(doneR.body.isDone).to.eq(true)
          expect(Number(doneR.body.remainingQuantity ?? 0)).to.eq(0)
        })
      })

      // Spec p.55: BUY commission for Market = min(14% × notional, $7);
      // 14% × $4501 ≫ $7 so commission caps at $7. Bank's USD
      // trading-book debit = notional + commission = $4508.
      cy.get<string>('@adminTok').then((adminTok) => {
        cy.get<number>('@usdBookBefore').then((before) => {
          forexBookUSDBalance(adminTok).then((afterBuy) => {
            const expected = before - (BUY_QTY * BUY_ASK + USD_COMMISSION_CAP)
            expect(
              Math.abs(afterBuy - expected),
              `forex_book USD delta after BUY: expected ≈ ${expected}, got ${afterBuy}`,
            ).to.be.lessThan(0.01)
          })
        })
      })
    })

    // ───────────── DEO 6 ─────────────
    // Hartije se pojavljuju u portfoliju agenta (10 MSFT @ $450.10).
    cy.clearCookies()
    cy.window().then((w) => w.sessionStorage.clear())
    cy.loginAsAgent()
    cy.visit('/portal/portfolio')
    cy.contains('h1', /Portfolio/, { timeout: 15000 }).should('be.visible')

    // Spec p.61 column list. Anchor on the table that holds the MSFT
    // row (stocks section) rather than DOM-walking from a heading —
    // the latter is flaky against the shadcn Card composition.
    const expectedPortfolioCols = ['Ticker', 'Količina', 'Avg cena', 'Nerealizovan P&L', 'Poslednja izmena']
    cy.contains('tr', TICKER, { timeout: 30000 })
      .parents('table')
      .find('thead tr th')
      .then(($ths) => {
        const got = $ths.toArray().map((th) => th.textContent?.trim() ?? '')
        expectedPortfolioCols.forEach((col) =>
          expect(got, `portfolio column "${col}"`).to.include(col),
        )
      })

    cy.contains('tr', TICKER, { timeout: 30000 })
      .should('be.visible')
      .within(() => {
        // Količina = 10.
        cy.get('td').eq(1).should('contain', String(BUY_QTY))
        // Avg cena = 450,10 — locked by Stage 0's BUY price pin.
        cy.get('td').eq(2).should('contain', '450,10')
      })

    // ───────────── DEO 7 (set-up) ─────────────
    // Bump the listing price so the SELL realizes a gain. The
    // override dialog is admin-only ("Izmeni cenu"), so use the
    // bootstrap admin (also part of the supervisor role bundle).
    cy.clearCookies()
    cy.window().then((w) => w.sessionStorage.clear())
    cy.loginAsAdmin()
    cy.get<string>('@securityId').then((securityId) => {
      cy.visit(`/portal/trgovina/${securityId}`)
      cy.contains(TICKER, { timeout: 15000 }).should('be.visible')
      cy.get('[data-cy="open-price-override"]', { timeout: 10000 }).click()
      cy.get('#po-price').clear().type(String(SELL_PRICE))
      cy.get('#po-ask').clear().type(String(SELL_ASK))
      cy.get('#po-bid').clear().type(String(SELL_BID))
      cy.contains('button', 'Sačuvaj').click()
      cy.get('#po-price', { timeout: 10000 }).should('not.exist')
    })

    // Agent prodaje 5 MSFT iz portfolija. The portal portfolio's
    // stock rows expose a "Prodaj" deeplink (FE add for DEO 7 +
    // C3-tests S36) which lands on the listing detail with
    // direction=sell + qty pre-filled.
    cy.clearCookies()
    cy.window().then((w) => w.sessionStorage.clear())
    cy.loginAsAgent()
    cy.visit('/portal/portfolio')
    cy.contains('tr', TICKER, { timeout: 15000 })
      .find('[data-cy^="sell-deeplink-"]')
      .click()
    cy.url({ timeout: 10000 }).should('include', '/portal/trgovina/')
    cy.url().should('include', 'direction=sell')
    cy.url().should('include', `qty=${BUY_QTY}`)

    cy.get('#order-form').within(() => {
      cy.get('#of-qty').clear().type(String(SELL_QTY))
      // Account picker keeps the USD bank account selected (sell
      // restricts to listing currency).
      cy.get('#of-acct').find('option').contains('USD').then((opt) => {
        cy.get('#of-acct').select(opt.attr('value') as string)
      })
      cy.get('[data-cy="order-submit"]').click()
    })
    cy.get('[data-cy="order-confirm-submit"]').click()

    // ───────────── DEO 8 ─────────────
    // Supervizor odobrava SELL order. The SELL is over the per-day
    // RSD-equivalent cap too (used_limit + 5×$470 ≈ $2350 ≈ 237k
    // RSD), so it lands pending exactly like the BUY did.
    cy.visit('/portal/trgovina/nalozi')
    cy.contains('h1', 'Pregled naloga', { timeout: 15000 }).should('be.visible')

    cy.clearCookies()
    cy.window().then((w) => w.sessionStorage.clear())
    cy.loginAsSupervisor()
    cy.visit('/portal/trgovina/nalozi/cekajuci')

    gatewayLogin(SUPERVISOR_EMAIL, SUPERVISOR_PASSWORD).then((tok) => {
      cy.request({
        url: '/api/v1/orders?status=pending',
        headers: { Authorization: `Bearer ${tok}` },
      }).then((r) => {
        const sellOrderId = r.body.orders[0].id as string
        cy.wrap(sellOrderId).as('sellOrderId')
      })

      cy.contains('tr', TICKER, { timeout: 15000 })
        .within(() => cy.get('[data-cy="approve-order"]').click())

      cy.get<string>('@sellOrderId').then((id) => {
        waitOrderDone(id, tok)
      })
    })

    // Bank's USD trading-book net delta after the round-trip:
    //   BUY:  -(10 × $450.10 + $7) = -$4508
    //   SELL: +( 5 × $469.50 - $7) = +$2340.50
    //   net = -$2167.50
    // SELL fills at bid (execution.go:250); the override pinned bid
    // to $469.50.
    cy.get<string>('@adminTok').then((adminTok) => {
      cy.get<number>('@usdBookBefore').then((before) => {
        forexBookUSDBalance(adminTok).then((afterSell) => {
          const expected = before - (BUY_QTY * BUY_ASK + USD_COMMISSION_CAP) + (SELL_QTY * SELL_BID - USD_COMMISSION_CAP)
          expect(
            Math.abs(afterSell - expected),
            `forex_book USD net after round-trip: expected ≈ ${expected}, got ${afterSell}`,
          ).to.be.lessThan(0.01)
        })
      })
    })

    // Realized-gain rows for the agent's SELL. The SELL of 5 shares
    // partial-fills into 1..5 sub-quantities depending on the random
    // cadence chunker; each fill writes its own realized_gain row.
    // Aggregates are what's deterministic:
    //   sum(quantity)        = SELL_QTY                          = 5
    //   sum(cost_basis_amt)  = SELL_QTY × BUY_ASK                = $2250.50
    //   sum(proceeds_amt)    = SELL_QTY × SELL_BID               = $2347.50
    //   sum(profit_native)   = SELL_QTY × (SELL_BID - BUY_ASK)   = $97.00
    // Profit_rsd depends on the live USD→RSD ASK at fill time so we
    // don't pin that; DEO 10 cross-checks it via the state-tax delta.
    cy.get<string>('@supervisorTok').then((supTok) => {
      cy.get<string>('@agentId').then((agentId) => {
        // Filter by `from` to ignore the seed's Profit-Banke leaderboard
        // fixture (qty 20 + 10 + 5 = 35, realized_at ~430 days ago).
        // Without this clip, sum(quantity) = 35 (seeded) + 5 (test SELL)
        // = 40 instead of the expected SELL_QTY=5. Anchor 1h back to
        // safely include this run's SELL while excluding the historical
        // fixture (proto Timestamp needs T-suffixed UTC ISO).
        const from = new Date(Date.now() - 60 * 60 * 1000).toISOString()
        cy.request({
          url: `/api/v1/tax/realized?userId=${agentId}&userKind=USER_KIND_EMPLOYEE&from=${encodeURIComponent(from)}`,
          headers: { Authorization: `Bearer ${supTok}` },
        }).then((r) => {
          const rows = (r.body.rows ?? []) as {
            quantity?: number
            costBasisAmt?: string
            proceedsAmt?: string
            profitNative?: string
          }[]
          expect(rows.length, 'at least one realized-gain row').to.be.greaterThan(0)
          const sumQty = rows.reduce((s, x) => s + (x.quantity ?? 0), 0)
          const sumCost = rows.reduce((s, x) => s + Number(x.costBasisAmt ?? '0'), 0)
          const sumProceeds = rows.reduce((s, x) => s + Number(x.proceedsAmt ?? '0'), 0)
          const sumProfit = rows.reduce((s, x) => s + Number(x.profitNative ?? '0'), 0)
          expect(sumQty, 'realized rows sum to SELL_QTY').to.equal(SELL_QTY)
          expect(sumCost, 'cost basis aggregate').to.be.closeTo(SELL_QTY * BUY_ASK, 0.01)
          expect(sumProceeds, 'proceeds aggregate').to.be.closeTo(SELL_QTY * SELL_BID, 0.01)
          expect(sumProfit, 'profit_native aggregate').to.be.closeTo(SELL_QTY * (SELL_BID - BUY_ASK), 0.01)
        })
      })
    })

    // ───────────── DEO 9 ─────────────
    // Agent proverava portfolio nakon prodaje — 5 MSFT preostalo,
    // ukupan profit > 0 (realizovani dobitak na 5 prodatih).
    cy.clearCookies()
    cy.window().then((w) => w.sessionStorage.clear())
    cy.loginAsAgent()
    cy.visit('/portal/portfolio')
    cy.contains('h1', /Portfolio/, { timeout: 15000 }).should('be.visible')
    cy.contains('tr', TICKER, { timeout: 30000 })
      .should('be.visible')
      .within(() => {
        cy.get('td').eq(1).should('contain', String(BUY_QTY - SELL_QTY))
      })

    // ───────────── DEO 10 ─────────────
    // Supervizor pregleda porez tracking i pokrece obracun za agenta.
    // The seed plants pre-existing unpaid realized_gains on Test
    // Klijent so a global run would tax both users; scoping the run
    // to the agent's detail page taxes only Marko, which is the
    // scenario DEO 10 describes.
    cy.clearCookies()
    cy.window().then((w) => w.sessionStorage.clear())
    cy.loginAsSupervisor()
    cy.visit('/portal/porez')
    cy.contains('h1', 'Porez na kapitalni dobitak', { timeout: 15000 }).should('be.visible')

    // The agent's row appears with a positive RSD-denominated
    // outstanding balance (5 × $19.80 ≈ $99 ≈ 9974 RSD; tax = 15%
    // ≈ 1496 RSD). Display labels the agent by full name.
    cy.contains('Marko Marković', { timeout: 15000 }).should('be.visible').click()
    cy.url({ timeout: 10000 }).should('match', /\/portal\/porez\/[0-9a-f-]+/)
    cy.contains('h1', 'Marko Marković', { timeout: 10000 }).should('be.visible')

    // Before the run: standings show non-zero unpaid for this user;
    // capture for cross-check against the post-run state-tax delta.
    cy.get('[data-cy="standings-unpaid"]', { timeout: 10000 })
      .invoke('text')
      .then((t) => {
        // FE money format: "1.234,56" → Number 1234.56
        const n = Number(t.replace(/\./g, '').replace(',', '.'))
        expect(n).to.be.greaterThan(0)
        cy.wrap(n).as('agentUnpaidBefore')
      })

    cy.get('[data-cy="run-tax-user"]').click()
    cy.get('[data-cy="confirm-run-tax-user"]').click()
    cy.get('[data-cy="run-tax-user-result"]', { timeout: 15000 })
      .should('be.visible')
      .and('contain', 'Obračun završen')
      .and('contain', '1 korisnika')

    // Post-run: standings reload (tax.all invalidation); unpaid → 0.
    cy.get('[data-cy="standings-unpaid"]', { timeout: 10000 })
      .should('contain', '0,00')

    // State-tax account credited by exactly the agent's unpaid amount
    // — the cross-check that the SELL's realized_gain row, the FE's
    // standings cell, and the bank's ledger all agree. Allow ±0.01 to
    // absorb rendering rounding.
    cy.get<string>('@adminTok').then((adminTok) => {
      cy.get<number>('@stateTaxBefore').then((before) => {
        cy.get<number>('@agentUnpaidBefore').then((agentUnpaid) => {
          stateTaxRSDBalance(adminTok).then((after) => {
            const delta = after - before
            expect(
              Math.abs(delta - agentUnpaid),
              `state-tax delta = agent unpaid (expected ${agentUnpaid}, got ${delta})`,
            ).to.be.lessThan(0.02)
          })
        })
      })
    })

    // ───────────── DEO 11 ─────────────
    // Verifikacija krajnjeg stanja: portfolio = 5 MSFT; agent's
    // unpaid tax for the month is 0 on the list page; agent's paid-
    // YTD is now > 0 ("otplacen porez za tekucu godinu je azuriran");
    // Test Klijent's seed-planted unpaid debt is still positive
    // (proves the scoping worked).
    cy.visit('/portal/porez')
    cy.contains('Marko Marković', { timeout: 15000 })
      .parents('tr')
      .within(() => {
        cy.get('[data-cy="cell-unpaid"]').should('contain', '0,00')
        cy.get('[data-cy="cell-paid-ytd"]')
          .invoke('text')
          .then((t) => {
            const n = Number(t.replace(/\./g, '').replace(',', '.'))
            expect(n, 'agent paid-YTD > 0 post-run').to.be.greaterThan(0)
          })
      })
    cy.contains('Test Klijent', { timeout: 10000 })
      .parents('tr')
      .within(() => {
        cy.get('[data-cy="cell-unpaid"]')
          .invoke('text')
          .then((t) => {
            const n = Number(t.replace(/\./g, '').replace(',', '.'))
            expect(n, "client's seed unpaid debt untouched").to.be.greaterThan(0)
          })
      })

    // ───────────── DEO 12 ─────────────
    // Automatski reset usedLimit-a — call the cron RPC directly
    // (cypress can't wait until 23:59 Europe/Belgrade). Pre-state:
    // the agent has used limit > 0 from today's BUY+SELL. Post:
    // used = 0, limit unchanged at 200000.
    gatewayLogin(SUPERVISOR_EMAIL, SUPERVISOR_PASSWORD).then((tok) => {
      // The seed plants exactly one actuary agent (aktuar@banka.local),
      // so the type-filtered list returns exactly that row.
      cy.request({
        url: '/api/v1/actuaries?type=ACTUARY_TYPE_AGENT',
        headers: { Authorization: `Bearer ${tok}` },
      }).then((listResp) => {
        const agents = listResp.body.actuaries ?? []
        expect(agents).to.have.length(1)
        const agentId = agents[0].employeeId as string

        // Pre-reset: usedLimit > 0 (BUY auto-charged on supervisor
        // approval; SELL auto-charged on approval).
        cy.request({
          url: `/api/v1/actuaries/${agentId}`,
          headers: { Authorization: `Bearer ${tok}` },
        }).then((before) => {
          expect(Number(before.body.usedLimit ?? '0')).to.be.greaterThan(0)
        })

        cy.request({
          method: 'POST',
          url: '/api/v1/actuaries/reset-job',
          headers: { Authorization: `Bearer ${tok}` },
          body: {},
        }).then((r) => {
          expect(r.status).to.be.oneOf([200, 204])
          expect(Number(r.body.affected ?? 0)).to.be.greaterThan(0)
        })

        cy.request({
          url: `/api/v1/actuaries/${agentId}`,
          headers: { Authorization: `Bearer ${tok}` },
        }).then((after) => {
          expect(Number(after.body.usedLimit ?? '0')).to.eq(0)
          expect(Number(after.body.dailyLimit ?? '0')).to.eq(200000)
        })
      })
    })
  })
})
