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

  it('S19 — clicking 30D / 90D / 1G refetches listing history with the new range', () => {
    const calls: { from?: string; to?: string }[] = []
    cy.intercept('GET', '/api/v1/listings/*/history*', (req) => {
      calls.push({ from: req.query.from as string, to: req.query.to as string })
      req.continue()
    }).as('history')

    cy.visit('/portal/trgovina')
    cy.contains('h1', 'Trgovina', { timeout: 15000 }).should('be.visible')
    cy.contains('tr', 'AAPL', { timeout: 10000 }).click()
    cy.url({ timeout: 10000 }).should('match', /\/portal\/trgovina\/[0-9a-f-]+/)

    // Initial render: 90D default.
    cy.wait('@history')
    cy.contains('button', '30D').click()
    cy.wait('@history')
    cy.contains('button', '1G').click()
    cy.wait('@history').then(() => {
      // At least one history call per range; spans differ. Compare
      // (today - from) day deltas to be sure the button drove the
      // query.
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const spans = calls.map((c) => {
        const from = new Date(c.from!)
        return Math.round((today.getTime() - from.getTime()) / (1000 * 3600 * 24))
      })
      // Expect the recorded spans to include 30, 90, and 365 (give
      // or take a day for TZ rounding).
      const has = (n: number) => spans.some((s) => Math.abs(s - n) <= 1)
      expect(has(30), `30D in spans=${spans.join(',')}`).to.be.true
      expect(has(90), `90D in spans=${spans.join(',')}`).to.be.true
      expect(has(365), `1G in spans=${spans.join(',')}`).to.be.true
    })
  })
})
