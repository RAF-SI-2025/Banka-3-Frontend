/// <reference types="cypress" />

// spec/C3-tests.pdf — Scenario 40: Provizija Limit ordera - naplačuje
// se manji iznos
//
//   Given aktuar kreira Limit BUY order čija je početna cena 100$
//   When  order se izvrši
//   Then  provizija iznosi min(24% * početna cena, 12$)
//   And   iznos provizije se prebacuje na bankin račun u valuti
//         hartije
//
// The cap kicks in for any notional ≥ $50 (since 24% × $50 = $12).
// We fill one MSFT share at its ~$450.20 ask, so commission = $12 (the
// cap), and verify the bank's USD forex_book account is debited
// notional + $12 exactly once the order goes Done. Bypasses the order
// form UI on purpose — S40 is a backend-math invariant; FE coverage of
// the form lives in order-place / order-validation specs.

const FOREX_BOOK_OWNER_ID = '00000000-0000-0000-0000-000000000020'
const AGENT_EMAIL = 'aktuar@banka.local'
const AGENT_PASSWORD = 'Aktuar123!'
const ADMIN_EMAIL = 'admin@banka.local'
const ADMIN_PASSWORD = 'Admin123!'
const LIMIT_COMMISSION_CAP = 12 // spec p.55-56

function gatewayLogin(email: string, password: string): Cypress.Chainable<string> {
  return cy
    .request({
      method: 'POST',
      url: '/api/v1/auth/login',
      body: { email, password },
    })
    .then((r) => r.body.accessToken as string)
}

interface ForexBookUSD {
  id: string
  balance: number
}

function forexBookUSD(token: string): Cypress.Chainable<ForexBookUSD> {
  return cy
    .request({
      url: `/api/v1/accounts?ownerClientId=${FOREX_BOOK_OWNER_ID}&kind=ACCOUNT_KIND_FOREX_BOOK`,
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => {
      const accounts = (r.body.accounts ?? []) as { currency?: string; id?: string; balance?: string }[]
      const usd = accounts.find((a) => a.currency === 'CURRENCY_USD')
      expect(usd, 'bank USD forex_book account exists').to.not.equal(undefined)
      return { id: usd!.id as string, balance: Number(usd!.balance ?? '0') }
    })
}

describe('Celina 3 — Provizija Limit ordera (S40)', () => {
  beforeEach(() => {
    cy.resetBackend()
    // soak-e2e: resetBackend is a no-op past spec #1, so the
    // agent.usedLimit accumulated by earlier specs can push this
    // ~530k-RSD-notional limit BUY to PENDING — derail the
    // commission assertion below.
    cy.resetAgentLimit()
  })

  it('Limit BUY provizija = min(24% × notional, $12) — cap charged to bank USD forex_book', () => {
    gatewayLogin(AGENT_EMAIL, AGENT_PASSWORD).as('agentTok')
    gatewayLogin(ADMIN_EMAIL, ADMIN_PASSWORD).as('adminTok')

    // Resolve MSFT security id (USD-listed, comfortably ≥ $50 so the
    // commission cap is the deterministic outcome).
    cy.get<string>('@agentTok').then((tok) =>
      cy
        .request({
          url: '/api/v1/listings?pageSize=100',
          headers: { Authorization: `Bearer ${tok}` },
        })
        .then((r) => {
          const items = (r.body.items ?? []) as { security?: { id?: string; ticker?: string } }[]
          const msft = items.find((x) => x.security?.ticker === 'MSFT')
          expect(msft, 'MSFT seeded').to.not.equal(undefined)
          cy.wrap(msft!.security!.id as string).as('msftId')
        }),
    )

    // Snapshot bank USD forex_book balance + capture its account id
    // (the actuary trades through this account per the FE
    // OrderForm.tsx forex_book pick).
    cy.get<string>('@adminTok').then((adminTok) =>
      forexBookUSD(adminTok).then((acct) => {
        cy.wrap(acct.id).as('forexUsdId')
        cy.wrap(acct.balance).as('beforeBal')
      }),
    )

    // Place the Limit BUY at $500 (well above MSFT's $450.20 ask) so
    // it fills at the ask on the first cadence tick.
    cy.get<string>('@agentTok').then((agentTok) =>
      cy.get<string>('@msftId').then((secId) =>
        cy.get<string>('@forexUsdId').then((acctId) =>
          cy
            .request({
              method: 'POST',
              url: '/api/v1/orders',
              headers: { Authorization: `Bearer ${agentTok}` },
              body: {
                securityId: secId,
                accountId: acctId,
                direction: 'DIRECTION_BUY',
                orderType: 'ORDER_TYPE_LIMIT',
                quantity: 1,
                limitPrice: '500.00',
              },
            })
            .then((r) => {
              expect(r.status, 'order accepted').to.eq(200)
              expect(r.body.order.orderType).to.eq('ORDER_TYPE_LIMIT')
              cy.wrap(r.body.order.id as string).as('orderId')
            }),
        ),
      ),
    )

    // Poll until isDone. Limit BUY at $500 ≥ ask $450.20 fills on the
    // next execution tick (default 10 s). 40 × 3 s = 120 s ceiling.
    cy.get<string>('@orderId').then((orderId) => {
      function poll(remaining: number): void {
        if (remaining <= 0) throw new Error('Limit BUY did not fill')
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
      poll(40)
    })

    // The bank's USD forex_book debit should equal notional + commission
    // = ~$450.20 + $12 (the cap). Allow a small tolerance for any
    // intraday ask drift — the cap is the assertion, not the fill price.
    cy.get<string>('@adminTok').then((adminTok) =>
      cy.get<number>('@beforeBal').then((beforeBal) =>
        forexBookUSD(adminTok).then((after) => {
          const debit = beforeBal - after.balance
          const seededAsk = 450.2
          const expected = seededAsk + LIMIT_COMMISSION_CAP
          expect(debit, `debit ≈ notional + commission cap ($${LIMIT_COMMISSION_CAP})`).to.be.closeTo(
            expected,
            0.5,
          )
        }),
      ),
    )
  })
})
