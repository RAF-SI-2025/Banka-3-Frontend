/// <reference types="cypress" />

// Banka2025-flow.pdf, "3 - Trgovanje na berzi · Provera 2 - kupovina
// ForexPair-a". Live spec — drives the real stack from Forex tab → pair
// detail → OrderForm → confirmation, then asserts the order is visible
// in /portal/trgovina/nalozi against the seeded EURUSD pair. Spec p.42
// paired settlement is already covered by bank/trading integration
// tests; this just verifies the FE wiring built the right payload such
// that the gateway, validation, and persistence accepted it.

// The forex tab renders rows by base/quote, not by raw ticker —
// `currencyLabel(base)/currencyLabel(quote)` per ListingsTable —
// so the visible text for the seeded EURUSD pair is "EUR/USD".
const FOREX_PAIR_DISPLAY = 'EUR/USD'

describe('Celina 3 (live) — agent kupuje ForexPair', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('agent places a market BUY on EURUSD; order shows up in nalozi', () => {
    cy.loginAsAgent()
    cy.visit('/portal/trgovina')

    cy.contains('h1', 'Trgovina', { timeout: 15000 }).should('be.visible')
    cy.get('[data-cy="tab-SECURITY_TYPE_FOREX"]').click()
    cy.contains('tr', FOREX_PAIR_DISPLAY, { timeout: 10000 }).click()

    cy.url({ timeout: 10000 }).should('match', /\/portal\/trgovina\/[0-9a-f-]+/)

    // Spec p.42 + actuary picker: account list pulls forex_book accounts.
    // Pick the USD-side book; the bank's per-currency forex_book is the
    // only legal source account for an actuary-side forex order.
    cy.get('#order-form').within(() => {
      cy.get('#of-qty').clear().type('1')
      cy.get('#of-acct').find('option').contains('USD').then((opt) => {
        cy.get('#of-acct').select(opt.attr('value') as string)
      })
      cy.get('[data-cy="order-submit"]').click()
    })

    // Spec p.56 confirmation gate.
    cy.get('[data-cy="order-confirm-submit"]').click()

    // Order made it to persistence: it shows in the agent's view of
    // /portal/trgovina/nalozi. Forex orders auto-approve for an
    // under-limit qty=1 trade so the status filter "approved" surfaces
    // it; "done" if the worker already filled it. The orders list
    // denormalises securityId → ticker via useSecurityTickers, so the
    // visible cell is the raw ticker (EURUSD), not the EUR/USD pair
    // label the catalog renders.
    cy.visit('/portal/trgovina/nalozi')
    cy.contains('h1', 'Pregled naloga', { timeout: 15000 }).should('be.visible')
    cy.contains('tr', 'EURUSD', { timeout: 15000 }).should('be.visible')
  })
})
