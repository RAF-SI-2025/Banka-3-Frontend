/// <reference types="cypress" />

// Custom commands for live-backend specs. Each spec resets backend
// state via `cy.resetBackend()` (a Cypress task wired in
// `cypress.config.ts`) and logs in programmatically via the gateway.

const ADMIN_EMAIL = 'admin@banka.local'
const ADMIN_PASSWORD = 'Admin123!'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Truncate the user schema, flush login:* keys in Redis, and re-seed the bootstrap admin. */
      resetBackend(): Chainable<void>
      /** Programmatic login via /api/v1/auth/login; populates the auth store and returns the token. */
      loginAsAdmin(): Chainable<string> // resolves to admin email; navigates browser to /portal
      /** Reads the user service container's stdout, returns the most recent email body for `to` matching `marker`. */
      captureLink(to: string, marker: string): Chainable<string>
    }
  }
}

Cypress.Commands.add('resetBackend', () => {
  cy.task('resetBackend').then((res) => {
    if ((res as { ok: boolean }).ok !== true) {
      throw new Error('resetBackend failed: ' + JSON.stringify(res))
    }
  })
})

Cypress.Commands.add('loginAsAdmin', () => {
  // The auth store lives in memory (Zustand, no persist), so a programmatic
  // POST won't make the SPA think it's logged in. Drive the actual login UI
  // — adds ~500ms but exercises the same code path as a real user.
  cy.visit('/login')
  cy.findByLabelText('Email').clear().type(ADMIN_EMAIL)
  cy.findByLabelText('Lozinka').clear().type(ADMIN_PASSWORD)
  cy.findByRole('button', { name: /Prijavi se/ }).click()
  cy.url({ timeout: 5000 }).should('not.include', '/login')
  return cy.wrap(ADMIN_EMAIL)
})

Cypress.Commands.add('captureLink', (to: string, marker: string) => {
  return cy.task('latestLink', { to, marker }).then((link) => {
    if (typeof link !== 'string' || link.length === 0) {
      throw new Error(`no link with marker ${marker} for ${to}`)
    }
    return cy.wrap(link as string)
  })
})

export {}
