/// <reference types="cypress" />

// "Moji nalozi" — list view at /banking/trgovina/nalozi.
// Detail page exposes a Cancel button only when status ∈ {pending,
// approved} and the order is not done/cancelled.
//
// Live: client places a deep-out-of-the-money limit BUY on AAPL (limit
// $1 ⟹ never fills) so the order stays "approved/Otvoren" for the
// duration of the test. The cancel flow flips the status to cancelled.

function placeLimitOrder() {
  cy.loginAsClient()
  cy.visit('/banking/trgovina')
  cy.contains('h1', 'Trgovina', { timeout: 15000 }).should('be.visible')
  cy.contains('tr', 'AAPL', { timeout: 10000 }).click()
  cy.url({ timeout: 10000 }).should('match', /\/banking\/trgovina\/[0-9a-f-]+/)

  cy.get('#of-qty').clear().type('1')
  cy.get('#of-limit').clear().type('1')
  cy.get('#of-acct')
    .find('option')
    .contains('USD')
    .then((opt) => cy.get('#of-acct').select(opt.attr('value') as string))
  cy.get('[data-cy="order-submit"]').click()
  cy.get('[data-cy="order-confirm-submit"]').click()
}

describe('Celina 3 — Moji nalozi', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('lists the placed order with a status badge', () => {
    placeLimitOrder()
    cy.visit('/banking/trgovina/nalozi')
    cy.contains('h1', 'Moji nalozi', { timeout: 15000 }).should('be.visible')
    cy.contains('tr', 'AAPL', { timeout: 15000 }).within(() => {
      // Limit order at $1 auto-approves (clients aren't subject to
      // the agent daily-limit gate); the worker never fills it
      // (ask ≤ limit) so the row stays "Odobren".
      cy.contains('Odobren').should('be.visible')
    })
  })

  it('cancel flips status; affordance disappears after reload', () => {
    placeLimitOrder()
    cy.visit('/banking/trgovina/nalozi')
    cy.contains('h1', 'Moji nalozi', { timeout: 15000 }).should('be.visible')
    // Row onClick navigates to /banking/trgovina/nalozi/$orderId.
    cy.contains('tr', 'AAPL', { timeout: 15000 }).click()

    cy.url({ timeout: 10000 }).should('match', /\/banking\/trgovina\/nalozi\/[0-9a-f-]+/)
    cy.get('[data-cy="cancel-order"]', { timeout: 10000 }).should('be.visible').click()
    cy.contains(/otkazan/i, { timeout: 10000 }).should('be.visible')

    // Reload and confirm the cancel button is gone now that the
    // order is no longer in {pending, approved}.
    cy.reload()
    cy.get('[data-cy="cancel-order"]').should('not.exist')
  })
})
