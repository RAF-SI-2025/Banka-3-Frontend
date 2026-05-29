/// <reference types="cypress" />

// spec/C3-tests.pdf — Scenario 66: AON oznaka se čuva uz order
//
//   Given korisnik uključi All or None pri kreiranju ordera
//   When  potvrdi order
//   Then  order se čuva sa AON oznakom
//   And   UI prikazuje da order mora biti izvršen u celini
//
// Verified two ways: the confirm dialog suffix shows "· AON" (the FE
// surfaces the flag in the pending-order summary at OrderForm.tsx:507)
// and the persisted order row returned by GET /orders/{id} has
// allOrNone=true.

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

describe('Celina 3 — AON oznaka se čuva uz order (S66)', () => {
  beforeEach(() => {
    cy.resetBackend()
    cy.resetAgentLimit() // soak-e2e safety
  })

  it('AON toggle survives confirm — order row carries allOrNone=true', () => {
    cy.loginAsAgent()
    cy.visit('/portal/trgovina')
    cy.contains('h1', 'Trgovina', { timeout: 30000 }).should('be.visible')

    cy.get('[data-cy="filter-search"]').clear().type('MSFT')
    cy.contains('tr', 'MSFT', { timeout: 15000 }).click()
    cy.url({ timeout: 15000 }).should('match', /\/portal\/trgovina\/[0-9a-f-]+/)

    cy.get('#order-form', { timeout: 15000 }).within(() => {
      cy.get('#of-qty').clear().type('1')
      // Source account: actuary trades through bank's forex_book USD
      // (FE forces the picker per OrderForm.tsx ownerForList branch).
      cy.get('#of-acct')
        .find('option')
        .contains('USD')
        .then((opt) => cy.get('#of-acct').select(opt.attr('value') as string))
      // Flip the AON checkbox — registered as `allOrNone` per
      // OrderForm.tsx:354.
      cy.contains('label', 'AON').find('input[type="checkbox"]').check()
      cy.get('[data-cy="order-submit"]').click()
    })

    // Confirm dialog renders "· AON" suffix (OrderForm.tsx:507).
    cy.get('[data-cy="order-confirm-dialog"]', { timeout: 15000 })
      .should('be.visible')
      .and('contain', 'AON')
    cy.get('[data-cy="order-confirm-submit"]').click()

    // Dialog closes on success — the redirect to the list page is
    // out-of-scope for this assertion; we go look up the order by API.
    cy.get('[data-cy="order-confirm-dialog"]').should('not.exist')

    // Fetch the most recent order for the agent and verify the persisted
    // allOrNone flag. The supervisor view exposes every order.
    gatewayLogin(AGENT_EMAIL, AGENT_PASSWORD).then((tok) =>
      cy
        .request({
          url: '/api/v1/orders?pageSize=5',
          headers: { Authorization: `Bearer ${tok}` },
        })
        .then((r) => {
          const orders = (r.body.orders ?? []) as { allOrNone?: boolean; quantity?: number }[]
          expect(orders.length, 'list returns the freshly placed order').to.be.greaterThan(0)
          const fresh = orders[0]
          expect(fresh.allOrNone, 'allOrNone persisted on the order row').to.eq(true)
        }),
    )
  })
})
