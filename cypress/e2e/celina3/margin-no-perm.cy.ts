/// <reference types="cypress" />

// spec/C3-tests.pdf — Scenario 63: Margin order nije dozvoljen bez
// permisije
//
//   Given korisnik nema margin permisiju
//   When  pokuša da uključi Margin pri kreiranju ordera
//   Then  sistem ne dozvoljava nastavak
//   And   prikazuje odgovarajuću poruku
//
// FE realisation: OrderForm.tsx only renders the Margin toggle when
// the principal has `trading.margin` permission (`canMargin` gate at
// line 357: `{canMargin && (<label data-cy="margin-toggle">…)}`). A
// klijent's JWT carries `trading.client` only, so the toggle is
// absent — the spec's "system blocks the attempt" is realised by the
// control not being reachable. We assert the toggle isn't in the DOM
// and that the order form is otherwise present (so the negative case
// isn't masked by the form simply not rendering).

describe('Celina 3 — Margin order requires permission (S63)', () => {
  beforeEach(() => cy.resetBackend())

  it('client without trading.margin sees no Margin toggle on the order form', () => {
    cy.loginAsClient()
    cy.visit('/banking/trgovina')
    cy.contains('h1', 'Trgovina', { timeout: 30000 }).should('be.visible')

    // Open AAPL detail — has an order form embedded.
    cy.get('[data-cy="filter-search"]').clear().type('AAPL')
    cy.contains('tr', 'AAPL', { timeout: 15000 }).click()
    cy.url({ timeout: 15000 }).should('match', /\/banking\/trgovina\/[0-9a-f-]+/)

    cy.get('#order-form', { timeout: 15000 }).should('be.visible').within(() => {
      // AON toggle stays visible to every trader (FE doesn't gate it),
      // confirming the form rendered — Margin is the only control gated
      // by trading.margin.
      cy.contains('AON').should('be.visible')
      cy.get('[data-cy="margin-toggle"]').should('not.exist')
      // The info-text under the Margin section is rendered behind the
      // same `canMargin` gate, so it must also be absent.
      cy.contains('Margin nalog').should('not.exist')
    })
  })
})
