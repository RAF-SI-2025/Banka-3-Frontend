/// <reference types="cypress" />

// FE-15: live spec for the spec p.39 exchange-override admin tool.
// Drives the FE-14 portal page end-to-end against the seeded XNYS row.
// Force-close → status badge flips, then "Vrati na raspored" clears
// the override and the badge reflects the resolved is_open from the
// schedule.
//
// Note: the trading service uses `override_open` to compute is_open
// and the after-hours flag, but does NOT reject order placement on a
// closed exchange — the spec only mandates after-hours fill slowdown
// (p.56), so we don't assert order rejection here.

describe('Celina 3 (live) — admin force-closes XNYS i vraća na raspored', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('flips XNYS to forced-closed and back to schedule', () => {
    cy.loginAsAdmin()
    cy.visit('/portal/berze')
    cy.contains('h1', 'Berze', { timeout: 15000 }).should('be.visible')

    cy.get('[data-cy="exchange-row-XNYS"]').should('be.visible')
    cy.get('[data-cy="force-closed-XNYS"]').click()
    cy.get('[data-cy="exchange-status-XNYS"]', { timeout: 8000 }).should('contain', 'Forsiran zatvoren')

    cy.get('[data-cy="clear-override-XNYS"]').click()
    cy.get('[data-cy="exchange-status-XNYS"]', { timeout: 8000 })
      .should('not.contain', 'Forsiran')
  })
})
