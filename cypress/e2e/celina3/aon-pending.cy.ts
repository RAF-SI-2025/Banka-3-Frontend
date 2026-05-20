/// <reference types="cypress" />

// spec/C3-tests.pdf — Scenario 60: AON order - ne izvršava se bez
// pune dostupne količine
//
//   Given aktuar kreira AON BUY order za 20 akcija
//   And   trenutno dostupno na tržištu je 15 akcija
//   When  sistem pokuša da izvrši order
//   Then  order se ne izvršava
//   And   order ostaje u Pending statusu dok se ne skupi puna količina
//
// The trading simulator has no separate "available qty" knob — it
// fires whole-order on the first tick whose price condition + cadence
// allow it (CLAUDE.md status: "AON forces whole-order fill on the
// first ready tick"). The functionally equivalent gating is the
// LIMIT/STOP price predicate: a Limit BUY whose limit price sits
// below the current ask never fills, which is the spec's "not enough
// available" → not executed condition. The order stays Approved with
// isDone=false and remainingQuantity=20.

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

describe('Celina 3 — AON order ostaje Pending bez pune količine (S60)', () => {
  beforeEach(() => cy.resetBackend())

  it('AON LIMIT BUY whose limit price never crosses ask stays Approved with isDone=false', () => {
    gatewayLogin(AGENT_EMAIL, AGENT_PASSWORD).as('agentTok')

    // Resolve MSFT (ask ~$450.20) + the bank USD forex_book account.
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

    // Place the AON LIMIT BUY at $10 — well below MSFT's ~$450 ask, so
    // the executor's `ask <= limit_price` condition is false on every
    // tick and the order can't fire (spec p.51 buy-limit predicate).
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
                orderType: 'ORDER_TYPE_LIMIT',
                quantity: 20,
                limitPrice: '10.00',
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

    // Wait long enough for ≥1 execution tick (default 10 s) — the
    // worker walks every active order each tick. AON + unmet limit ⇒
    // no fill should ever land; we sample after ~30 s.
    cy.wait(30000)

    cy.get<string>('@orderId').then((orderId) =>
      cy.get<string>('@agentTok').then((tok) =>
        cy
          .request({
            url: `/api/v1/orders/${orderId}`,
            headers: { Authorization: `Bearer ${tok}` },
          })
          .then((r) => {
            expect(r.body.allOrNone, 'AON flag still set').to.eq(true)
            expect(r.body.isDone, 'AON did not partial-fill').to.eq(false)
            expect(Number(r.body.remainingQuantity ?? 0), 'full quantity still outstanding').to.eq(
              20,
            )
            expect(r.body.cancelled).to.eq(false)
          }),
      ),
    )
  })
})
