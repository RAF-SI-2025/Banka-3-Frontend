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
    // Normalize-state preamble for soak-e2e. resetBackend is a no-op
    // past spec #1 there, so the agent.used_limit accumulated by
    // earlier specs pushes a fresh qty=1 order to PENDING instead
    // of APPROVED — the "approved" filter then has no AAPL row and
    // the cancel-order data-cy lookup fails.
    cy.resetAgentLimit()
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

    // Spec p.56 confirmation gate.
    cy.get('[data-cy="order-confirm-submit"]').click()

    // 2. Switch to supervisor and cancel. Approved orders carry an
    // inline "Otkaži" affordance for supervisors right in the row.
    cy.clearCookies()
    cy.window().then((w) => w.sessionStorage.clear())
    cy.loginAsSupervisor()
    cy.visit('/portal/trgovina/nalozi')

    cy.contains('h1', 'Pregled naloga', { timeout: 15000 }).should('be.visible')
    cy.get('[data-cy="filter-status"]').select('approved')
    cy.contains('tr', AAPL_TICKER, { timeout: 15000 })
      .within(() => cy.get('[data-cy="cancel-order"]').click())

    // After cancel the order moves out of "approved". Re-clear the
    // filter and verify the row carries the cancelled badge.
    cy.get('[data-cy="filter-status"]').select('')
    cy.contains('tr', AAPL_TICKER, { timeout: 10000 }).should('contain', 'Otkazan')
  })
})
