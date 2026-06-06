/// <reference types="cypress" />

// Watchlists (todoSpec C3 S35-S39). Live against the seeded c3 stack.
//
// klijent@banka.local has trading.client. The watchlist add control
// (src/components/trading/WatchlistCard.tsx) embeds on every security
// detail page; the dedicated list view lives at
// /banking/trgovina/watchlist (src/components/trading/WatchlistPage.tsx).
// Both surfaces are well-instrumented with data-cy hooks already, so no
// component edits are needed here.
//
// resetBackend truncates trading.* incl. any watchlist rows, so each
// test starts with no lists.

function openSecurityDetail(ticker: string) {
  cy.visit('/banking/trgovina')
  cy.contains('h1', 'Trgovina', { timeout: 15000 }).should('be.visible')
  cy.get('[data-cy="filter-search"]').type(ticker)
  cy.contains('tr', ticker, { timeout: 10000 }).click()
  cy.url({ timeout: 10000 }).should('match', /\/banking\/trgovina\/[0-9a-f-]+/)
}

describe('Celina 3 — liste za praćenje (S35-S39)', () => {
  beforeEach(() => {
    cy.resetBackend()
    cy.clearExchangeOverride('XNYS')
    cy.loginAsClient()
  })

  it('S35-S36 — adds MSFT to a freshly created named watchlist', () => {
    openSecurityDetail('MSFT')

    cy.get('[data-cy="watchlist-add-card"]').within(() => {
      // S36: create a new named list and add the on-screen security to
      // it in one shot (WatchlistCard's create→add chain).
      cy.get('[data-cy="watchlist-new-toggle"]').click()
      cy.get('[data-cy="watchlist-new-name"]').type('Tech akcije')
      cy.get('[data-cy="watchlist-new-submit"]').click()

      // S35: the security shows as a member of the list it was added to.
      cy.get('[data-cy="watchlist-membership"]', { timeout: 10000 })
        .should('contain', 'Tech akcije')
    })

    // S36: the list shows up on the dedicated watchlist page with MSFT.
    cy.visit('/banking/trgovina/watchlist')
    cy.contains('h1', 'Liste za praćenje', { timeout: 15000 }).should('be.visible')
    cy.get('[data-cy="watchlist"]').should('have.length', 1)
    cy.get('[data-cy="watchlist-name"]').should('contain', 'Tech akcije')
    cy.get('[data-cy="watchlist-item"]').should('contain', 'MSFT')
  })

  it('S37-S38 — list shows price/daily-change, supports remove + quick-order deep link', () => {
    // Seed a list with one item via the detail page, then exercise the
    // list view.
    openSecurityDetail('MSFT')
    cy.get('[data-cy="watchlist-add-card"]').within(() => {
      cy.get('[data-cy="watchlist-new-toggle"]').click()
      cy.get('[data-cy="watchlist-new-name"]').type('Tech akcije')
      cy.get('[data-cy="watchlist-new-submit"]').click()
      cy.get('[data-cy="watchlist-membership"]', { timeout: 10000 }).should('contain', 'Tech akcije')
    })

    cy.visit('/banking/trgovina/watchlist')
    cy.get('[data-cy="watchlist-item"]', { timeout: 15000 }).should('have.length', 1)

    // S35/S37: each item renders a current price (formatMoney → has a
    // currency suffix like "USD") next to the ticker.
    cy.get('[data-cy="watchlist-item"]').first().should('contain', 'MSFT').and('contain', 'USD')

    // S38: the quick-order link lands on the security detail with the
    // order form prefilled for a BUY.
    cy.get('[data-cy="watchlist-quick-order"]').first().click()
    cy.url({ timeout: 10000 })
      .should('match', /\/banking\/trgovina\/[0-9a-f-]+/)
      .and('include', 'direction=buy')
    cy.get('#order-form', { timeout: 10000 }).should('exist')

    // S37: remove the item — list goes empty.
    cy.visit('/banking/trgovina/watchlist')
    cy.get('[data-cy="watchlist-item-remove"]', { timeout: 15000 }).first().click()
    cy.get('[data-cy="watchlist-item"]').should('not.exist')
  })

  it('S39 — filters watchlist items by security type', () => {
    // Build a list with a stock (MSFT) and a future (CL) so the type
    // filter has something to hide.
    openSecurityDetail('MSFT')
    cy.get('[data-cy="watchlist-add-card"]').within(() => {
      cy.get('[data-cy="watchlist-new-toggle"]').click()
      cy.get('[data-cy="watchlist-new-name"]').type('Mešovito')
      cy.get('[data-cy="watchlist-new-submit"]').click()
      cy.get('[data-cy="watchlist-membership"]', { timeout: 10000 }).should('contain', 'Mešovito')
    })

    // Add the future (CL) to the same list via its detail page.
    openSecurityDetail('CL')
    cy.get('[data-cy="watchlist-add-card"]').within(() => {
      // The list now exists, so the default (non-creating) control is shown.
      cy.get('[data-cy="watchlist-select"]').find('option').contains('Mešovito').then((opt) => {
        cy.get('[data-cy="watchlist-select"]').select(opt.attr('value') as string)
      })
      cy.get('[data-cy="watchlist-add-submit"]').click()
      cy.get('[data-cy="watchlist-membership"]', { timeout: 10000 }).should('contain', 'Mešovito')
    })

    cy.visit('/banking/trgovina/watchlist')
    cy.get('[data-cy="watchlist-item"]', { timeout: 15000 }).should('have.length', 2)

    // Filter to "Akcija" (stock) — only MSFT remains visible.
    cy.get('[data-cy="watchlist-type-filter"]').find('option').contains(/Akcij/).then((opt) => {
      cy.get('[data-cy="watchlist-type-filter"]').select(opt.attr('value') as string)
    })
    cy.get('[data-cy="watchlist-item"]').should('have.length', 1)
    cy.get('[data-cy="watchlist-item"]').first().should('contain', 'MSFT')

    // Clear the filter — both items return.
    cy.get('[data-cy="watchlist-type-filter"]').select('')
    cy.get('[data-cy="watchlist-item"]').should('have.length', 2)
  })
})
