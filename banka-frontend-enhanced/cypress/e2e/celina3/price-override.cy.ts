/// <reference types="cypress" />

// Spec p.37: admin manually corrects listing price/ask/bid. Live —
// admin opens the seeded AAPL listing detail, submits new prices,
// and the dialog closes after the PUT lands.

describe('Celina 3 — admin price override', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  function openAaplDetail() {
    cy.loginAsAdmin()
    cy.visit('/portal/trgovina')
    cy.contains('h1', 'Trgovina', { timeout: 15000 }).should('be.visible')
    cy.get('[data-cy="filter-search"]').clear().type('AAPL')
    cy.contains('tr', 'AAPL', { timeout: 10000 }).click()
    cy.url({ timeout: 10000 }).should('match', /\/portal\/trgovina\/[0-9a-f-]+/)
  }

  it('admin opens the dialog, submits new prices and closes', () => {
    openAaplDetail()
    cy.get('[data-cy="open-price-override"]').click()

    cy.get('#po-price').clear().type('185.00')
    cy.get('#po-ask').clear().type('185.20')
    cy.get('#po-bid').clear().type('184.80')
    cy.contains('button', 'Sačuvaj').click()

    // Dialog closes on success.
    cy.get('#po-price', { timeout: 10000 }).should('not.exist')

    // New price visible on the detail card after invalidation.
    cy.contains('185,00', { timeout: 10000 }).should('be.visible')
  })

  it('rejects non-numeric input client-side', () => {
    openAaplDetail()
    cy.get('[data-cy="open-price-override"]').click()

    cy.get('#po-price').clear().type('abc')
    cy.contains('button', 'Sačuvaj').click()
    cy.contains('Mora biti broj.').should('be.visible')
  })
})
