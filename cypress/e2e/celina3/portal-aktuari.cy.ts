/// <reference types="cypress" />

// FE-12: actuary management portal — live against the seeded
// aktuar@banka.local (agent, 200000 RSD daily limit) and
// supervizor@banka.local. Supervisor edits limit, resets used,
// toggles need_approval; agent without supervisor perm can't reach
// /portal/aktuari.

function aktuarRowSelector() {
  return cy.contains('tr', 'aktuar@banka.local')
}

describe('Celina 3 — portal aktuari (supervisor)', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('list shows the seeded agent row with limits', () => {
    cy.loginAsSupervisor()
    cy.visit('/portal/aktuari')
    cy.contains('h1', 'Aktuari', { timeout: 15000 }).should('be.visible')
    aktuarRowSelector()
      .should('be.visible')
      .within(() => {
        cy.contains('200.000,00').should('be.visible')
        cy.contains('0,00').should('be.visible')
      })
  })

  it('supervisor edits limit, resets used, and toggles need_approval', () => {
    cy.loginAsSupervisor()
    cy.visit('/portal/aktuari')
    cy.contains('h1', 'Aktuari', { timeout: 15000 }).should('be.visible')
    aktuarRowSelector().click()
    cy.url({ timeout: 10000 }).should('match', /\/portal\/aktuari\/[0-9a-f-]+/)

    cy.get('[data-cy="daily-limit-input"]', { timeout: 10000 })
      .invoke('val')
      .then((v) => expect(Number(v)).to.eq(200000))
    cy.get('[data-cy="daily-limit-input"]').clear().type('750000')
    cy.get('[data-cy="save-limit"]').click()
    cy.get('[data-cy="daily-limit-input"]', { timeout: 10000 })
      .invoke('val')
      .should((v) => expect(Number(v)).to.eq(750000))

    cy.get('[data-cy="reset-used"]').click()
    cy.get('[data-cy="confirm-reset"]').click()
    cy.get('[data-cy="used-limit-display"]', { timeout: 10000 }).should('contain', '0,00')

    cy.get('[data-cy="need-approval-toggle"]').check()
    cy.get('[data-cy="need-approval-toggle"]', { timeout: 10000 }).should('be.checked')
  })

  it('non-supervisor agent cannot reach /portal/aktuari', () => {
    cy.loginAsAgent()
    cy.visit('/portal/aktuari')
    cy.location('pathname', { timeout: 10000 }).should('eq', '/portal')
  })
})
