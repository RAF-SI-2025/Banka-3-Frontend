/// <reference types="cypress" />

export {}

// todoSpec C4 "Automatska promena stanja pregovora" — the extended OTC
// offer state machine. An open offer can now also transition to:
//
//   * cancelled (Otkazana) — the ORIGINATOR (the party who proposed the
//     live iteration) pulls their own open offer.
//   * rejected  (Odbijena) — the COUNTERPARTY declines the latest open
//     offer.
//
// (The 3-business-day inactivity auto-expiry → expired is cron-driven and
// not Cypress-drivable from a single stack — SKIP, see note below.)
//
// Coverage here drives the NEW UI surfaces in OTCThreadModal:
//   - the "Otkaži ponudu" button (data-cy=otc-cancel), shown to the
//     originator while waiting on the other side, and
//   - the "Odbij ponudu" button (data-cy=otc-reject), shown to the
//     counterparty alongside the counter form.
// Each action closes the modal + the thread drops out of the active
// ("Aktivne ponude") list — ListOTCThreads defaults to status='open', so
// a cancelled/rejected thread is no longer active. We assert the drop and
// cross-check the persisted terminal status (cancelled/rejected) via
// pgSql, plus the released reservation on the seller's holding.
//
// Offers are bootstrapped through the gateway (the proven c4-otc-scenarios
// pattern) so the test focuses on the new cancel/reject UI rather than the
// already-covered create/counter dialogs.

const ADMIN_EMAIL = 'admin@banka.local'
const ADMIN_PASSWORD = 'Admin123!'
const SELLER_EMAIL = 'klijent@banka.local'
const SELLER_PASSWORD = 'Klijent123!'
const BUYER_EMAIL = 'klijent2@banka.local'
const BUYER_PASSWORD = 'Klijent123!'

const TICKER = 'AAPL'
const LISTING_PRICE = 190
const PUBLIC_QTY = 10
const OFFER_QTY = 4

function gatewayLogin(email: string, password: string): Cypress.Chainable<string> {
  return cy
    .request('POST', '/api/v1/auth/login', { email, password })
    .then((r) => r.body.accessToken as string)
}

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

function meUserID(token: string): Cypress.Chainable<string> {
  return cy
    .request({ url: '/api/v1/auth/me', headers: { Authorization: `Bearer ${token}` } })
    .then((r) => (r.body.client?.id ?? r.body.employee?.id) as string)
}

function findSecurity(token: string, ticker: string) {
  return cy
    .request({
      url: `/api/v1/securities?search=${encodeURIComponent(ticker)}&type=SECURITY_TYPE_STOCK`,
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => {
      const hit = (r.body.items ?? []).find(
        (i: { security?: { ticker?: string } }) => i.security?.ticker === ticker,
      )
      if (!hit) throw new Error(`security ${ticker} not found`)
      return {
        securityId: hit.security.id as string,
        exchangeMic: (hit.listing?.exchangeMic ?? 'XNYS') as string,
      }
    })
}

function pinListing(adminTok: string, securityId: string, exchangeMic: string, price: number) {
  return cy.request({
    method: 'PUT',
    url: '/api/v1/listings',
    headers: { Authorization: `Bearer ${adminTok}` },
    body: {
      securityId,
      exchangeMic,
      price: String(price),
      ask: String(price + 0.5),
      bid: String(price - 0.5),
    },
  })
}

function findUsdAccount(token: string, ownerClientId: string) {
  return cy
    .request({
      url: `/api/v1/accounts?ownerClientId=${ownerClientId}`,
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => {
      const usd = (r.body.accounts ?? []).find(
        (a: { currency?: string }) => a.currency === 'CURRENCY_USD',
      ) as { id?: string } | undefined
      if (!usd?.id) throw new Error(`no USD account for ${ownerClientId}`)
      return usd.id as string
    })
}

function mintBuyerUsd(adminTok: string, buyerId: string, balance = 50000) {
  return cy.request({
    method: 'POST',
    url: '/api/v1/accounts',
    headers: { Authorization: `Bearer ${adminTok}` },
    body: {
      ownerClientId: buyerId,
      kind: 'ACCOUNT_KIND_PERSONAL_FX',
      subtype: 'ACCOUNT_SUBTYPE_UNSPECIFIED',
      currency: 'CURRENCY_USD',
      name: 'Trgovinski USD',
      openingBalance: String(balance),
    },
  })
}

function listSellerHolding(token: string, ticker: string) {
  return cy
    .request({ url: '/api/v1/portfolio', headers: { Authorization: `Bearer ${token}` } })
    .then((r) => {
      const h = (r.body.holdings ?? []).find(
        (x: { security?: { ticker?: string } }) => x.security?.ticker === ticker,
      )
      if (!h) throw new Error(`seller has no ${ticker} holding`)
      return h as { id: string; reservedCount?: number }
    })
}

function setPublicCount(token: string, holdingId: string, count: number) {
  return cy.request({
    method: 'PATCH',
    url: `/api/v1/portfolio/${holdingId}/public-count`,
    headers: { Authorization: `Bearer ${token}` },
    body: { publicCount: count },
  })
}

// createOffer plants one open thread via the gateway. `lastModifier`
// controls which party owns the live iteration:
//   'buyer'  → the buyer created the offer (buyer is originator). The
//              seller is the counterparty (can reject); the buyer can
//              cancel.
//   'seller' → the buyer creates, then the seller counters, so the
//              seller becomes originator (seller can cancel); the buyer
//              is the counterparty (can reject).
function createOffer(
  buyerTok: string,
  sellerTok: string,
  sellerHoldingId: string,
  buyerUsdId: string,
  sellerUsdId: string,
  qty: number,
  lastModifier: 'buyer' | 'seller',
): Cypress.Chainable<string> {
  return cy
    .request({
      method: 'POST',
      url: '/api/v1/otc/offers',
      headers: { Authorization: `Bearer ${buyerTok}`, 'Idempotency-Key': crypto.randomUUID() },
      body: {
        sellerHoldingId,
        buyerAccountId: buyerUsdId,
        sellerAccountId: sellerUsdId,
        quantity: qty,
        pricePerUnit: '195.00',
        premium: '10.00',
        settlementDate: '2026-12-31T00:00:00Z',
      },
    })
    .then((r) => {
      expect(r.status, 'create offer 200').to.eq(200)
      const threadId = r.body.threadId as string
      if (lastModifier === 'buyer') return cy.wrap(threadId)
      // Seller counters so the seller owns the live iteration.
      return cy
        .request({
          method: 'POST',
          url: `/api/v1/otc/offers/${threadId}/counter`,
          headers: { Authorization: `Bearer ${sellerTok}`, 'Idempotency-Key': crypto.randomUUID() },
          body: {
            quantity: qty,
            pricePerUnit: '200.00',
            premium: '10.00',
            settlementDate: '2026-12-31T00:00:00Z',
          },
        })
        .then((cr) => {
          expect(cr.status, 'seller counter 200').to.eq(200)
          return cy.wrap(threadId)
        })
    })
}

// otcStatus reads the latest iteration's status straight from the DB so
// we can assert the terminal cancelled/rejected state after the modal
// closes (ListOTCThreads drops non-open threads).
function otcStatus(threadId: string): Cypress.Chainable<string> {
  return cy
    .pgSql(
      `SELECT status FROM "trading".otc_offers
        WHERE thread_id = '${threadId}'
        ORDER BY created_at DESC LIMIT 1`,
    )
    .then((s) => (s as string).trim())
}

interface Ctx {
  adminTok: string
  sellerTok: string
  buyerTok: string
  buyerId: string
  sellerHoldingId: string
  buyerUsdId: string
  sellerUsdId: string
}

function bootstrap(): Cypress.Chainable<Ctx> {
  return gatewayLogin(ADMIN_EMAIL, ADMIN_PASSWORD).then((adminTok) =>
    gatewayLogin(SELLER_EMAIL, SELLER_PASSWORD).then((sellerTok) =>
      gatewayLogin(BUYER_EMAIL, BUYER_PASSWORD).then((buyerTok) =>
        meUserID(buyerTok).then((buyerId) =>
          meUserID(sellerTok).then((sellerId) =>
            findSecurity(adminTok, TICKER).then(({ securityId, exchangeMic }) =>
              pinListing(adminTok, securityId, exchangeMic, LISTING_PRICE).then(() =>
                listSellerHolding(sellerTok, TICKER).then((h) =>
                  setPublicCount(sellerTok, h.id, PUBLIC_QTY).then(() =>
                    mintBuyerUsd(adminTok, buyerId).then(() =>
                      findUsdAccount(adminTok, buyerId).then((buyerUsdId) =>
                        findUsdAccount(sellerTok, sellerId).then((sellerUsdId) => ({
                          adminTok,
                          sellerTok,
                          buyerTok,
                          buyerId,
                          sellerHoldingId: h.id,
                          buyerUsdId,
                          sellerUsdId,
                        })),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  )
}

describe('Celina 4 — OTC offer state machine (cancel / reject)', () => {
  beforeEach(() => {
    cy.resetBackend()
    // Seed's OTC thread fixture (SEED_OTC=0 here, but defensive) bumps
    // klijent's AAPL reserved_count; zero it so PublicCountEditor's max
    // (= quantity − reserved) accepts the full publish.
    cy.pgSql(`UPDATE "trading".portfolio_holdings h
                 SET reserved_count = 0
                FROM "trading".securities s
               WHERE s.id = h.security_id
                 AND s.ticker = 'AAPL' AND s.type = 'stock'`)
  })

  it('originator otkazuje svoju otvorenu ponudu → status Otkazana, nestaje iz aktivnih', () => {
    // Buyer is the originator (created the offer, no counter), so the
    // buyer sees "Otkaži ponudu" while waiting on the seller.
    bootstrap().then((ctx) => {
      createOffer(
        ctx.buyerTok,
        ctx.sellerTok,
        ctx.sellerHoldingId,
        ctx.buyerUsdId,
        ctx.sellerUsdId,
        OFFER_QTY,
        'buyer',
      ).then((threadId) => {
        // Reservation is held while the offer is open.
        listSellerHolding(ctx.sellerTok, TICKER).then((h) => {
          expect(h.reservedCount, 'reserved while open').to.eq(OFFER_QTY)
        })

        clearAuth()
        loginViaUi(BUYER_EMAIL, BUYER_PASSWORD)
        cy.visit('/banking/otc/ponude')
        cy.contains('h1', 'Aktivne ponude', { timeout: 15000 }).should('be.visible')

        // Open the thread modal; the originator's view exposes "Otkaži".
        cy.get(`[data-cy="otc-thread-${threadId}"]`, { timeout: 15000 }).click()
        cy.contains(`Pregovaranje — ${TICKER}`, { timeout: 10000 }).should('be.visible')
        cy.get('[data-cy="otc-cancel"]').should('be.visible').click()

        // Modal closes on success.
        cy.contains(`Pregovaranje — ${TICKER}`).should('not.exist')
        // Thread is no longer in the active (open-only) list.
        cy.get(`[data-cy="otc-thread-${threadId}"]`).should('not.exist')

        // Persisted terminal status = cancelled (rendered as "Otkazana").
        otcStatus(threadId).then((status) => {
          expect(status, 'DB status after cancel').to.eq('cancelled')
        })
        // Reservation released back to the seller's holding.
        listSellerHolding(ctx.sellerTok, TICKER).then((h) => {
          expect(h.reservedCount, 'reservation released on cancel').to.eq(0)
        })
      })
    })
  })

  it('counterparty odbija najnoviju ponudu → status Odbijena, nestaje iz aktivnih', () => {
    // Seller counters (becomes originator). The BUYER is now the
    // counterparty and sees "Odbij ponudu" alongside the counter form.
    bootstrap().then((ctx) => {
      createOffer(
        ctx.buyerTok,
        ctx.sellerTok,
        ctx.sellerHoldingId,
        ctx.buyerUsdId,
        ctx.sellerUsdId,
        OFFER_QTY,
        'seller',
      ).then((threadId) => {
        clearAuth()
        loginViaUi(BUYER_EMAIL, BUYER_PASSWORD)
        cy.visit('/banking/otc/ponude')
        cy.contains('h1', 'Aktivne ponude', { timeout: 15000 }).should('be.visible')

        cy.get(`[data-cy="otc-thread-${threadId}"]`, { timeout: 15000 }).click()
        cy.contains(`Pregovaranje — ${TICKER}`, { timeout: 10000 }).should('be.visible')
        // Counterparty sees both reject + counter affordances.
        cy.get('[data-cy="otc-reject"]').should('be.visible').click()

        cy.contains(`Pregovaranje — ${TICKER}`).should('not.exist')
        cy.get(`[data-cy="otc-thread-${threadId}"]`).should('not.exist')

        otcStatus(threadId).then((status) => {
          expect(status, 'DB status after reject').to.eq('rejected')
        })
        listSellerHolding(ctx.sellerTok, TICKER).then((h) => {
          expect(h.reservedCount, 'reservation released on reject').to.eq(0)
        })
      })
    })
  })

  // SKIP (cron): the 3-business-day inactivity sweep (open → expired) is
  // driven by the trading-service scheduler walking otc_offers.updated_at;
  // it is not reachable from a single Cypress stack without backdating +
  // a manual cron tick that the gateway doesn't expose. The drivable
  // terminal transitions (cancelled / rejected) are covered above.
})
