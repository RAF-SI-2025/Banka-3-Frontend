/// <reference types="cypress" />

// Banka2025-E2E.pdf, "Feature: Kreiranje i upravljanje zaposlenima":
//   - Administrator kreira novog zaposlenog (+ activation email)
//   - Administrator menja podatke zaposlenog
//   - Administrator deaktivira zaposlenog (+ session revoked)
//
// Three scenarios share fixture state — one fresh employee created in
// before(each), then exercised across the lifecycle.

describe('Celina 1 — upravljanje zaposlenima (live backend)', () => {
  beforeEach(() => {
    cy.resetBackend()
    cy.loginAsAdmin()
  })

  it('admin kreira novog zaposlenog (sa email-om za aktivaciju)', () => {
    cy.visit('/portal/employees/new')
    cy.findByLabelText('Email').type('marko@banka.local')
    cy.findByLabelText('Korisničko ime').type('marko')
    cy.findByLabelText('Ime').type('Marko')
    cy.findByLabelText('Prezime').type('Marković')
    cy.findByLabelText('Datum rođenja').type('1990-05-20')
    cy.findByLabelText('Pol').select('GENDER_MALE')
    cy.findByLabelText('Telefon').type('+381645555555')
    cy.findByLabelText('Adresa').type('Njegoševa 25')
    cy.findByLabelText('Pozicija').type('Agent')
    cy.findByLabelText('Departman').type('Trgovina')
    cy.findByLabelText('Uloga').select('agent')
    cy.findByRole('button', { name: /Kreiraj zaposlenog/ }).click()

    // Lands on the portal list with Marko visible.
    cy.url({ timeout: 5000 }).should('match', /\/portal\/employees\/?$/)
    cy.contains('Marko Marković').should('be.visible')

    // Backend dispatched an activation email.
    cy.captureLink('marko@banka.local', '/activate?token=').should('have.length.greaterThan', 0)
  })

  it('admin menja podatke zaposlenog', () => {
    // Seed Marko via the UI form, then exercise the edit page.
    cy.visit('/portal/employees/new')
    cy.findByLabelText('Email').type('marko@banka.local')
    cy.findByLabelText('Korisničko ime').type('marko')
    cy.findByLabelText('Ime').type('Marko')
    cy.findByLabelText('Prezime').type('Marković')
    cy.findByLabelText('Datum rođenja').type('1990-05-20')
    cy.findByLabelText('Telefon').type('+381645555555')
    cy.findByLabelText('Adresa').type('Njegoševa 25')
    cy.findByLabelText('Pozicija').type('Agent')
    cy.findByLabelText('Departman').type('Trgovina')
    cy.findByLabelText('Uloga').select('agent')
    cy.findByRole('button', { name: /Kreiraj zaposlenog/ }).click()
    cy.url().should('match', /\/portal\/employees\/?$/)

    // Open edit page.
    cy.contains('tr', 'Marko Marković').findByRole('link', { name: /Izmeni/ }).click()
    cy.url().should('include', '/portal/employees/')

    // Change phone + department, save, verify success.
    cy.findByLabelText('Telefon').clear().type('+381645555556')
    cy.findByLabelText('Departman').clear().type('IT')
    cy.findByRole('button', { name: /Sačuvaj izmene/ }).click()

    // Re-open list, confirm Marko's phone is updated.
    cy.visit('/portal/employees')
    cy.contains('tr', 'Marko Marković').should('contain.text', '+381645555556')
  })

  it('admin deaktivira zaposlenog → korisnik više ne može da se prijavi', () => {
    // Bring up Marko (via UI again) and activate his password directly so
    // we can later assert login fails post-deactivation.
    cy.visit('/portal/employees/new')
    cy.findByLabelText('Email').type('marko@banka.local')
    cy.findByLabelText('Korisničko ime').type('marko')
    cy.findByLabelText('Ime').type('Marko')
    cy.findByLabelText('Prezime').type('Marković')
    cy.findByLabelText('Datum rođenja').type('1990-05-20')
    cy.findByLabelText('Telefon').type('+381645555555')
    cy.findByLabelText('Adresa').type('Njegoševa 25')
    cy.findByLabelText('Pozicija').type('Agent')
    cy.findByLabelText('Departman').type('Trgovina')
    cy.findByLabelText('Uloga').select('agent')
    cy.findByRole('button', { name: /Kreiraj zaposlenog/ }).click()
    cy.url().should('match', /\/portal\/employees\/?$/)

    cy.captureLink('marko@banka.local', '/activate?token=').then((token) => {
      cy.visit('/activate?token=' + token)
      cy.findByLabelText('Nova lozinka').type('Marko123')
      cy.findByLabelText('Potvrdi lozinku').type('Marko123')
      cy.findByRole('button', { name: /Aktiviraj nalog/ }).click()
      cy.contains('Nalog je aktiviran').should('be.visible')
    })

    // Re-login as admin (activation cleared store).
    cy.loginAsAdmin()
    cy.visit('/portal/employees')
    cy.contains('tr', 'Marko Marković').findByRole('link', { name: /Izmeni/ }).click()
    cy.findByRole('button', { name: /Deaktiviraj/ }).click()
    cy.contains(/Aktiviraj/).should('be.visible') // button label flips
    cy.contains('Deaktiviran').should('be.visible')

    // Marko cannot log in anymore.
    cy.visit('/login')
    cy.findByLabelText('Email').type('marko@banka.local')
    cy.findByLabelText('Lozinka').type('Marko123')
    cy.findByRole('button', { name: /Prijavi se/ }).click()
    cy.contains(/deaktiviran/).should('be.visible')
  })
})
