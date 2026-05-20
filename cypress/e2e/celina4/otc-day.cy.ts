/// <reference types="cypress" />

// spec/Banka2025.pdf p.79 "Komuniciraju 2 klijenta" worked example, end-
// to-end against the live stack:
//
//   Marija (= seeded klijent) puts 10 AAPL public → Luka (= seeded
//   klijent2 with a freshly-minted USD account) offers 5 @ $195 with
//   $10 premium → Marija counters at $200 → Luka accepts (verification
//   gate) → premium debited from Luka, credited to Marija → admin
//   bumps AAPL to $250 → Luka exercises (verification gate) → strike
//   leg ($200 × 5 = $1000) settles → shares + cost basis transfer →
//   seller's realized_gains row written → supervisor's runTax debits
//   15% of the seller's gain (RSD-converted) into the state-tax
//   account.
//
// Drives the FE for the spec p.69 + p.79 UI surfaces; uses the gateway
// directly for setup (klijent2 USD account, AAPL listing pin) and for
// the cross-cutting numeric invariants (bank balances, holdings,
// realized_gains, state_tax). One sequential `it` — every step
// builds on the previous one's state.

const ADMIN_EMAIL = 'admin@banka.local'
const ADMIN_PASSWORD = 'Admin123!'
const SUPERVISOR_EMAIL = 'supervizor@banka.local'
const SUPERVISOR_PASSWORD = 'Supervizor123!'
const SELLER_EMAIL = 'klijent@banka.local'
const SELLER_PASSWORD = 'Klijent123!'
const BUYER_EMAIL = 'klijent2@banka.local'
const BUYER_PASSWORD = 'Klijent123!'

const TICKER = 'AAPL'
const PUBLIC_QTY = 10
const OFFER_QTY = 5
const OFFER_PPU = 195 // buyer's opening price
const COUNTER_PPU = 200 // seller's counter — becomes the strike
const PREMIUM = 10
// klijent's seeded AAPL cost basis (seed plants 10 AAPL @ $170 weighted-
// avg). The seller's realized_gain on exercise = (strike - cost_basis) *
// qty = (200 - 170) * 5 = $150 native; profit_rsd depends on the live
// USD→RSD ASK at write time so we cross-check it via the state-tax
// delta rather than pinning a hard RSD figure.
const SELLER_COST_BASIS = 170

// AAPL listing prices. The seed lands AAPL at whatever the live AV feed
// hands back (or the fixture's pinned $190.50). Override before the
// offer so the discovery row + thread-detail "tržišna cena" rendering
// is deterministic, then bump above strike before exercise so the
// "Iskoristi" button surfaces.
const LISTING_PRICE_PRE = 190
const LISTING_ASK_PRE = 190.1
const LISTING_BID_PRE = 189.9
const LISTING_PRICE_POST = 250
const LISTING_ASK_POST = 250.5
const LISTING_BID_POST = 249.5

function gatewayLogin(email: string, password: string): Cypress.Chainable<string> {
  return cy
    .request('POST', '/api/v1/auth/login', { email, password })
    .then((r) => r.body.accessToken as string)
}

// Klijent2 (the OTC buyer) isn't in the cypress custom-commands fixture
// list, so log in through the form directly. Matches the pattern in
// support/commands.ts so vite-warmup behavior is identical.
function loginViaUi(email: string, password: string): void {
  cy.visit('/login')
  cy.findByLabelText('Email', { timeout: 30000 }).clear().type(email)
  cy.findByLabelText('Lozinka').clear().type(password)
  cy.findByRole('button', { name: /Prijavi se/ }).click()
  cy.url({ timeout: 10000 }).should('not.include', '/login')
}

function clearAuth(): void {
  cy.clearCookies()
  cy.window().then((w) => {
    w.sessionStorage.clear()
    w.localStorage.clear()
  })
}

// /v1/auth/me → caller's user id (works for both client and employee).
function meUserID(token: string): Cypress.Chainable<string> {
  return cy
    .request({ url: '/api/v1/auth/me', headers: { Authorization: `Bearer ${token}` } })
    .then((r) => (r.body.client?.id ?? r.body.employee?.id) as string)
}

function listAccounts(token: string, ownerClientId: string) {
  return cy
    .request({
      url: `/api/v1/accounts?ownerClientId=${ownerClientId}`,
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => (r.body.accounts ?? []) as Array<{
      id?: string
      currency?: string
      kind?: string
      balance?: string
      availableBalance?: string
    }>)
}

function findUsdAccount(token: string, ownerClientId: string): Cypress.Chainable<{
  id: string
  balance: number
  availableBalance: number
}> {
  return listAccounts(token, ownerClientId).then((accs) => {
    const usd = accs.find((a) => a.currency === 'CURRENCY_USD')
    if (!usd?.id) throw new Error(`no USD account for ${ownerClientId}`)
    return {
      id: usd.id,
      balance: Number(usd.balance ?? '0'),
      availableBalance: Number(usd.availableBalance ?? '0'),
    }
  })
}

function getAccount(token: string, accountId: string): Cypress.Chainable<{
  balance: number
  availableBalance: number
}> {
  return cy
    .request({
      url: `/api/v1/accounts/${accountId}`,
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => ({
      balance: Number(r.body.balance ?? '0'),
      availableBalance: Number(r.body.availableBalance ?? '0'),
    }))
}

function listHoldings(token: string): Cypress.Chainable<Array<{
  id: string
  securityTicker?: string
  quantity?: number
  publicCount?: number
  reservedCount?: number
  weightedAvgPrice?: string
  security?: { id?: string; ticker?: string }
}>> {
  return cy
    .request({
      url: '/api/v1/portfolio',
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => r.body.holdings ?? [])
}

function pinListing(
  adminTok: string,
  securityId: string,
  exchangeMic: string,
  price: number,
  ask: number,
  bid: number,
) {
  return cy.request({
    method: 'PUT',
    url: '/api/v1/listings',
    headers: { Authorization: `Bearer ${adminTok}` },
    body: {
      securityId,
      exchangeMic,
      price: String(price),
      ask: String(ask),
      bid: String(bid),
    },
  })
}

function findSecurityId(token: string, ticker: string): Cypress.Chainable<{
  securityId: string
  exchangeMic: string
}> {
  return cy
    .request({
      url: `/api/v1/securities?search=${encodeURIComponent(ticker)}&type=SECURITY_TYPE_STOCK`,
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => {
      const items = r.body.items ?? []
      const hit = items.find((i: { security?: { ticker?: string } }) => i.security?.ticker === ticker)
      if (!hit) throw new Error(`security ${ticker} not found`)
      return {
        securityId: hit.security.id as string,
        exchangeMic: (hit.listing?.exchangeMic ?? hit.security?.exchangeMic ?? 'XNYS') as string,
      }
    })
}

function stateTaxRSDBalance(adminTok: string): Cypress.Chainable<number> {
  return cy
    .request({
      url: '/api/v1/accounts?ownerClientId=00000000-0000-0000-0000-000000000010&kind=ACCOUNT_KIND_STATE_TAX',
      headers: { Authorization: `Bearer ${adminTok}` },
    })
    .then((r) => {
      const accs = (r.body.accounts ?? []) as Array<{ currency?: string; balance?: string }>
      const rsd = accs.find((a) => a.currency === 'CURRENCY_RSD')
      if (!rsd) throw new Error('state-tax RSD account not seeded')
      return Number(rsd.balance ?? '0')
    })
}

describe('Celina 4 (live) — OTC trading day (spec p.79)', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('seller publishes → buyer offers → seller counters → buyer accepts → buyer exercises → tax cron', () => {
    // ───────────── Stage 0: pre-flight ─────────────
    // As admin: pin AAPL price (live AV refresh would otherwise drift
    // the seeded $190.50 between resetBackend and the offer dialog
    // open), mint a USD trading account for klijent2 with $50_000
    // opening balance so they can pay the premium + strike, and resolve
    // the AAPL securityId for later overrides.
    gatewayLogin(ADMIN_EMAIL, ADMIN_PASSWORD).then((adminTok) => {
      cy.wrap(adminTok).as('adminTok')
      findSecurityId(adminTok, TICKER).then(({ securityId, exchangeMic }) => {
        cy.wrap(securityId).as('aaplId')
        cy.wrap(exchangeMic).as('aaplMic')
        pinListing(adminTok, securityId, exchangeMic, LISTING_PRICE_PRE, LISTING_ASK_PRE, LISTING_BID_PRE)
      })
      stateTaxRSDBalance(adminTok).then((b) => cy.wrap(b).as('stateTaxBefore'))
    })

    // Discover the buyer's client id via login, mint their USD account
    // (kind personal_fx) under the admin so they have funds.
    gatewayLogin(BUYER_EMAIL, BUYER_PASSWORD).then((buyerTok) => {
      cy.wrap(buyerTok).as('buyerTok')
      meUserID(buyerTok).then((id) => cy.wrap(id).as('buyerId'))
    })
    gatewayLogin(SELLER_EMAIL, SELLER_PASSWORD).then((sellerTok) => {
      cy.wrap(sellerTok).as('sellerTok')
      meUserID(sellerTok).then((id) => cy.wrap(id).as('sellerId'))
    })

    cy.get<string>('@adminTok').then((adminTok) => {
      cy.get<string>('@buyerId').then((buyerId) => {
        cy.request({
          method: 'POST',
          url: '/api/v1/accounts',
          headers: { Authorization: `Bearer ${adminTok}` },
          body: {
            ownerClientId: buyerId,
            kind: 'ACCOUNT_KIND_PERSONAL_FX',
            subtype: 'ACCOUNT_SUBTYPE_UNSPECIFIED',
            currency: 'CURRENCY_USD',
            name: 'Trgovinski USD',
            openingBalance: '50000',
          },
        }).then((r) => {
          expect(r.status).to.eq(200)
        })
      })
    })

    // Capture pre-flight bank balances so the post-accept / post-exercise
    // deltas can be cross-checked against the spec's premium + strike
    // figures. Seller has the seeded "Trgovinski USD" with 300k opening.
    cy.get<string>('@adminTok').then((adminTok) => {
      cy.get<string>('@buyerId').then((buyerId) => {
        findUsdAccount(adminTok, buyerId).then((acc) => {
          cy.wrap(acc.id).as('buyerUsdId')
          cy.wrap(acc.balance).as('buyerUsdBefore')
        })
      })
      cy.get<string>('@sellerId').then((sellerId) => {
        findUsdAccount(adminTok, sellerId).then((acc) => {
          cy.wrap(acc.id).as('sellerUsdId')
          cy.wrap(acc.balance).as('sellerUsdBefore')
        })
      })
    })

    // Capture the seller's AAPL holding id (set public_count via UI in
    // the next step).
    cy.get<string>('@sellerTok').then((sellerTok) => {
      listHoldings(sellerTok).then((hs) => {
        const aapl = hs.find((h) => h.security?.ticker === TICKER)
        if (!aapl) throw new Error('seeded klijent has no AAPL holding')
        cy.wrap(aapl.id).as('sellerHoldingId')
      })
    })

    // ───────────── DEO 1: seller publishes ─────────────
    // Marija (klijent) logs in to /banking/portfolio, edits the AAPL row's
    // "Javno" cell, saves public_count = 10.
    cy.loginAsClient()
    cy.visit('/banking/portfolio')
    cy.contains('h1', /Portfolio/, { timeout: 15000 }).should('be.visible')
    cy.contains('tr', TICKER, { timeout: 15000 }).should('be.visible')

    cy.get<string>('@sellerHoldingId').then((hid) => {
      cy.get(`[data-cy="public-count-edit-${hid}"]`).click()
      cy.get(`[data-cy="public-count-input-${hid}"]`).clear().type(String(PUBLIC_QTY))
      cy.get(`[data-cy="public-count-save-${hid}"]`).click()
      cy.get(`[data-cy="public-count-${hid}"]`, { timeout: 30000 }).should('contain', String(PUBLIC_QTY))
    })

    // ───────────── DEO 2: buyer offers ─────────────
    // Luka (klijent2) logs in, browses /banking/otc, opens the offer
    // dialog on the AAPL row, fills qty / ppu / premium / settlement.
    clearAuth()
    loginViaUi(BUYER_EMAIL, BUYER_PASSWORD)
    cy.visit('/banking/otc')
    cy.contains('h1', 'OTC trgovina', { timeout: 15000 }).should('be.visible')
    cy.contains('tr', TICKER, { timeout: 15000 }).should('be.visible')

    cy.get<string>('@sellerHoldingId').then((hid) => {
      cy.get(`[data-cy="otc-make-offer-${hid}"]`).click()
    })
    cy.contains('Napravi ponudu — AAPL', { timeout: 10000 }).should('be.visible')

    // Buyer-account picker auto-fills to the freshly-minted USD account.
    cy.get<string>('@buyerUsdId').then((accId) => {
      cy.get('[data-cy="otc-buyer-account"]').should('have.value', accId)
    })
    cy.get('[data-cy="otc-qty"]').clear().type(String(OFFER_QTY))
    cy.get('[data-cy="otc-ppu"]').clear().type(String(OFFER_PPU))
    cy.get('[data-cy="otc-premium"]').clear().type(String(PREMIUM))
    cy.get('[data-cy="otc-settlement"]').type('2026-12-31')
    cy.get('[data-cy="otc-create-offer-submit"]').click()

    // Dialog closes on success; thread now visible on /banking/otc/ponude.
    cy.contains('Napravi ponudu — AAPL').should('not.exist')

    // Reservation bumped: seller's AAPL holding now has reserved_count=5.
    cy.get<string>('@sellerTok').then((sellerTok) => {
      listHoldings(sellerTok).then((hs) => {
        const aapl = hs.find((h) => h.security?.ticker === TICKER)!
        expect(aapl.reservedCount, 'reserved_count after offer').to.eq(OFFER_QTY)
      })
    })

    // ───────────── DEO 3: seller counters ─────────────
    // Marija logs back in, opens the thread on /banking/otc/ponude and
    // submits a counter at $200 (becomes the strike on accept).
    clearAuth()
    cy.loginAsClient()
    cy.visit('/banking/otc/ponude')
    cy.contains('h1', 'Aktivne ponude', { timeout: 15000 }).should('be.visible')
    cy.contains('tr', TICKER, { timeout: 15000 }).click()
    cy.contains(`Pregovaranje — ${TICKER}`, { timeout: 10000 }).should('be.visible')

    cy.get('[data-cy="otc-counter-ppu"]').clear().type(String(COUNTER_PPU))
    cy.get('[data-cy="otc-counter-submit"]').click()
    // Modal stays open after counter; close it by visiting the page again.
    cy.visit('/banking/otc/ponude')

    // ───────────── DEO 4: buyer accepts ─────────────
    // Luka opens the thread, sees the latest iteration is the seller's
    // counter, clicks Prihvati → VerificationDialog → typing the
    // displayed inline code → Potvrdi.
    clearAuth()
    loginViaUi(BUYER_EMAIL, BUYER_PASSWORD)

    cy.visit('/banking/otc/ponude')
    cy.contains('h1', 'Aktivne ponude', { timeout: 15000 }).should('be.visible')
    cy.contains('tr', TICKER, { timeout: 15000 }).click()
    cy.contains(`Pregovaranje — ${TICKER}`, { timeout: 10000 }).should('be.visible')
    cy.get('[data-cy="otc-accept"]').click()
    cy.contains('Prihvatanje OTC ponude', { timeout: 10000 }).should('be.visible')

    // Read the displayed inline code, type it back, confirm.
    cy.get('[aria-label="verifikacioni-kod"]', { timeout: 10000 })
      .invoke('text')
      .then((code) => {
        const digits = code.trim()
        expect(digits, 'inline 6-digit code').to.match(/^\d{6}$/)
        cy.get('#verif-code').type(digits)
        cy.contains('button', 'Potvrdi').click()
      })

    // Premium ledger move asserts the SAGA debited buyer and credited
    // seller by exactly $10 each. The accept response closes the modal;
    // poll the buyer's account until the debit lands (the SAGA + bank
    // settle are sub-second but the FE close happens before the
    // refetch).
    cy.get<string>('@adminTok').then((adminTok) => {
      cy.get<string>('@buyerUsdId').then((buyerUsdId) => {
        cy.get<number>('@buyerUsdBefore').then((buyerBefore) => {
          function pollPremium(remaining: number) {
            if (remaining <= 0) throw new Error('premium leg did not land')
            getAccount(adminTok, buyerUsdId).then((acc) => {
              const want = buyerBefore - PREMIUM
              if (Math.abs(acc.balance - want) < 0.01) return
              cy.wait(500)
              pollPremium(remaining - 1)
            })
          }
          pollPremium(20)
        })
      })
      cy.get<string>('@sellerUsdId').then((sellerUsdId) => {
        cy.get<number>('@sellerUsdBefore').then((sellerBefore) => {
          getAccount(adminTok, sellerUsdId).then((acc) => {
            expect(Math.abs(acc.balance - (sellerBefore + PREMIUM)), 'seller +premium').to.be.lessThan(0.01)
          })
        })
      })
    })

    // reserved_count stays at OFFER_QTY — the contract holds the
    // reservation now (spec p.79 + OTC-3 note).
    cy.get<string>('@sellerTok').then((sellerTok) => {
      listHoldings(sellerTok).then((hs) => {
        const aapl = hs.find((h) => h.security?.ticker === TICKER)!
        expect(aapl.reservedCount, 'reserved_count rolled to contract').to.eq(OFFER_QTY)
      })
    })

    // ───────────── DEO 5: admin bumps price → buyer exercises ─────────────
    // Spec p.69 surfaces "Iskoristi" only when profit > 0, i.e.
    // (last_price - strike) * qty - premium > 0 — at $250 with strike
    // $200 that's (250-200)*5 - 10 = $240. Pin via PUT /listings first.
    cy.get<string>('@adminTok').then((adminTok) => {
      cy.get<string>('@aaplId').then((aaplId) => {
        cy.get<string>('@aaplMic').then((mic) => {
          pinListing(adminTok, aaplId, mic, LISTING_PRICE_POST, LISTING_ASK_POST, LISTING_BID_POST)
        })
      })
    })

    // Luka stays logged in (sessionStorage carries the buyer's token).
    cy.visit('/banking/otc/ugovori')
    cy.contains('h1', 'Sklopljeni ugovori', { timeout: 15000 }).should('be.visible')

    // The contract row renders the buyer's profit column as positive;
    // "Iskoristi" surfaces. Click → confirmation dialog → "Potvrdi" →
    // verification dialog.
    cy.contains('tr', TICKER, { timeout: 30000 })
      .find('button')
      .contains('Iskoristi')
      .click()
    cy.contains('Iskoristi opciju', { timeout: 10000 }).should('be.visible')
    cy.get('[data-cy="otc-exercise-confirm"]').click()
    cy.contains('Izvršenje OTC ugovora', { timeout: 10000 }).should('be.visible')
    cy.get('[aria-label="verifikacioni-kod"]', { timeout: 10000 })
      .invoke('text')
      .then((code) => {
        const digits = code.trim()
        expect(digits, 'inline 6-digit code').to.match(/^\d{6}$/)
        cy.get('#verif-code').type(digits)
        cy.contains('button', 'Potvrdi').click()
      })

    // ───────────── DEO 6: settlement invariants ─────────────
    // Wait for the strike-leg debit to land on the buyer's USD account,
    // then cross-check seller credit + holdings + realized_gain.
    const strikeLeg = OFFER_QTY * COUNTER_PPU // $1000

    cy.get<string>('@adminTok').then((adminTok) => {
      cy.get<string>('@buyerUsdId').then((buyerUsdId) => {
        cy.get<number>('@buyerUsdBefore').then((buyerBefore) => {
          function pollStrike(remaining: number) {
            if (remaining <= 0) throw new Error('strike leg did not land')
            getAccount(adminTok, buyerUsdId).then((acc) => {
              const want = buyerBefore - PREMIUM - strikeLeg
              if (Math.abs(acc.balance - want) < 0.01) return
              cy.wait(500)
              pollStrike(remaining - 1)
            })
          }
          pollStrike(30)
        })
      })

      cy.get<string>('@sellerUsdId').then((sellerUsdId) => {
        cy.get<number>('@sellerUsdBefore').then((sellerBefore) => {
          getAccount(adminTok, sellerUsdId).then((acc) => {
            const want = sellerBefore + PREMIUM + strikeLeg
            expect(Math.abs(acc.balance - want), 'seller +premium +strike').to.be.lessThan(0.01)
          })
        })
      })
    })

    // Holdings: seller AAPL qty drops to 5, reserved_count returns to 0.
    cy.get<string>('@sellerTok').then((sellerTok) => {
      listHoldings(sellerTok).then((hs) => {
        const aapl = hs.find((h) => h.security?.ticker === TICKER)!
        expect(aapl.quantity, 'seller AAPL post-exercise').to.eq(PUBLIC_QTY - OFFER_QTY)
        expect(aapl.reservedCount, 'reservation released on exercise').to.eq(0)
      })
    })

    // Buyer's portfolio gets a new AAPL holding at cost basis = strike.
    cy.get<string>('@buyerTok').then((buyerTok) => {
      listHoldings(buyerTok).then((hs) => {
        const aapl = hs.find((h) => h.security?.ticker === TICKER)
        if (!aapl) throw new Error('buyer did not receive AAPL holding')
        expect(aapl.quantity, 'buyer AAPL after exercise').to.eq(OFFER_QTY)
        expect(Number(aapl.weightedAvgPrice ?? '0'), 'buyer cost basis = strike').to.be.closeTo(COUNTER_PPU, 0.01)
      })
    })

    // Seller's realized_gain row written (EDGE-2). cost_basis = 170,
    // proceeds = 200, qty = 5 → gain_native = $150. Tax cron picks it
    // up on the next /tax/run.
    gatewayLogin(SUPERVISOR_EMAIL, SUPERVISOR_PASSWORD).then((supTok) => {
      cy.wrap(supTok).as('supTok')
      cy.get<string>('@sellerId').then((sellerId) => {
        cy.request({
          url: `/api/v1/tax/realized?userId=${sellerId}&userKind=USER_KIND_CLIENT`,
          headers: { Authorization: `Bearer ${supTok}` },
        }).then((r) => {
          const rows = (r.body.rows ?? []) as Array<{
            quantity?: number
            costBasisAmt?: string
            proceedsAmt?: string
            profitNative?: string
          }>
          // The seed plants two prior realized_gains rows on Test Klijent
          // (one win + one loss) so the OTC row is the latest. Filter
          // on (proceeds=1000, cost=850) to find the OTC fill exactly.
          const otcRow = rows.find(
            (row) =>
              Math.abs(Number(row.proceedsAmt ?? '0') - OFFER_QTY * COUNTER_PPU) < 0.01 &&
              Math.abs(Number(row.costBasisAmt ?? '0') - OFFER_QTY * SELLER_COST_BASIS) < 0.01,
          )
          expect(otcRow, 'seller realized_gain row from OTC exercise').to.not.equal(undefined)
          expect(Number(otcRow!.profitNative ?? '0'), 'profit_native = qty × (strike − cost_basis)').to.be.closeTo(
            OFFER_QTY * (COUNTER_PPU - SELLER_COST_BASIS),
            0.01,
          )
          expect(otcRow!.quantity, 'realized qty = OFFER_QTY').to.eq(OFFER_QTY)
        })
      })
    })

    // ───────────── DEO 7: tax cron collects ─────────────
    // Supervisor runs /tax/run. state_tax RSD account must rise by
    // exactly the totalCollectedRsd the response reports — that
    // cross-checks "the OTC row's RSD profit flowed to the state" all
    // the way to the bank ledger.
    cy.get<string>('@supTok').then((supTok) => {
      cy.get<number>('@stateTaxBefore').then((stateTaxBefore) => {
        cy.request({
          method: 'POST',
          url: '/api/v1/tax/run',
          headers: { Authorization: `Bearer ${supTok}` },
          body: {},
        }).then((r) => {
          const usersTaxed = Number(r.body.usersTaxed ?? 0)
          const total = Number(r.body.totalCollectedRsd ?? 0)
          expect(usersTaxed, 'tax users taxed').to.be.greaterThan(0)
          expect(total, 'tax total RSD').to.be.greaterThan(0)
          cy.get<string>('@adminTok').then((adminTok) => {
            stateTaxRSDBalance(adminTok).then((after) => {
              const delta = Math.round((after - stateTaxBefore) * 10000) / 10000
              expect(delta, 'state-tax credit == total RSD reported').to.be.closeTo(
                Math.round(total * 10000) / 10000,
                0.02,
              )
            })
          })
        })
      })
    })
  })
})
