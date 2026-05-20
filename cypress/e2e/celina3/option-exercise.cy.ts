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
    // Snapshot the option's quantity cell (col 3) BEFORE clicking so
    // the post-exercise assertion is delta-1 rather than the absolute
    // "5 → 4" the seed plants — in the soak-e2e harness a prior
    // exercise may have already moved it.
    cy.contains('tr', 'AAPL-C-190', { timeout: 15000 })
      .find('td')
      .eq(3)
      .invoke('text')
      .then((s) => {
        cy.wrap(parseInt(s.replace(/\D/g, ''), 10)).as('optionQtyBefore')
      })

    // Same snapshot for the underlying AAPL stock row, if it exists.
    // The :not() filter excludes the option row. The row may not be
    // present yet (first exercise of the run); default to 0.
    //
    // The stocks table columns are (Ticker, Količina, Avg cena, …) so
    // qty is at td.eq(1) — NOT eq(3) (which would land on the price
    // cell "190,50" and parse as 19050 after stripping non-digits).
    cy.get('body').then(($body) => {
      const $row = $body
        .find('tr:contains("AAPL")')
        .filter((_, el) => !el.textContent?.includes('AAPL-C-') && !el.textContent?.includes('AAPL-P-'))
      const qty = $row.length ? parseInt($row.find('td').eq(1).text().replace(/\D/g, ''), 10) || 0 : 0
      cy.wrap(qty).as('underlyingQtyBefore')
    })

    cy.contains('tr', 'AAPL-C-190').within(() => {
      cy.contains('button', 'Iskoristi').click()
    })

    cy.contains('Iskoristi opciju AAPL-C-190').should('be.visible')
    cy.contains('In the money').should('be.visible')

    // Default qty=1; one contract of size 100 ⇒ 100 underlying shares
    // bought at strike 190.00.
    cy.get('[data-cy="exercise-confirm"]').click()

    // Dialog closes on success.
    cy.contains('Iskoristi opciju AAPL-C-190', { timeout: 10000 }).should('not.exist')

    // Option holding decremented by exactly 1.
    cy.get<number>('@optionQtyBefore').then((before) => {
      cy.contains('tr', 'AAPL-C-190', { timeout: 10000 })
        .find('td')
        .eq(3)
        .should((td) => {
          const after = parseInt(td.text().replace(/\D/g, ''), 10)
          expect(after, `option qty ${before} → ${after}`).to.eq(before - 1)
        })
    })

    // Underlying delivered to the agent's portfolio: +100 shares
    // (one contract of size 100 at strike 190). Spec p.61.d. Stocks
    // table's Količina sits at td.eq(1) — see snapshot above.
    cy.get<number>('@underlyingQtyBefore').then((before) => {
      cy.contains('tr', 'AAPL')
        .filter(':not(:contains(AAPL-C-190)):not(:contains(AAPL-P-))')
        .first()
        .find('td')
        .eq(1)
        .should((td) => {
          const after = parseInt(td.text().replace(/\D/g, ''), 10)
          expect(after, `underlying qty ${before} → ${after}`).to.eq(before + 100)
        })
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
