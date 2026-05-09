/// <reference types="cypress" />

// FE-15: client trading happy path against the live c3 stack.
//
// klijent@banka.local has trading.client + a 300k USD trading account
// from the seed (services/user/cmd/seed). AAPL is listed on XNYS at
// ~190.55 USD ASK; partial-fill cadence per spec p.56 is fast for
// small qty on high-volume listings (Random(0, 1440 × 1/50M) ≈ 0
// seconds), so a market buy of 1 fills immediately.

describe('Celina 3 (live) — klijent: market buy AAPL → portfolio', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('places a market buy and sees the position in /banking/portfolio', () => {
    cy.loginAsClient()
    cy.url().should('include', '/banking')

    // Catalog → AAPL detail
    cy.visit('/banking/trgovina')
    cy.get('[data-cy="filter-search"]').type('AAPL')
    cy.contains('tr', 'AAPL', { timeout: 10000 }).click()
    cy.url().should('match', /\/banking\/trgovina\/[0-9a-f-]+/)
    cy.contains('AAPL').should('be.visible')

    // Order form: market buy, qty 1, USD account
    cy.get('#order-form').within(() => {
      cy.get('#of-qty').clear().type('1')
      // Pick the USD trading account (the only USD account on the
      // seeded client). Selecting by displayed currency keeps this
      // robust across UUID changes.
      cy.get('#of-acct').find('option').contains('USD').then((opt) => {
        cy.get('#of-acct').select(opt.attr('value') as string)
      })
      cy.get('[data-cy="order-submit"]').click()
    })

    // Order should show up under "Moji nalozi". The orders list
    // currently renders security_id (uuid) rather than ticker — match
    // the row by the order type the test placed (Tržišni = market).
    cy.visit('/banking/trgovina/nalozi')
    cy.contains('tr', 'Tržišni', { timeout: 15000 }).should('be.visible')
    cy.contains('tr', 'Tržišni').contains(/Izvršen|Odobren|Na čekanju/, {
      timeout: 30000,
    })

    // Portfolio: the holdings list refreshes on visit. The fill cron
    // runs every 10s, so give it room. Reload the portfolio route
    // after a beat to bypass any client-cached "empty" snapshot from
    // a fetch that landed before the fill.
    cy.wait(12000)
    cy.visit('/banking/portfolio')
    cy.contains('h1', 'Portfolio').should('be.visible')
    cy.contains('tr', 'AAPL', { timeout: 30000 }).should('be.visible')
  })
})
