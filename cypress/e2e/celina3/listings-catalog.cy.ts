/// <reference types="cypress" />

// Banka2025-E2E.pdf, "Berze i hartije":
//   - kataloške tabele po vrsti hartije (Akcije / Futures / Forex / Opcije)
//   - per-kind columns, tab switching, sort flip
//
// Live against the seeded catalog (5 stocks, 1 future, 1 forex, 1 option).

describe('Celina 3 — listings catalog', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('renders all four tabs with seeded rows + per-kind columns', () => {
    cy.loginAsAdmin()
    cy.visit('/portal/trgovina')

    cy.contains('h1', 'Trgovina', { timeout: 15000 }).should('be.visible')
    cy.contains('th', 'Tržišna kap.').should('be.visible')
    cy.contains('td', 'AAPL').should('be.visible')

    cy.get('[data-cy="tab-SECURITY_TYPE_FUTURE"]').click()
    cy.contains('th', 'Veličina ugovora', { timeout: 10000 }).should('be.visible')
    cy.contains('td', 'CL').should('be.visible')

    cy.get('[data-cy="tab-SECURITY_TYPE_FOREX"]').click()
    cy.contains('th', 'Likvidnost', { timeout: 10000 }).should('be.visible')
    cy.contains('td', 'EUR/USD').should('be.visible')

    cy.get('[data-cy="tab-SECURITY_TYPE_OPTION"]').click()
    cy.contains('th', 'Strike', { timeout: 10000 }).should('be.visible')
    cy.contains('td', 'AAPL-C-190').should('be.visible')
  })

  it('flips the sort direction and re-queries', () => {
    cy.loginAsAdmin()

    // Watch the catalog query so we can assert sortDesc transitions.
    cy.intercept('GET', /\/api\/v1\/securities\?.*type=SECURITY_TYPE_STOCK.*/).as('listStocks')

    cy.visit('/portal/trgovina')
    cy.wait('@listStocks').its('request.url').should('include', 'sortDesc=true')

    cy.get('[data-cy="filter-sort-dir"]').click()
    cy.wait('@listStocks').its('request.url').should('include', 'sortDesc=false')
  })
})
