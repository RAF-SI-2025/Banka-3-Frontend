/// <reference types="cypress" />

// spec/C3-tests.pdf — Scenario 65: Margin order dozvoljen - sredstva
// na računu > Initial Margin Cost
//
//   Given korisnik ima margin permisiju
//   And   ima dovoljno sredstava na odabranom računu (sredstva > IMC)
//   When  uključi Margin i potvrdi order
//   Then  order je prihvaćen
//
// Spec p.46-48: Initial Margin Cost (IMC) = 1.1 × maintenance margin,
// maintenance margin per security type (stocks: 50% of mark value;
// futures: 10% of contract notional; options: 100% of premium). The
// supervisor is the natural fixture: trading.margin is in their seed
// permission bundle, and the bank's forex_book USD account (seeded at
// $1B) trivially clears any IMC. Margin=true must round-trip the
// service-layer guard `requireMargin` + the `MarginChecker` balance
// branch (spec p.55-56) without rejection.

const FOREX_BOOK_OWNER_ID = '00000000-0000-0000-0000-000000000020'
const SUPERVISOR_EMAIL = 'supervizor@banka.local'
const SUPERVISOR_PASSWORD = 'Supervizor123!'

function gatewayLogin(email: string, password: string): Cypress.Chainable<string> {
  return cy
    .request({
      method: 'POST',
      url: '/api/v1/auth/login',
      body: { email, password },
    })
    .then((r) => r.body.accessToken as string)
}

describe('Celina 3 — Margin order dozvoljen — sredstva > IMC (S65)', () => {
  beforeEach(() => cy.resetBackend())

  it('user with trading.margin + funds > IMC: Margin BUY order is accepted', () => {
    gatewayLogin(SUPERVISOR_EMAIL, SUPERVISOR_PASSWORD).as('supTok')

    // Resolve MSFT (USD-listed) + the USD forex_book account.
    cy.get<string>('@supTok').then((tok) =>
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
    cy.get<string>('@supTok').then((tok) =>
      cy
        .request({
          url: `/api/v1/accounts?ownerClientId=${FOREX_BOOK_OWNER_ID}&kind=ACCOUNT_KIND_FOREX_BOOK`,
          headers: { Authorization: `Bearer ${tok}` },
        })
        .then((r) => {
          const usd = (r.body.accounts ?? []).find(
            (a: { currency?: string }) => a.currency === 'CURRENCY_USD',
          )!
          cy.wrap(usd.id as string).as('usdAcctId')
        }),
    )

    // Place a Margin Market BUY for 1 MSFT — ~$450 notional, IMC ≈
    // 0.5 × $450 × 1.1 ≈ $250 ≪ $1B forex_book balance. Spec p.55
    // requires `funds > IMC` for the margin branch; this comfortably
    // satisfies it.
    cy.get<string>('@supTok').then((tok) =>
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
              expect(
                r.body.order.status,
                'auto-approved for supervisor',
              ).to.match(/APPROVED|PENDING/)
            }),
        ),
      ),
    )
  })
})
