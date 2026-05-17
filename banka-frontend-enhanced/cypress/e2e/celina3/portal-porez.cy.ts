/// <reference types="cypress" />

// FE-13: tax board portal. Live against the seeded realized_gains
// rows (one positive ≈ 10018 RSD ⇒ 15% tax ≈ 1503 RSD unpaid + one
// loss row that contributes 0 tax).

describe('Celina 3 — portal porez (supervisor)', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('shows the board with the seeded client unpaid row', () => {
    cy.loginAsSupervisor()
    cy.visit('/portal/porez')
    cy.contains('h1', 'Porez na kapitalni dobitak', { timeout: 15000 }).should('be.visible')

    // Seed plants 2 realized rows for the client. Sum of positive
    // gain_rsd is ~10018 RSD; 15% tax ≈ 1502.70 RSD displayed as
    // "1.502,70" (sr-RS digit grouping).
    cy.contains('Test Klijent', { timeout: 10000 }).should('be.visible')
    cy.contains('1.502,70').should('be.visible')
  })

  it('runs the tax job through the confirm dialog and shows the summary', () => {
    cy.loginAsSupervisor()
    cy.visit('/portal/porez')
    cy.contains('h1', 'Porez na kapitalni dobitak', { timeout: 15000 }).should('be.visible')

    cy.get('[data-cy="run-tax"]').click()
    cy.get('[data-cy="confirm-run-tax"]').click()

    cy.get('[data-cy="run-tax-result"]', { timeout: 15000 })
      .should('contain', '1 korisnika')
      .and('contain', '1.502,70')
  })

  it('detail page shows standings + realized P&L; loss row renders 0 RSD tax', () => {
    cy.loginAsSupervisor()
    cy.visit('/portal/porez')
    cy.contains('Test Klijent', { timeout: 15000 }).click()
    cy.url({ timeout: 10000 }).should('match', /\/portal\/porez\/[0-9a-f-]+/)

    cy.get('[data-cy="standings-unpaid"]', { timeout: 10000 }).should('contain', '1.502,70')
    cy.get('[data-cy="standings-paid-ytd"]').should('contain', '0,00')

    // Two seeded P&L rows: gain (positive tax) + loss (0 tax).
    cy.contains('tr', 'MSFT').should('be.visible')
    // Loss row's tax cell shows 0,00 regardless of taxAmountRsd.
    cy.contains('-4.030,32').parents('tr').within(() => {
      cy.get('[data-cy="cell-tax"]').should('contain', '0,00')
    })
  })

  it('non-supervisor agent cannot reach /portal/porez', () => {
    cy.loginAsAgent()
    cy.visit('/portal/porez')
    cy.location('pathname', { timeout: 10000 }).should('eq', '/portal')
  })
})
