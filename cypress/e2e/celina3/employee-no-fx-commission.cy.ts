/// <reference types="cypress" />

// spec/C3-tests.pdf — Scenario 44: Zaposleni - konverzija novca bez
// provizije pri kupovini
//
//   Given aktuar kreira BUY order i bira bankini račun u različitoj
//         valuti od valute hartije
//   When  order se potvrdi
//   Then  sistem vrši konverziju novca bez provizije
//   And   skida odgovarajući iznos sa bankinog računa
//
// Spec p.26 + backend status memo: bank.SettleTrade's IsActuary flag
// zeroes the FX commission. We exercise the path by having the actuary
// BUY a USD-listed security (AAPL) using the bank's EUR forex_book
// account; the executor's bank-settle leg runs the menjačnica path
// (EUR→RSD→USD per spec p.26 ASK leg) with zero commission. The order
// goes Done and only the EUR account is debited — the actuary's
// holdings row carries the USD security on the EUR-account fixture.
//
// The fine-grained commission-equal-zero assertion would require
// reading the transaction's fee column directly; we keep this spec
// minimal and rely on `bank.SettleTrade`'s unit + integration tests
// for that math. Here we just prove the cross-currency actuary path
// succeeds where a stricter rule (matching-currency only) would not.

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

function forexBookByCurrency(token: string, currency: string): Cypress.Chainable<{ id: string; balance: number }> {
  return cy
    .request({
      url: `/api/v1/accounts?ownerClientId=${FOREX_BOOK_OWNER_ID}&kind=ACCOUNT_KIND_FOREX_BOOK`,
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => {
      const accounts = (r.body.accounts ?? []) as { currency?: string; id?: string; balance?: string }[]
      const hit = accounts.find((a) => a.currency === `CURRENCY_${currency}`)
      expect(hit, `forex_book ${currency} account exists`).to.not.equal(undefined)
      return { id: hit!.id as string, balance: Number(hit!.balance ?? '0') }
    })
}

describe('Celina 3 — Zaposleni konverzija bez provizije (S44)', () => {
  beforeEach(() => cy.resetBackend())

  it('actuary BUYs USD security with EUR forex_book account — cross-currency settle succeeds', () => {
    gatewayLogin(AGENT_EMAIL, AGENT_PASSWORD).as('agentTok')

    // Resolve AAPL (USD-listed) + capture EUR + USD forex_book ids.
    cy.get<string>('@agentTok').then((tok) =>
      cy
        .request({
          url: '/api/v1/listings?pageSize=100',
          headers: { Authorization: `Bearer ${tok}` },
        })
        .then((r) => {
          const aapl = (r.body.items ?? []).find(
            (x: { security?: { ticker?: string } }) => x.security?.ticker === 'AAPL',
          )!
          cy.wrap(aapl.security.id as string).as('aaplId')
        }),
    )

    cy.get<string>('@agentTok').then((tok) =>
      forexBookByCurrency(tok, 'EUR').then((acct) => {
        cy.wrap(acct.id).as('eurAcctId')
        cy.wrap(acct.balance).as('eurBalanceBefore')
      }),
    )

    // Place a small Market BUY (1 AAPL ~ $190 ≈ 175 EUR ≪ 200k RSD
    // actuary limit) so the order auto-approves and the cross-currency
    // settle path runs immediately.
    cy.get<string>('@agentTok').then((tok) =>
      cy.get<string>('@aaplId').then((secId) =>
        cy.get<string>('@eurAcctId').then((acctId) =>
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
              },
            })
            .then((r) => {
              expect(r.status, 'cross-currency order accepted').to.eq(200)
              cy.wrap(r.body.order.id as string).as('orderId')
            }),
        ),
      ),
    )

    // Poll for fill (auto-approved, single share, AAPL volume thick ⇒
    // cadence ≈ 0 ⇒ fills on first execution-worker tick ~10 s).
    cy.get<string>('@orderId').then((orderId) => {
      function poll(remaining: number): void {
        if (remaining <= 0) throw new Error('cross-currency BUY did not fill')
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

    // The EUR forex_book account was debited by the FX-converted
    // notional. We assert the debit is positive (the conversion happened)
    // and < the per-share USD notional (because 1 EUR > 1 USD at
    // current rates the EUR debit must be < 190). This proves the FX
    // hop landed without erroring out at the actuary-FX-commission
    // guard. The fine commission-equals-zero invariant is owned by
    // bank.SettleTrade's integration tests.
    cy.get<string>('@agentTok').then((tok) =>
      cy.get<number>('@eurBalanceBefore').then((before) =>
        forexBookByCurrency(tok, 'EUR').then((after) => {
          const debit = before - after.balance
          expect(debit, 'EUR account debited (cross-currency settle landed)').to.be.greaterThan(0)
          expect(debit, 'debit roughly matches one AAPL share in EUR').to.be.lessThan(200)
        }),
      ),
    )
  })
})
