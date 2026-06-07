/// <reference types="cypress" />

// Mirrors scenarios from spec/Banka2025-E2E.pdf, "Feature: Autentifikacija
// korisnika". Once `make seed` plants a bootstrap admin, these can run
// against the live backend; for now they validate the FE flow against
// canned responses.

describe('Celina 1 — autentifikacija', () => {
  it('1: uspešno logovanje zaposlenog', () => {
    // Live login against the seeded bootstrap admin. A canned mock here is
    // fragile: a dummy access token 401s on the post-login dashboard calls
    // and the axios refresh-then-logout path bounces back to /login. The
    // real backend issues a valid token so the redirect sticks.
    cy.visit('/login')
    cy.findByLabelText('Email', { timeout: 30000 }).type('admin@banka.local')
    cy.findByLabelText('Lozinka').type('Admin123!')
    cy.findByRole('button', { name: /Prijavi se/ }).click()
    cy.url({ timeout: 30000 }).should('not.include', '/login')
  })

  it('2: pogrešna lozinka prikazuje "Neispravni kredencijali"', () => {
    cy.intercept('POST', '/api/v1/auth/login', {
      statusCode: 401,
      body: { code: 401, message: 'Neispravni kredencijali' },
    }).as('login')

    cy.visit('/login')
    cy.findByLabelText('Email').type('luka@banka.rs')
    cy.findByLabelText('Lozinka').type('pogresna123')
    cy.findByRole('button', { name: /Prijavi se/ }).click()
    cy.wait('@login')
    cy.contains('Neispravni kredencijali').should('be.visible')
  })

  it('3: nepostojeći korisnik vidi "Neispravni kredencijali" (anti-enumeracija)', () => {
    // Spec/E2E originally distinguished "Korisnik ne postoji" from
    // "Neispravni kredencijali", but that leaks valid emails to a
    // brute-force attacker. The user service now collapses both paths
    // to 401/Neispravni kredencijali — see services/user/internal/
    // service/auth.go and TestIntegration_Login_UnknownUser.
    cy.intercept('POST', '/api/v1/auth/login', {
      statusCode: 401,
      body: { code: 401, message: 'Neispravni kredencijali' },
    }).as('login')

    cy.visit('/login')
    cy.findByLabelText('Email').type('nepostojeci@banka.rs')
    cy.findByLabelText('Lozinka').type('Sifra123')
    cy.findByRole('button', { name: /Prijavi se/ }).click()
    cy.wait('@login')
    cy.contains('Neispravni kredencijali').should('be.visible')
    cy.contains('Korisnik ne postoji').should('not.exist')
  })
})
