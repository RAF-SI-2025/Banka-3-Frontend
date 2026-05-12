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
const TICKER = 'MSFT'
const BUY_QTY = 10
const SELL_QTY = 5
// Price after override (post-buy bump) so the SELL realizes a gain.
const SELL_PRICE = 470
const SELL_BID = 469.5
const SELL_ASK = 470.5

function gatewayLogin(email: string, password: string): Cypress.Chainable<string> {
  return cy
    .request('POST', '/api/v1/auth/login', { email, password })
    .then((r) => r.body.accessToken as string)
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

    // Confirm-modal previews qty / type / approx total, then submit.
    cy.get('[data-cy="order-confirm-dialog"]').should('be.visible')
    cy.contains('[data-cy="order-confirm-dialog"]', 'Tržišni').should('be.visible')
    cy.contains('[data-cy="order-confirm-dialog"]', String(BUY_QTY)).should('be.visible')
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

    // Capture the order id via API rather than DOM-scraping (the row
    // doesn't render the UUID; the Approve button on the row is the
    // entry point). The supervisor sees every pending row.
    gatewayLogin(SUPERVISOR_EMAIL, SUPERVISOR_PASSWORD).then((tok) => {
      cy.request({
        url: '/api/v1/orders?status=pending',
        headers: { Authorization: `Bearer ${tok}` },
      }).then((r) => {
        const buyOrderId = r.body.orders[0].id as string
        cy.wrap(buyOrderId).as('buyOrderId')
      })

      cy.contains('tr', TICKER, { timeout: 15000 })
        .within(() => cy.get('[data-cy="approve-order"]').click())

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
    })

    // ───────────── DEO 6 ─────────────
    // Hartije se pojavljuju u portfoliju agenta (10 MSFT @ ~$450).
    cy.clearCookies()
    cy.window().then((w) => w.sessionStorage.clear())
    cy.loginAsAgent()
    cy.visit('/portal/portfolio')
    cy.contains('h1', /Portfolio/, { timeout: 15000 }).should('be.visible')
    cy.contains('tr', TICKER, { timeout: 30000 })
      .should('be.visible')
      .within(() => {
        cy.get('td').eq(1).should('contain', String(BUY_QTY))
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

    // Before the run: standings show non-zero unpaid for this user.
    cy.get('[data-cy="standings-unpaid"]', { timeout: 10000 })
      .invoke('text')
      .then((t) => {
        // FE money format: "1.234,56" → Number 1234.56
        const n = Number(t.replace(/\./g, '').replace(',', '.'))
        expect(n).to.be.greaterThan(0)
      })

    cy.get('[data-cy="run-tax-user"]').click()
    cy.get('[data-cy="confirm-run-tax-user"]').click()
    cy.get('[data-cy="run-tax-user-result"]', { timeout: 15000 })
      .should('be.visible')
      .and('contain', 'Obračun završen')
      .and('contain', '1 korisnika')

    // After the run: standings reload via tax.all invalidation; unpaid
    // collapses to zero.
    cy.get('[data-cy="standings-unpaid"]', { timeout: 10000 })
      .should('contain', '0,00')

    // ───────────── DEO 11 ─────────────
    // Verifikacija krajnjeg stanja: portfolio = 5 MSFT; agent's
    // unpaid tax for the month is 0 on the list page; Test Klijent's
    // seed-planted unpaid debt is still positive (proves the scoping
    // worked).
    cy.visit('/portal/porez')
    cy.contains('Marko Marković', { timeout: 15000 })
      .parents('tr')
      .within(() => {
        cy.contains('0,00').should('be.visible')
      })
    cy.contains('Test Klijent', { timeout: 10000 })
      .parents('tr')
      .within(() => {
        cy.get('[data-cy="cell-unpaid"]')
          .invoke('text')
          .then((t) => {
            const n = Number(t.replace(/\./g, '').replace(',', '.'))
            expect(n).to.be.greaterThan(0)
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
