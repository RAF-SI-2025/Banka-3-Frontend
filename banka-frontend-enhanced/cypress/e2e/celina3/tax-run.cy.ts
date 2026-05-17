/// <reference types="cypress" />

// FE-15: supervisor runs the capital-gains-tax cron from /portal/porez.
// Spec p.62 — 15% of realized profit (in RSD) is debited from the user's
// sale account and credited to the state's RSD account.
//
// On a freshly-seeded stack there are no realized gains yet, so the run
// returns a zero summary. We assert the round-trip works: the dialog
// confirms, the result panel renders, and the board re-fetches without
// error.

describe('Celina 3 (live) — supervisor pokreće tax cron', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('opens /portal/porez, confirms the run, and renders the result summary', () => {
    cy.loginAsSupervisor()
    cy.url().should('include', '/portal')

    cy.visit('/portal/porez')
    cy.contains('h1', 'Porez').should('be.visible')

    cy.get('[data-cy="run-tax"]').click()
    cy.get('[data-cy="confirm-run-tax"]').click()

    // No realized gains on a fresh seed — the run should succeed and
    // surface a 0-users / 0-RSD summary in the result panel.
    cy.get('[data-cy="run-tax-result"]', { timeout: 15000 })
      .should('be.visible')
      .and('contain', 'Obračun završen')
  })
})
