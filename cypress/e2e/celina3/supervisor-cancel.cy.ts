/// <reference types="cypress" />

// FE-15: live spec for the spec p.50 supervisor-cancel flow.
// Agent places an approved limit BUY (limit price $1, far below ASK
// → fill conditions never satisfy, so the order can be cancelled
// before it goes to "done"). Supervisor opens the order detail and
// presses "Otkaži"; status flips to cancelled.
//
// Like agent-pending-approval, this depends on the FE fix that the
// actuary account picker pulls forex_book accounts. Without it the
// agent can't submit any order.

const AAPL_TICKER = 'AAPL'

describe('Celina 3 (live) — supervizor otkazuje agent-ov nalog', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('agent places limit order; supervisor cancels it', () => {
    cy.loginAsAgent()
    cy.visit('/portal/trgovina')

    cy.contains('h1', 'Trgovina', { timeout: 15000 }).should('be.visible')
    cy.get('[data-cy="filter-search"]').clear().type(AAPL_TICKER)
    cy.contains('tr', AAPL_TICKER, { timeout: 10000 }).click()

    cy.url({ timeout: 10000 }).should('match', /\/portal\/trgovina\/[0-9a-f-]+/)

    cy.get('#order-form').within(() => {
      cy.get('#of-qty').clear().type('1')
      // Limit far below ASK so the execution worker never fills it
      // before the supervisor lands.
      cy.get('#of-limit').clear().type('1')
      cy.get('#of-acct').find('option').contains('USD').then((opt) => {
        cy.get('#of-acct').select(opt.attr('value') as string)
      })
      cy.get('[data-cy="order-submit"]').click()
    })

    // 2. Switch to supervisor and cancel.
    cy.clearCookies()
    cy.window().then((w) => w.sessionStorage.clear())
    cy.loginAsSupervisor()
    cy.visit('/portal/trgovina/nalozi')

    cy.contains('h1', 'Pregled naloga', { timeout: 15000 }).should('be.visible')
    cy.get('[data-cy="filter-status"]').select('approved')
    cy.contains('tr', AAPL_TICKER, { timeout: 15000 })
      .within(() => cy.contains('Detalji').click())

    cy.get('[data-cy="cancel-order"]', { timeout: 8000 }).click()
    cy.contains(/otkazan/, { timeout: 10000 }).should('be.visible')
  })
})
