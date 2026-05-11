/// <reference types="cypress" />

// C3-tests S54: a pending order whose security has settled (settlement
// date is in the past) can only be declined — the Approve button must
// be hidden in the UI. Backend `ApproveOrder` re-checks; this is the
// spec's UI-side requirement.

describe('Celina 3 — supervisor sees Decline only on past-settlement orders (S54)', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('S54 — agent places order on CL futures; FE forges past settlement; Approve is hidden', () => {
    cy.loginAsAgent()
    cy.visit('/portal/trgovina')
    cy.contains('h1', 'Trgovina', { timeout: 15000 }).should('be.visible')
    cy.get('[data-cy="tab-SECURITY_TYPE_FUTURE"]').click()
    cy.contains('tr', 'CL', { timeout: 10000 }).click()
    cy.url({ timeout: 10000 }).should('match', /\/portal\/trgovina\/[0-9a-f-]+/)

    cy.get('#order-form').within(() => {
      cy.get('#of-qty').clear().type('5')
      cy.get('#of-acct').find('option').contains('USD').then((opt) =>
        cy.get('#of-acct').select(opt.attr('value') as string),
      )
      cy.get('[data-cy="order-submit"]').click()
    })
    cy.get('[data-cy="order-confirm-submit"]').click()

    cy.clearCookies()
    cy.window().then((w) => w.sessionStorage.clear())

    // Forge a past settlement date on the security read so the FE
    // guard kicks in. Backend keeps its real CL date, but `ApproveOrder`
    // re-checks too (TestIntegration_ApproveRechecksSettlement covers
    // the BE side).
    cy.intercept('GET', '/api/v1/securities/*', (req) => {
      req.continue((res) => {
        if (res.body?.security?.type === 'SECURITY_TYPE_FUTURE') {
          res.body.security.settlementDate = '2020-01-01'
        }
      })
    }).as('getSec')

    cy.loginAsSupervisor()
    cy.visit('/portal/trgovina/nalozi/cekajuci')
    cy.contains('h1', 'Pregled naloga', { timeout: 15000 }).should('be.visible')

    cy.contains('tr', 'CL', { timeout: 15000 }).click()
    cy.url({ timeout: 10000 }).should('match', /\/portal\/trgovina\/nalozi\/[0-9a-f-]+/)
    cy.wait('@getSec')

    cy.get('[data-cy="decline-order"]', { timeout: 10000 }).should('be.visible')
    cy.get('[data-cy="approve-order"]').should('not.exist')
  })
})
