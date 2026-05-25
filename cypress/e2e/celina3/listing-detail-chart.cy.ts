/// <reference types="cypress" />

// C3-tests S19: chart period switch reissues the history query with
// the new from/to range.
//
// Live against the seeded AAPL listing.

describe('Celina 3 — listing detail chart period (S19)', () => {
  beforeEach(() => {
    cy.resetBackend()
    cy.loginAsSupervisor()
  })

  it('S19 — clicking 1M / 1G / 5G refetches listing history with the new range', () => {
    const calls: { from?: string; to?: string }[] = []
    cy.intercept('GET', '/api/v1/listings/*/history*', (req) => {
      calls.push({ from: req.query.from as string, to: req.query.to as string })
      req.continue()
    }).as('history')

    cy.visit('/portal/trgovina')
    cy.contains('h1', 'Trgovina', { timeout: 15000 }).should('be.visible')
    cy.contains('tr', 'AAPL', { timeout: 10000 }).click()
    cy.url({ timeout: 10000 }).should('match', /\/portal\/trgovina\/[0-9a-f-]+/)

    // The chart ships 6 periods using Serbian labels (1D / 1N / 1M /
    // 1G / 5G / Sve — see src/components/trading/ListingDetail.tsx
    // RANGES). Pick three of those to assert short / medium / long.
    cy.wait('@history')
    cy.contains('button', '1M').click()
    cy.wait('@history')
    cy.contains('button', '1G').click()
    cy.wait('@history')
    cy.contains('button', '5G').click()
    cy.wait('@history').then(() => {
      // Compare (today - from) day deltas to be sure the button drove
      // the query.
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const spans = calls.map((c) => {
        const from = new Date(c.from!)
        return Math.round((today.getTime() - from.getTime()) / (1000 * 3600 * 24))
      })
      const has = (n: number) => spans.some((s) => Math.abs(s - n) <= 2)
      expect(has(30), `1M (30d) in spans=${spans.join(',')}`).to.equal(true)
      expect(has(365), `1G (365d) in spans=${spans.join(',')}`).to.equal(true)
      expect(has(365 * 5), `5G (1825d) in spans=${spans.join(',')}`).to.equal(true)
    })
  })
})
