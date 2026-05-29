/// <reference types="cypress" />

// C3-tests S67 + S68 + S72: client portfolio display surface.
//   S67 — table columns: type, ticker, amount, price, profit, last modified
//   S68 — total profit/gubitak summary
//   S72 — clients don't see the option-exercise UI (banking portfolio
//         filters to stocks + futures only; the actuary-only portal
//         portfolio carries the Iskoristi affordance).
//
// Live against seeded client holdings.

describe('Celina 3 — client portfolio display (S67, S68, S72)', () => {
  beforeEach(() => {
    cy.resetBackend()
    cy.loginAsClient()
  })

  it('S67 — banking portfolio renders the spec p.61 column set', () => {
    cy.visit('/banking/portfolio')
    cy.contains('h1', 'Portfolio', { timeout: 15000 }).should('be.visible')

    // Spec p.61.a: tip hartije (rendered as section title), ticker,
    // amount (Količina), price (Avg cena + Trenutna cena), profit
    // (Nerealizovan P&L), last modified (Poslednja izmena).
    cy.contains('Akcija').should('be.visible')
    cy.contains('th', 'Ticker').should('be.visible')
    cy.contains('th', 'Količina').should('be.visible')
    cy.contains('th', 'Avg cena').should('be.visible')
    cy.contains('th', 'Trenutna cena').should('be.visible')
    cy.contains('th', 'Tržišna vrednost').should('be.visible')
    cy.contains('th', 'Nerealizovan P&L').should('be.visible')
    cy.contains('th', 'Poslednja izmena').should('be.visible')
  })

  it('S68 — Ukupan profit summary card renders a numeric total', () => {
    cy.visit('/banking/portfolio')
    cy.contains('h1', 'Portfolio', { timeout: 15000 }).should('be.visible')
    cy.contains('Ukupan profit')
      .parent()
      .should('be.visible')
      .within(() => {
        // Total is a formatted number — sr-RS uses a comma decimal.
        cy.contains(/\d+,\d{2}/).should('be.visible')
      })
  })

  it('S72 — client banking portfolio does not surface option exercise', () => {
    cy.visit('/banking/portfolio')
    cy.contains('h1', 'Portfolio', { timeout: 15000 }).should('be.visible')
    // Clients see no Opcije section + no Iskoristi button anywhere.
    cy.contains('Opcije').should('not.exist')
    cy.contains('Iskoristi').should('not.exist')
  })
})
