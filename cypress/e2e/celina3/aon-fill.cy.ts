/// <reference types="cypress" />

// spec/C3-tests.pdf — Scenario 61: AON order - uspešno izvršavanje
// kada je puna količina dostupna
//
//   Given aktuar kreira AON BUY order za 10 akcija
//   And   na tržištu je dostupno 10 ili više akcija
//   When  sistem izvrši order
//   Then  order se izvršava u celosti odjednom
//   And   kreira se jedna transakcija za celokupnu količinu
//
// Spec p.55-56 ("AON forces whole-order fill on the first ready tick,
// no random sub-quantity") — verified by transaction count: an AON
// Market BUY that satisfies its price condition fills as exactly ONE
// `trade`-kind bank transaction, not the 1..n partial-fill chunker
// fragmentation non-AON orders see. We use qty=3 (instead of the
// spec's 10) so the RSD-equivalent stays under the actuary's seeded
// 200k RSD daily limit (10 MSFT ~ 530k RSD ≫ limit ⇒ would route to
// Pending and never fill without a supervisor). The single-transaction
// AON invariant holds regardless of quantity.

const FOREX_BOOK_OWNER_ID = '00000000-0000-0000-0000-000000000020'
const AGENT_EMAIL = 'aktuar@banka.local'
const AGENT_PASSWORD = 'Aktuar123!'

function gatewayLogin(email: string, password: string): Cypress.Chainable<string> {
  return cy
    .request({
      method: 'POST',
      url: '/api/v1/auth/login',
      body: { email, password },
    })
    .then((r) => r.body.accessToken as string)
}

describe('Celina 3 — AON uspešno izvršavanje u jednoj transakciji (S61)', () => {
  beforeEach(() => {
    cy.resetBackend()
    cy.resetAgentLimit() // soak-e2e safety
  })

  it('AON Market BUY fires as exactly one trade transaction (no partial-fill fragmentation)', () => {
    gatewayLogin(AGENT_EMAIL, AGENT_PASSWORD).as('agentTok')

    cy.get<string>('@agentTok').then((tok) =>
      cy
        .request({
          url: '/api/v1/listings?pageSize=100',
          headers: { Authorization: `Bearer ${tok}` },
        })
        .then((r) => {
          const msft = (r.body.items ?? []).find(
            (x: { security?: { ticker?: string } }) => x.security?.ticker === 'MSFT',
          )!
          cy.wrap(msft.security.id as string).as('msftId')
        }),
    )
    cy.get<string>('@agentTok').then((tok) =>
      cy
        .request({
          url: `/api/v1/accounts?ownerClientId=${FOREX_BOOK_OWNER_ID}&kind=ACCOUNT_KIND_FOREX_BOOK`,
          headers: { Authorization: `Bearer ${tok}` },
        })
        .then((r) => {
          const usd = (r.body.accounts ?? []).find(
            (a: { currency?: string }) => a.currency === 'CURRENCY_USD',
          )!
          cy.wrap(usd.id as string).as('forexUsdId')
        }),
    )

    // Capture the wall-clock just before placing the order so the
    // post-completion snapshot can filter to "transactions created at
    // or after this point". Soak-e2e otherwise picks up trickle-fills
    // from earlier specs' Market orders that are still settling in
    // the worker's background ticker, inflating the count and
    // breaking the "exactly one fill" AON invariant.
    cy.then(() => {
      // 1 s slack so the API's >= comparator is strict.
      const t0 = new Date(Date.now() - 1000).toISOString()
      cy.wrap(t0).as('aonStartIso')
    })

    cy.get<string>('@agentTok').then((tok) =>
      cy.get<string>('@msftId').then((secId) =>
        cy.get<string>('@forexUsdId').then((acctId) =>
          cy
            .request({
              method: 'POST',
              url: '/api/v1/orders',
              headers: { Authorization: `Bearer ${tok}` },
              body: {
                securityId: secId,
                accountId: acctId,
                direction: 'DIRECTION_BUY',
                orderType: 'ORDER_TYPE_MARKET',
                quantity: 3,
                allOrNone: true,
              },
            })
            .then((r) => {
              expect(r.status).to.eq(200)
              expect(r.body.order.allOrNone).to.eq(true)
              cy.wrap(r.body.order.id as string).as('orderId')
            }),
        ),
      ),
    )

    // Poll for done. AON forces whole-order on first ready tick;
    // worker ticks every 10 s. 30 × 3 s = 90 s ceiling.
    cy.get<string>('@orderId').then((orderId) => {
      function poll(remaining: number): void {
        if (remaining <= 0) throw new Error('AON BUY did not fill')
        cy.get<string>('@agentTok').then((tok) =>
          cy
            .request({
              url: `/api/v1/orders/${orderId}`,
              headers: { Authorization: `Bearer ${tok}` },
            })
            .then((or) => {
              if (or.body.isDone === true) return
              cy.wait(3000)
              poll(remaining - 1)
            }),
        )
      }
      poll(30)
    })

    // Count only trade transactions created at-or-after the AON's
    // start timestamp; this excludes background fills on other orders
    // that may have ticked during our poll under soak-e2e. AON ⇒
    // exactly one fill, so total must be 1.
    cy.get<string>('@forexUsdId').then((acctId) =>
      cy.get<string>('@agentTok').then((tok) =>
        cy.get<string>('@aonStartIso').then((from) =>
          cy
            .request({
              url: `/api/v1/transactions?accountId=${acctId}&opKind=trade&pageSize=1&from=${encodeURIComponent(from)}`,
              headers: { Authorization: `Bearer ${tok}` },
            })
            .then((r) => {
              const count = Number(r.body.total ?? 0)
              expect(count, 'AON BUY produces exactly one trade transaction').to.eq(1)
            }),
        ),
      ),
    )
  })
})
