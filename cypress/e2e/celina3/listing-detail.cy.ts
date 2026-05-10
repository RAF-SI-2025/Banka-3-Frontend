/// <reference types="cypress" />

// Banka2025-E2E.pdf, "Detalji hartije":
//   - leva strana: instrument card sa per-kind atributima
//   - desna strana: istorija cene + range toggle
//   - ispod: forma za trgovinu
//   - za akcije: opcioni lanac sa pickerom datuma izvršenja
//
// Live against the seeded AAPL stock + option chain (strikes 180/190/
// 200 at +60d, plus a +120d 200 call so the date picker has more than
// one option), the seeded CL future, the seeded AAPL-C-190 option,
// and the seeded EURUSD pair.

function navigateToTickerDetail(ticker: string, tab?: string) {
  cy.visit('/portal/trgovina')
  cy.contains('h1', 'Trgovina', { timeout: 15000 }).should('be.visible')
  if (tab) {
    cy.get(`[data-cy="tab-${tab}"]`).click()
  }
  cy.contains('tr', ticker, { timeout: 10000 }).click()
  cy.url({ timeout: 10000 }).should('match', /\/portal\/trgovina\/[0-9a-f-]+/)
}

describe('Celina 3 — listing detail', () => {
  beforeEach(() => {
    cy.resetBackend()
    cy.loginAsSupervisor()
  })

  it('stock detail renders option chain with strike bracket', () => {
    navigateToTickerDetail('AAPL', 'SECURITY_TYPE_STOCK')

    cy.contains('AAPL').should('be.visible')
    cy.contains('Apple Inc.').should('be.visible')
    cy.contains('Maintenance margin').should('be.visible')

    cy.contains('Istorija cene').should('be.visible')

    cy.contains('Opcioni lanac', { timeout: 10000 }).should('be.visible')
    cy.contains('th', 'Strike').should('be.visible')
    cy.contains('td', '180,00').should('be.visible')
    cy.contains('td', '190,00').should('be.visible')

    cy.get('[data-cy="option-chain-table"]').within(() => {
      cy.contains('th', 'CALLS').should('be.visible')
      cy.contains('th', 'PUTS').should('be.visible')
      cy.contains('th', 'Theta').should('be.visible')
    })
  })

  it('future detail renders without option chain', () => {
    navigateToTickerDetail('CL', 'SECURITY_TYPE_FUTURE')

    cy.contains('CL').should('be.visible')
    cy.contains('Veličina ugovora').should('be.visible')
    cy.contains('Opcioni lanac').should('not.exist')
  })

  it('option detail shows underlying ticker and strike/premium fields', () => {
    navigateToTickerDetail('AAPL-C-190', 'SECURITY_TYPE_OPTION')

    cy.contains('AAPL-C-190').should('be.visible')
    cy.contains('Strike').parent().should('contain', '190,00')
    cy.contains('Premium').parent().should('contain', '8,50')
    cy.contains('Bazna hartija').parent().should('contain', 'AAPL')
  })

  // Regression for the spec p.42 forex gate: ListingDetail's
  // tradable check used to exclude forex, so the OrderForm never
  // rendered. End-to-end placement lives in forex-buy.cy.ts.
  it('forex detail renders the order form (regression for the tradable gate)', () => {
    navigateToTickerDetail('EUR/USD', 'SECURITY_TYPE_FOREX')

    cy.contains('EURUSD').should('be.visible')
    cy.contains('Bazna valuta').parent().should('contain', 'EUR')
    cy.contains('Kvotna valuta').parent().should('contain', 'USD')
    cy.get('#order-form').should('be.visible')
  })
})
