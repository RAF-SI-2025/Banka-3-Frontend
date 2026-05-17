/// <reference types="cypress" />

// Banka2025-E2E.pdf, "Reset lozinke putem email-a":
// 1. user requests reset on /password-reset
// 2. backend sends a link with a 15-min token
// 3. user opens the link → sets a new password
// 4. user logs in with the new password; old password rejected.

describe('Celina 1 — reset lozinke (live backend)', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('full round-trip: request → set new password → log in', () => {
    cy.visit('/password-reset')
    cy.findByLabelText('Email').type('admin@banka.local')
    cy.findByRole('button', { name: /Pošalji link/ }).click()
    cy.contains('Link važi 15 minuta').should('be.visible')

    cy.captureLink('admin@banka.local', '/password-reset/confirm?token=').then((token) => {
      // captureLink returns the bit after the marker — that's the token itself.
      cy.visit('/password-reset/confirm?token=' + token)
      cy.findByLabelText('Nova lozinka').type('NewAdmin123')
      cy.findByLabelText('Potvrdi lozinku').type('NewAdmin123')
      cy.findByRole('button', { name: /Postavi lozinku/ }).click()
      // Successful reset navigates to /login.
      cy.url({ timeout: 5000 }).should('include', '/login')
    })

    // Old password rejected.
    cy.visit('/login')
    cy.findByLabelText('Email').type('admin@banka.local')
    cy.findByLabelText('Lozinka').type('Admin123!')
    cy.findByRole('button', { name: /Prijavi se/ }).click()
    cy.contains('Neispravni kredencijali').should('be.visible')

    // New password works.
    cy.findByLabelText('Lozinka').clear().type('NewAdmin123')
    cy.findByRole('button', { name: /Prijavi se/ }).click()
    cy.url({ timeout: 5000 }).should('not.include', '/login')
  })
})
