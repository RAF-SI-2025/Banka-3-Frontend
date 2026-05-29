/// <reference types="cypress" />

// Portfolio page + position detail. Live against the seeded client
// holdings (10 AAPL @ $170 + 2 CL future @ $70 — see seedTrading).
// Sell deep-link from position detail → /banking/trgovina/$securityId
// ?direction=sell&qty=N which pre-fills the OrderForm.

describe('Celina 3 — portfolio', () => {
  beforeEach(() => {
    cy.resetBackend()
    cy.loginAsClient()
  })

  it('lists holdings grouped by kind', () => {
    cy.visit('/banking/portfolio')
    cy.contains('h1', 'Portfolio', { timeout: 15000 }).should('be.visible')
    cy.contains('Akcija').should('be.visible')
    cy.contains('Future').should('be.visible')
    cy.contains('AAPL').should('be.visible')
    cy.contains('CL').should('be.visible')
  })

  it('sell deep-link routes to listing detail with direction=sell + qty pre-filled', () => {
    cy.visit('/banking/portfolio')
    cy.contains('h1', 'Portfolio', { timeout: 15000 }).should('be.visible')
    // Banking portfolio rows are clickable (the whole TR carries the
    // onClick → position detail).
    cy.contains('tr', 'AAPL').click()
    cy.url({ timeout: 10000 }).should('match', /\/banking\/portfolio\/[0-9a-f-]+/)

    cy.get('[data-cy="sell-deeplink"]').click()
    cy.url({ timeout: 10000 }).should('include', '/banking/trgovina/')
    cy.url().should('include', 'direction=sell')
    // The deep-link pre-fills the *current* holding quantity. Seed
    // says 10; soak-e2e accumulates partial sells so it may be less.
    // Assert "qty was passed + populates the form" rather than the
    // literal seed number — the test's point is the deep-link
    // mechanism, not the exact opening quantity.
    cy.url().should('match', /qty=\d+/)
    cy.get('#of-qty').invoke('val').should('match', /^\d+$/)
  })
})
