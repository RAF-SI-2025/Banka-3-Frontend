/// <reference types="cypress" />

// FE-14: exchange catalog admin (spec p.39 testing toggle).
// Live against the seeded XNYS / XNAS / XBEL exchanges:
//   - admin sees the exchanges table
//   - "Forsiraj zatvoreno" flips the badge to "Forsiran zatvoren"
//   - "Forsiraj after-hours" flips the badge to "Forsiran after-hours"
//   - "Vrati na raspored" clears the override badge
//   - non-admin (supervisor) cannot reach /portal/berze
//
// The single-flip happy path is also covered by exchange-halt.cy.ts;
// this spec adds the full state cycle + the negative supervisor case.

describe('Celina 3 — portal berze (admin)', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('lists exchanges and reflects override flips', () => {
    cy.loginAsAdmin()
    cy.visit('/portal/berze')
    cy.contains('h1', 'Berze', { timeout: 15000 }).should('be.visible')

    cy.get('[data-cy="exchange-row-XNYS"]').should('be.visible')
    cy.get('[data-cy="exchange-row-XLON"]').should('be.visible')
    cy.get('[data-cy="exchange-row-XBEL"]').should('be.visible')

    cy.get('[data-cy="force-closed-XNYS"]').click()
    cy.get('[data-cy="exchange-status-XNYS"]', { timeout: 8000 }).should('contain', 'Forsiran zatvoren')

    cy.get('[data-cy="force-after-hours-XNYS"]').click()
    cy.get('[data-cy="exchange-status-XNYS"]', { timeout: 8000 }).should('contain', 'Forsiran after-hours')

    cy.get('[data-cy="clear-override-XNYS"]').click()
    cy.get('[data-cy="exchange-status-XNYS"]', { timeout: 8000 }).should('not.contain', 'Forsiran')
  })

  it('non-admin supervisor cannot reach /portal/berze', () => {
    cy.loginAsSupervisor()
    cy.visit('/portal/berze')
    cy.location('pathname', { timeout: 10000 }).should('eq', '/portal')
  })
})
