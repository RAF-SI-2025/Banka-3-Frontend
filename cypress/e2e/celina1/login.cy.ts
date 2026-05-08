/// <reference types="cypress" />

// Mirrors spec/TestoviCelina1.md scenarios 1–3. Real fixtures land
// once a seed.sh exists in the backend; this spec uses cy.intercept to
// validate the FE flow against canned responses for now.

describe('Celina 1 — autentifikacija', () => {
  it('1: uspešno logovanje zaposlenog', () => {
    cy.intercept('POST', '/api/v1/auth/login', {
      statusCode: 200,
      body: {
        accessToken: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJlbXAtMSIsInBlcm1zIjpbImFkbWluIl19.dummy',
        accessExpiresIn: 900,
        userId: 'emp-1',
        userKind: 'employee',
        permissions: ['admin'],
      },
    }).as('login')

    cy.visit('/login')
    cy.findByLabelText('Email').type('marko@banka.rs')
    cy.findByLabelText('Lozinka').type('marko123')
    cy.findByRole('button', { name: /Prijavi se/ }).click()
    cy.wait('@login')
    cy.url().should('not.include', '/login')
  })

  it('2: pogrešna lozinka prikazuje "Neispravni unos"', () => {
    cy.intercept('POST', '/api/v1/auth/login', {
      statusCode: 401,
      body: { code: 401, message: 'Neispravni unos' },
    }).as('login')

    cy.visit('/login')
    cy.findByLabelText('Email').type('luka@banka.rs')
    cy.findByLabelText('Lozinka').type('pogresna123')
    cy.findByRole('button', { name: /Prijavi se/ }).click()
    cy.wait('@login')
    cy.contains('Neispravni unos').should('be.visible')
  })

  it('3: nepostojeći korisnik prikazuje "Korisnik ne postoji"', () => {
    cy.intercept('POST', '/api/v1/auth/login', {
      statusCode: 404,
      body: { code: 404, message: 'Korisnik ne postoji' },
    }).as('login')

    cy.visit('/login')
    cy.findByLabelText('Email').type('nepostojeci@banka.rs')
    cy.findByLabelText('Lozinka').type('Sifra123')
    cy.findByRole('button', { name: /Prijavi se/ }).click()
    cy.wait('@login')
    cy.contains('Korisnik ne postoji').should('be.visible')
  })
})
