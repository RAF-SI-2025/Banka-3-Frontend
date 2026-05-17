/// <reference types="cypress" />

// FE-15: live spec for the spec p.55 over-limit agent flow.
// Agent (daily limit 200k RSD) places a market BUY of AAPL whose
// RSD-equivalent exceeds the limit; the OrderForm's limit-utilization
// panel surfaces the "needs approval" badge and the placed order
// lands in PENDING. Logging in again as supervizor approves it via
// the cekajuci view.
//
// Requires the FE fix landed for the actuary account picker: the
// OrderForm queries owner_client_id = ForexBookOwnerID for actuaries
// instead of the principal id. Without that the source-account select
// is empty and the form can't be submitted.

const AAPL_TICKER = 'AAPL'

describe('Celina 3 (live) — agent over-limit order routes to supervisor', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('agent places over-limit order pending; supervisor approves it', () => {
    // 1. Agent places the order.
    cy.loginAsAgent()
    cy.visit('/portal/trgovina')

    cy.contains('h1', 'Trgovina', { timeout: 15000 }).should('be.visible')
    cy.get('[data-cy="filter-search"]').clear().type(AAPL_TICKER)
    cy.contains('tr', AAPL_TICKER, { timeout: 10000 }).click()

    cy.url({ timeout: 10000 }).should('match', /\/portal\/trgovina\/[0-9a-f-]+/)

    cy.get('#order-form').within(() => {
      // 200k RSD daily limit; AAPL ~ $190 ≈ 22000 RSD; 12 shares ≈ 264k RSD
      // — comfortably over the limit so the projection panel flips the
      // "needs approval" affordance.
      cy.get('#of-qty').clear().type('12')
      // Source account: forex_book USD (actuaries trade on bank's
      // behalf — OrderForm queries the bank-owned forex_book accounts).
      cy.get('#of-acct').find('option').contains('USD').then((opt) => {
        cy.get('#of-acct').select(opt.attr('value') as string)
      })

      cy.get('[data-cy="needs-approval"]', { timeout: 8000 }).should('be.visible')
      cy.get('[data-cy="order-submit"]').click()
    })

    // Spec p.56 confirmation gate.
    cy.get('[data-cy="order-confirm-submit"]').click()

    // Confirm the placed order shows up under "Pregled naloga" pending.
    cy.visit('/portal/trgovina/nalozi')
    cy.contains('h1', 'Pregled naloga', { timeout: 15000 }).should('be.visible')
    cy.get('[data-cy="filter-status"]').select('pending')
    cy.contains('tr', AAPL_TICKER, { timeout: 15000 }).should('contain', 'Na čekanju')

    // 2. Supervisor approves via the cekajuci shortcut. The order
    // row exposes inline approve/decline buttons for supervisors;
    // navigating into the per-order detail page is unnecessary.
    cy.clearCookies()
    cy.window().then((w) => w.sessionStorage.clear())
    cy.loginAsSupervisor()
    cy.visit('/portal/trgovina/nalozi/cekajuci')

    cy.contains('h1', 'Pregled naloga', { timeout: 15000 }).should('be.visible')
    cy.contains('tr', AAPL_TICKER, { timeout: 15000 })
      .within(() => cy.get('[data-cy="approve-order"]').click())

    // After Approve, the row drops off the pending list. Flip the
    // status filter to "approved" and verify the order resurfaces
    // there with the supervisor stamped as approver — the listing
    // shows their full name rather than the UUID.
    cy.get('[data-cy="filter-status"]').select('approved')
    cy.contains('tr', AAPL_TICKER, { timeout: 10000 }).should('contain', 'Odobren')
  })
})
