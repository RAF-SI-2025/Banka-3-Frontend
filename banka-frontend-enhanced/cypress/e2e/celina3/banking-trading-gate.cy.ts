/// <reference types="cypress" />

// Banking surface gating: clients without trading.client should NOT
// see Portfolio/Trgovina sidebar links or the home Trgovina tile.
// Clients with trading.client should see them all.
//
// Live against the seeded klijent@banka.local (has trading.client) and
// klijent3@banka.local (seedClient strips trading.client right after
// it plants the row — see seed/main.go).

function loginAsNonTradingClient() {
  cy.visit('/login')
  cy.findByLabelText('Email', { timeout: 15000 }).clear().type('klijent3@banka.local')
  cy.findByLabelText('Lozinka').clear().type('Klijent123!')
  cy.findByRole('button', { name: /Prijavi se/ }).click()
  cy.url({ timeout: 10000 }).should('not.include', '/login')
}

describe('Celina 3 — banking trading gate', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('client without trading.client sees no trading affordances', () => {
    loginAsNonTradingClient()
    cy.visit('/banking')
    cy.contains('Plaćanja', { timeout: 15000 }).should('be.visible')
    cy.contains('Trgovina').should('not.exist')
    cy.contains('Portfolio').should('not.exist')
    cy.get('[data-cy="trading-tile"]').should('not.exist')
  })

  it('client with trading.client sees Portfolio + Trgovina nav and tile', () => {
    cy.loginAsClient()
    cy.visit('/banking')
    cy.contains('Trgovina', { timeout: 15000 }).should('be.visible')
    cy.contains('Portfolio').should('be.visible')
    cy.get('[data-cy="trading-tile"]').should('be.visible')
  })
})
