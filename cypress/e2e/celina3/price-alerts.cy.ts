/// <reference types="cypress" />

// Price alerts (todoSpec C3 S26-S29). Live against the seeded c3 stack.
//
// The alert control (src/components/trading/PriceAlertCard.tsx) embeds
// on every tradable security's detail page. A user sets a one-shot
// threshold (ABOVE / BELOW); a backend sweep emails them once on the
// crossing and deactivates the alert. The actual fire is cron-driven and
// not Cypress-drivable; we plant the crossing via cy.pgSql to assert the
// deactivated-row display, and otherwise exercise create/list/validation.
//
// resetBackend truncates trading.* so each test starts with no alerts.

function openAaplDetail() {
  cy.visit('/banking/trgovina')
  cy.contains('h1', 'Trgovina', { timeout: 15000 }).should('be.visible')
  cy.get('[data-cy="filter-search"]').type('AAPL')
  cy.contains('tr', 'AAPL', { timeout: 10000 }).click()
  cy.url({ timeout: 10000 }).should('match', /\/banking\/trgovina\/[0-9a-f-]+/)
}

describe('Celina 3 — price alerts (S26-S29)', () => {
  beforeEach(() => {
    cy.resetBackend()
    cy.clearExchangeOverride('XNYS')
    cy.loginAsClient()
  })

  it('S26-S27 — creates an ABOVE alert and an active BELOW alert, both listed', () => {
    openAaplDetail()

    cy.get('[data-cy="price-alert-card"]').within(() => {
      // S26: ABOVE threshold. AAPL ASK is ~190.55; pick a far threshold
      // so the alert never trips during the test.
      cy.get('#pa-condition').select('PRICE_ALERT_CONDITION_ABOVE')
      cy.get('[data-cy="price-alert-threshold"]').clear().type('500')
      cy.get('[data-cy="price-alert-submit"]').click()

      // S27: BELOW threshold on the same security.
      cy.get('#pa-condition').select('PRICE_ALERT_CONDITION_BELOW')
      cy.get('[data-cy="price-alert-threshold"]').clear().type('10')
      cy.get('[data-cy="price-alert-submit"]').click()

      // Both show as active in the list (active alerts render a "Otkaži"
      // affordance; deactivated ones render "(aktiviran)" instead).
      cy.get('[data-cy="price-alert-list"]', { timeout: 10000 })
        .find('li')
        .should('have.length', 2)
      cy.get('[data-cy="price-alert-list"]').should('contain', 'pređe iznad')
      cy.get('[data-cy="price-alert-list"]').should('contain', 'padne ispod')
      cy.contains('(aktiviran)').should('not.exist')
    })
  })

  it('S28 — rejects a non-positive threshold (client-side validation)', () => {
    openAaplDetail()
    cy.get('[data-cy="price-alert-card"]').within(() => {
      cy.get('[data-cy="price-alert-threshold"]').clear().type('0')
      cy.get('[data-cy="price-alert-submit"]').click()
      // Zod refine: "Prag mora biti veći od nule".
      cy.contains('Prag mora biti veći od nule').should('be.visible')
      // No alert row was created.
      cy.get('[data-cy="price-alert-list"]').should('not.exist')
    })
  })

  it('S29 — a triggered alert shows as deactivated (crossing planted via DB)', () => {
    openAaplDetail()
    cy.get('[data-cy="price-alert-card"]').within(() => {
      cy.get('#pa-condition').select('PRICE_ALERT_CONDITION_ABOVE')
      cy.get('[data-cy="price-alert-threshold"]').clear().type('500')
      cy.get('[data-cy="price-alert-submit"]').click()
      cy.get('[data-cy="price-alert-list"]', { timeout: 10000 }).find('li').should('have.length', 1)
    })

    // SKIP (cron-driven): the price-cross sweep that flips is_active and
    // emails the user is a scheduler job, not Cypress-drivable. Simulate
    // the post-sweep state directly: deactivate the row + stamp a
    // triggered_at, exactly as the sweep would.
    cy.pgSql(`
      UPDATE "trading".price_alerts
         SET is_active = false, triggered_at = now()
       WHERE id = (SELECT id FROM "trading".price_alerts ORDER BY created_at DESC LIMIT 1)
    `)

    cy.reload()
    cy.get('[data-cy="price-alert-card"]').within(() => {
      // The deactivated alert renders the "(aktiviran)" marker and no
      // longer offers an "Otkaži" affordance.
      cy.contains('(aktiviran)', { timeout: 10000 }).should('be.visible')
      cy.contains('button', 'Otkaži').should('not.exist')
    })
  })
})
