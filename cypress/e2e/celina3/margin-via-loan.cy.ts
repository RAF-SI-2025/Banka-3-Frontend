/// <reference types="cypress" />

// spec/C3-tests.pdf — Scenario 64: Margin order dozvoljen - klijent sa
// kreditom > Initial Margin Cost
//
//   Given klijent ima margin permisiju
//   And   ima aktivan kredit čiji iznos prelazi Initial Margin Cost hartije
//   When  uključi Margin i potvrdi BUY order
//   Then  order je prihvaćen
//
// Seed plants the klijent with `trading.client` only (no
// `trading.margin`); we grant it via cy.pgSql so the order-service's
// permissions.TradingMargin gate accepts the call. The klijent has an
// APPROVED seeded loan + ~300k USD personal trading account, both
// well above the IMC of one MSFT share (~$250). The combined
// preconditions of S64 are satisfied; the test asserts the BE accepts
// the margin order without rejection.

const CLIENT_EMAIL = 'klijent@banka.local'
const CLIENT_PASSWORD = 'Klijent123!'

function gatewayLogin(email: string, password: string): Cypress.Chainable<string> {
  return cy
    .request({
      method: 'POST',
      url: '/api/v1/auth/login',
      body: { email, password },
    })
    .then((r) => r.body.accessToken as string)
}

describe('Celina 3 — Margin order dozvoljen — klijent + kredit > IMC (S64)', () => {
  beforeEach(() => {
    cy.resetBackend()
    // Seed grants only trading.client; spec's first precondition is
    // "klijent ima margin permisiju" — append it via pgSql. text[] is
    // dedup-safe via array_append + filter on existing.
    cy.pgSql(`
      UPDATE "user".clients
         SET permissions = (
           SELECT array_agg(DISTINCT p ORDER BY p)
             FROM unnest(permissions || ARRAY['trading.margin']) AS p
         )
       WHERE email = 'klijent@banka.local';
    `)
  })

  it('klijent with trading.margin + active loan: Margin BUY is accepted', () => {
    // Re-login after the perm grant so the JWT carries the new perm.
    gatewayLogin(CLIENT_EMAIL, CLIENT_PASSWORD).as('clientTok')

    // Resolve MSFT (USD-listed) + the client's USD trading account
    // (seeded `Trgovinski USD` ~300k balance, `personal_fx` kind).
    cy.get<string>('@clientTok').then((tok) =>
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
    cy.get<string>('@clientTok').then((tok) =>
      cy
        .request({
          url: '/api/v1/accounts',
          headers: { Authorization: `Bearer ${tok}` },
        })
        .then((r) => {
          const usd = (r.body.accounts ?? []).find(
            (a: { currency?: string }) => a.currency === 'CURRENCY_USD',
          )!
          expect(usd, 'client USD trading account exists').to.not.equal(undefined)
          cy.wrap(usd.id as string).as('usdAcctId')
        }),
    )

    // 1 MSFT (~$450 notional, IMC ~ $250) on a 300k-USD account ≫ IMC,
    // alongside an active seeded loan — both S64 preconditions hold.
    cy.get<string>('@clientTok').then((tok) =>
      cy.get<string>('@msftId').then((secId) =>
        cy.get<string>('@usdAcctId').then((acctId) =>
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
                quantity: 1,
                margin: true,
              },
              failOnStatusCode: false,
            })
            .then((r) => {
              expect(r.status, 'margin BUY accepted (200)').to.eq(200)
              expect(r.body.order.margin, 'margin flag persisted').to.eq(true)
              // Clients auto-approve regardless of limit (no actuary
              // limit gate); status should be APPROVED.
              expect(r.body.order.status).to.match(/APPROVED/)
            }),
        ),
      ),
    )
  })
})
