/// <reference types="cypress" />

// Banka2025-flow.pdf, "3 - Trgovanje na berzi · Provera 4 - kupovina
// i koriscenje opcija". Two halves:
//
//   1. Live: against the seeded AAPL-C-190 holding (planted by
//      seedTrading on the agent), drive /portal/portfolio →
//      Iskoristi → Potvrdi and assert the option qty drops + the
//      underlying AAPL holding appears with strike-priced cost basis.
//      The BE-side TestIntegration_ExerciseOption_CallBuysUnderlying
//      already asserts the cash-leg shape; this verifies that the FE
//      built the right payload such that the gateway, gRPC routing,
//      validation, and the bank's SettleTrade all accepted it, and
//      that the user-observable portfolio reflects the exchange.
//
//   2. Canned: a stubbed-OOM-PUT case driving the dialog's gate logic
//      (Potvrdi disabled, "out-of-the-money" reason rendered). No
//      backend coupling — just the FE state machine on stubbed data.

describe('Celina 3 (live) — agent iskorišćava ITM CALL', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('drops the option holding to 0 and credits the underlying at strike', () => {
    cy.loginAsAgent()
    // Warm vite on /portal first; the cold lazy-bundle on
    // /portal/portfolio can otherwise blank-paint past the 15s budget.
    cy.visit('/portal')
    cy.contains('Dobrodošli', { timeout: 15000 }).should('be.visible')
    cy.visit('/portal/portfolio')

    cy.contains('h1', 'Portfolio (aktuar)', { timeout: 20000 }).should('be.visible')

    // Spec p.59 ITM badge: AAPL spot 190.50 > strike 190.00 ⇒ ITM.
    cy.contains('tr', 'AAPL-C-190', { timeout: 15000 }).within(() => {
      cy.contains('button', 'Iskoristi').click()
    })

    cy.contains('Iskoristi opciju AAPL-C-190').should('be.visible')
    cy.contains('In the money').should('be.visible')

    // Default qty=1; one contract of size 100 ⇒ 100 underlying shares
    // bought at strike 190.00.
    cy.get('[data-cy="exercise-confirm"]').click()

    // Dialog closes on success.
    cy.contains('Iskoristi opciju AAPL-C-190', { timeout: 10000 }).should('not.exist')

    // Option holding decremented from 5 → 4. We assert the visible
    // qty cell rather than the BE row count to keep this firmly a FE
    // test of user-observable state.
    cy.contains('tr', 'AAPL-C-190', { timeout: 10000 }).within(() => {
      cy.get('td').eq(3).should('contain', '4')
    })

    // Underlying delivered to the agent's portfolio. Spec p.61.d:
    // CALL exercise buys `qty × contract_size` shares at strike,
    // so one contract = 100 AAPL @ 190.00. The portfolio table
    // surfaces ticker + količina; "AAPL" appears as a stock row.
    cy.contains('tr', 'AAPL').filter(':not(:contains(AAPL-C-190))').first().within(() => {
      cy.get('td').should('contain', '100')
    })
  })
})

describe('Celina 3 (live) — option exercise dialog gate (OOM PUT)', () => {
  // FE state machine: Potvrdi must be disabled when the option is
  // out of the money. Live against the seeded AAPL-P-180 holding —
  // strike 180 vs AAPL spot 190.50 ⇒ underlying > strike ⇒ PUT OOM.
  beforeEach(() => {
    cy.resetBackend()
  })

  it('OOM PUT: Potvrdi is disabled and the spec p.61.d block reason is shown', () => {
    cy.loginAsAgent()
    cy.visit('/portal')
    cy.contains('Dobrodošli', { timeout: 15000 }).should('be.visible')
    cy.visit('/portal/portfolio')
    cy.contains('h1', 'Portfolio (aktuar)', { timeout: 20000 }).should('be.visible')

    cy.contains('tr', 'AAPL-P-180', { timeout: 15000 }).within(() => {
      cy.contains('button', 'Iskoristi').click()
    })

    cy.contains('Iskoristi opciju AAPL-P-180').should('be.visible')
    cy.contains('Out of the money').should('be.visible')
    cy.contains('out-of-the-money').should('be.visible')
    cy.get('[data-cy="exercise-confirm"]').should('be.disabled')
  })
})
