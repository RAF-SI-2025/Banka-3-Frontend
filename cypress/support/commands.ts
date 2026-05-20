/// <reference types="cypress" />

// Custom commands for live-backend specs. Each spec resets backend
// state via `cy.resetBackend()` (a Cypress task wired in
// `cypress.config.ts`) and logs in programmatically via the gateway.

const ADMIN_EMAIL = 'admin@banka.local'
const ADMIN_PASSWORD = 'Admin123!'
const CLIENT_EMAIL = 'klijent@banka.local'
const CLIENT_PASSWORD = 'Klijent123!'
const AGENT_EMAIL = 'aktuar@banka.local'
const AGENT_PASSWORD = 'Aktuar123!'
const SUPERVISOR_EMAIL = 'supervizor@banka.local'
const SUPERVISOR_PASSWORD = 'Supervizor123!'


declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Truncate user + bank + trading schemas, bounce bank+trading containers, and re-run the seed program. */
      resetBackend(): Chainable<void>
      /** Programmatic login via /api/v1/auth/login; populates the auth store and returns the token. */
      loginAsAdmin(): Chainable<string> // resolves to admin email; navigates browser to /portal
      /** Login as the seeded c2 test client (planted by `make seed`). */
      loginAsClient(): Chainable<string>
      /** Login as the seeded c3 actuary agent (200k RSD daily limit). */
      loginAsAgent(): Chainable<string>
      /** Login as the seeded c3 actuary supervisor (no limit, can approve). */
      loginAsSupervisor(): Chainable<string>
      /** Reads the user service container's stdout, returns the most recent email body for `to` matching `marker`. */
      captureLink(to: string, marker: string): Chainable<string>
      /** Run arbitrary SQL against the test Postgres. Returns rows as raw psql -A -t text (pipe-separated columns, newline-separated rows). */
      pgSql(sql: string): Chainable<string>
      /**
       * Advance the QA clock by `offset` (any time.ParseDuration
       * string, e.g. "24h", "-30m"). Admin-only at the BE; the
       * fixture pins an admin login + writes to Redis via the
       * gateway debug endpoint. Other services pick the offset up
       * within ~5 s (pkg/clock RefreshInterval).
       */
      setClockOffset(offset: string): Chainable<{ offset: string; now: string }>
      /**
       * Zero the seeded actuary's used_limit + bump session_version.
       * Idempotent (and a no-op in regular cypress:run where
       * resetBackend already reseeds the row), but load-bearing in
       * the soak-e2e harness where resetBackend is a no-op past the
       * first spec — accumulated agent trades push usedLimit past
       * the 200k cap and every subsequent qty>0 order routes to
       * pending, breaking assertions that assume auto-approve.
       */
      resetAgentLimit(): Chainable<void>
      /**
       * Clear any override on the named exchange (mic) so the
       * spec p.39 schedule fall-back applies. Idempotent. In
       * soak-e2e where prior specs left an override on XNYS, this
       * lets the next spec start from a known state.
       */
      clearExchangeOverride(mic: string): Chainable<void>
    }
  }
}

Cypress.Commands.add('resetBackend', () => {
  // Vite-dev lazy-bundles deps on first request, and cold-spec runs
  // can take 15–30s for the SPA's first paint. Hit /login once before
  // we shake the backend so the bundle is in vite's cache; the
  // ensuing reset only changes Postgres state, not vite. The visit
  // does double duty: gives the SPA a navigation context that survives
  // the docker restart, and lets us clear the auth-store sessionStorage
  // before any test runs (cypress's testIsolation otherwise leaves it
  // populated for the spec's first paint).
  cy.visit('/login', {
    onBeforeLoad: (win) => {
      win.sessionStorage.clear()
      win.localStorage.clear()
    },
  })
  cy.findByLabelText('Email', { timeout: 60000 }).should('exist')

  cy.task('resetBackend').then((res) => {
    if ((res as { ok: boolean }).ok !== true) {
      throw new Error('resetBackend failed: ' + JSON.stringify(res))
    }
  })
  cy.clearCookies()
})

Cypress.Commands.add('loginAsAdmin', () => {
  // The auth store lives in memory (Zustand, no persist), so a programmatic
  // POST won't make the SPA think it's logged in. Drive the actual login UI
  // — adds ~500ms but exercises the same code path as a real user. Vite
  // dev is HMR-heavy and the first page render after a backend restart can
  // be slow, so override findByLabelText's poll window.
  cy.visit('/login')
  cy.findByLabelText('Email', { timeout: 45000 }).clear().type(ADMIN_EMAIL)
  cy.findByLabelText('Lozinka').clear().type(ADMIN_PASSWORD)
  cy.findByRole('button', { name: /Prijavi se/ }).click()
  cy.url({ timeout: 10000 }).should('not.include', '/login')
  return cy.wrap(ADMIN_EMAIL)
})

Cypress.Commands.add('loginAsClient', () => {
  cy.visit('/login')
  cy.findByLabelText('Email', { timeout: 45000 }).clear().type(CLIENT_EMAIL)
  cy.findByLabelText('Lozinka').clear().type(CLIENT_PASSWORD)
  cy.findByRole('button', { name: /Prijavi se/ }).click()
  cy.url({ timeout: 10000 }).should('not.include', '/login')
  return cy.wrap(CLIENT_EMAIL)
})

Cypress.Commands.add('loginAsAgent', () => {
  cy.visit('/login')
  cy.findByLabelText('Email', { timeout: 45000 }).clear().type(AGENT_EMAIL)
  cy.findByLabelText('Lozinka').clear().type(AGENT_PASSWORD)
  cy.findByRole('button', { name: /Prijavi se/ }).click()
  cy.url({ timeout: 10000 }).should('not.include', '/login')
  return cy.wrap(AGENT_EMAIL)
})

Cypress.Commands.add('loginAsSupervisor', () => {
  cy.visit('/login')
  cy.findByLabelText('Email', { timeout: 45000 }).clear().type(SUPERVISOR_EMAIL)
  cy.findByLabelText('Lozinka').clear().type(SUPERVISOR_PASSWORD)
  cy.findByRole('button', { name: /Prijavi se/ }).click()
  cy.url({ timeout: 10000 }).should('not.include', '/login')
  return cy.wrap(SUPERVISOR_EMAIL)
})

Cypress.Commands.add('pgSql', (sql: string) => {
  return cy.task<string>('pgSql', { sql })
})

Cypress.Commands.add('captureLink', (to: string, marker: string) => {
  return cy.task('latestLink', { to, marker }).then((link) => {
    if (typeof link !== 'string' || link.length === 0) {
      throw new Error(`no link with marker ${marker} for ${to}`)
    }
    return cy.wrap(link as string)
  })
})

// Zero the seeded actuary's daily used_limit so the next order in
// soak-e2e auto-approves regardless of accumulated state. pgSql
// because the API equivalent (POST /actuaries/{id}/used-limit/reset)
// would need the supervisor-token dance per call.
Cypress.Commands.add('resetAgentLimit', () => {
  return cy.pgSql(`
    UPDATE "trading".actuary_info ai
       SET used_limit = '0', updated_at = now()
      FROM "user".employees e
     WHERE e.id = ai.employee_id
       AND e.email = 'aktuar@banka.local'
  `) as unknown as Cypress.Chainable<void>
})

// Clear any override on the named exchange.
Cypress.Commands.add('clearExchangeOverride', (mic: string) => {
  return cy
    .request({
      method: 'POST',
      url: '/api/v1/auth/login',
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    })
    .then((login) => {
      const tok = login.body.accessToken as string
      return cy.request({
        method: 'PATCH',
        url: `/api/v1/exchanges/${mic}/override`,
        headers: { Authorization: `Bearer ${tok}`, 'Idempotency-Key': crypto.randomUUID() },
        body: { state: '' },
      })
    }) as unknown as Cypress.Chainable<void>
})

// Advance the QA clock by `offset` via the gateway debug endpoint.
// Admin-only; logs in inline. Other services pick up the new offset
// within ~5 s (pkg/clock RefreshInterval) — specs that need an
// immediate observation can cy.wait(6000) after this.
Cypress.Commands.add('setClockOffset', (offset: string) => {
  return cy
    .request({
      method: 'POST',
      url: '/api/v1/auth/login',
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    })
    .then((login) => {
      const tok = login.body.accessToken as string
      return cy.request({
        method: 'POST',
        url: '/api/v1/_debug/clock',
        headers: { Authorization: `Bearer ${tok}`, 'Idempotency-Key': crypto.randomUUID() },
        body: { offset },
      })
    })
    .then((r) => {
      expect(r.status, 'setClockOffset accepted').to.eq(200)
      return cy.wrap(r.body as { offset: string; now: string })
    })
})

export {}
