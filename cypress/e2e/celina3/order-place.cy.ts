/// <reference types="cypress" />

// Banka2025-E2E.pdf, "Postavljanje naloga". Live against the seeded
// AAPL listing and the client's USD trading account.

function selectUsdAccount() {
  cy.get('#of-acct')
    .find('option')
    .contains('USD')
    .then((opt) => cy.get('#of-acct').select(opt.attr('value') as string))
}

function navigateToAaplDetail() {
  cy.visit('/banking/trgovina')
  cy.contains('h1', 'Trgovina', { timeout: 15000 }).should('be.visible')
  cy.contains('tr', 'AAPL', { timeout: 10000 }).click()
  cy.url({ timeout: 10000 }).should('match', /\/banking\/trgovina\/[0-9a-f-]+/)
}

describe('Celina 3 — order placement', () => {
  beforeEach(() => {
    cy.resetBackend()
    cy.loginAsClient()
  })

  it('client places a market BUY order', () => {
    navigateToAaplDetail()
    cy.get('#of-qty').clear().type('1')
    selectUsdAccount()
    cy.get('[data-cy="order-submit"]').click()

    // Spec p.56: confirmation dialog gates the actual submit.
    cy.get('[data-cy="order-confirm-dialog"]').should('be.visible')
    cy.get('[data-cy="order-confirm-submit"]').click()

    cy.visit('/banking/trgovina/nalozi')
    cy.contains('h1', 'Moji nalozi', { timeout: 15000 }).should('be.visible')
    cy.contains('tr', 'AAPL', { timeout: 15000 }).should('be.visible')
  })

  it('limit price routes through as LIMIT order', () => {
    navigateToAaplDetail()
    cy.get('#of-qty').clear().type('1')
    // Limit far below ASK so the worker never fills it; the order
    // stays "approved" or "pending" but the type is LIMIT.
    cy.get('#of-limit').clear().type('1')
    selectUsdAccount()
    cy.get('[data-cy="order-submit"]').click()
    cy.get('[data-cy="order-confirm-submit"]').click()

    cy.visit('/banking/trgovina/nalozi')
    cy.contains('tr', 'AAPL', { timeout: 15000 }).should('contain', 'Limit')
  })

  it('cancel in confirm dialog does not POST', () => {
    navigateToAaplDetail()
    cy.get('#of-qty').clear().type('1')
    selectUsdAccount()
    cy.get('[data-cy="order-submit"]').click()

    cy.get('[data-cy="order-confirm-dialog"]').should('be.visible')
    cy.get('[data-cy="order-confirm-cancel"]').click()
    cy.get('[data-cy="order-confirm-dialog"]').should('not.exist')

    // No order persisted.
    cy.visit('/banking/trgovina/nalozi')
    cy.contains('h1', 'Moji nalozi', { timeout: 15000 }).should('be.visible')
    cy.contains('tr', 'AAPL').should('not.exist')
  })

  it('sell deep-link pre-fills quantity + filters accounts to listing currency', () => {
    // Resolve AAPL's UUID via the catalog row click + URL capture,
    // then re-visit with the sell deep-link parameters.
    cy.visit('/banking/trgovina')
    cy.contains('h1', 'Trgovina', { timeout: 15000 }).should('be.visible')
    cy.contains('tr', 'AAPL', { timeout: 10000 }).click()
    cy.url({ timeout: 10000 })
      .should('match', /\/banking\/trgovina\/[0-9a-f-]+/)
      .then((url) => {
        const id = url.match(/\/banking\/trgovina\/([0-9a-f-]+)/)![1]
        cy.visit(`/banking/trgovina/${id}?direction=sell&qty=3`)
      })

    cy.get('#of-qty', { timeout: 15000 }).should('have.value', '3')
    // Wait for the accounts query + eligible-set filter to settle: the
    // USD trading account must appear, the RSD account must not (sell
    // restricts to listing ccy).
    cy.get('#of-acct option', { timeout: 10000 })
      .should('contain', 'USD')
      .and('not.contain', 'RSD')
  })
})
