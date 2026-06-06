/// <reference types="cypress" />

// Live-backend c1 spec — audit log (todoSpec S40–S46).
//
// A supervisor changing an agent's daily limit emits a `limit.change`
// audit entry (services/trading/internal/service/actuaries.go: the
// UpdateActuaryLimit path records action="limit.change" against the
// agent, with old→new daily limit). The audit-log page
// (/portal/audit-log) renders who/when + old→new and filters by action
// type + by user. Clients are denied the page (S46).
//
// The limit change at /portal/aktuari/$id is NOT verification-gated (the
// gateway's DefaultRules only gate /accounts/{id}/limits + /cards/{id}/
// limit), so the supervisor can save it directly — no code dialog here.

const AGENT_EMAIL = 'aktuar@banka.local'

describe('Celina 1 — audit log (live backend)', () => {
  beforeEach(() => {
    cy.resetBackend()
    cy.resetAgentLimit()
  })

  it('supervizor menja limit agentu → zapis se vidi u audit logu (S40–S43)', () => {
    // ---- Phase 1: supervisor opens the agent + changes the daily limit.
    cy.loginAsSupervisor()
    cy.visit('/portal/aktuari')
    cy.contains('h1', 'Aktuari', { timeout: 15000 }).should('be.visible')
    // Row click navigates to the detail page (whole <tr> is clickable).
    cy.contains('tr', AGENT_EMAIL, { timeout: 10000 }).click()
    cy.url({ timeout: 10000 }).should('match', /\/portal\/aktuari\/[0-9a-f-]+/)

    // Seed default daily_limit is 200000; bump to 250000.
    cy.get('[data-cy="daily-limit-input"]', { timeout: 10000 }).clear().type('250000')
    cy.get('[data-cy="save-limit"]').click()
    // The "Trenutno" hint re-renders with the saved value once the
    // mutation invalidates the query.
    cy.contains('Trenutno: 250.000,00 RSD', { timeout: 10000 }).should('be.visible')

    // ---- Phase 2: open the audit log, see the limit-change entry.
    cy.visit('/portal/audit-log')
    cy.contains('h1', 'Audit log', { timeout: 15000 }).should('be.visible')
    cy.contains('tr', 'Promena limita', { timeout: 10000 })
      .should('be.visible')
      // old → new: 200000 → 250000 (rendered verbatim from oldValue/newValue).
      .within(() => {
        cy.contains('200000').should('exist')
        cy.contains('250000').should('exist')
      })
  })

  it('filter po tipu akcije i po korisniku (S44/S45)', () => {
    // Produce a limit-change entry first.
    cy.loginAsSupervisor()
    cy.visit('/portal/aktuari')
    cy.contains('tr', AGENT_EMAIL, { timeout: 15000 }).click()
    cy.url({ timeout: 10000 }).should('match', /\/portal\/aktuari\/[0-9a-f-]+/)
    cy.get('[data-cy="daily-limit-input"]', { timeout: 10000 }).clear().type('210000')
    cy.get('[data-cy="save-limit"]').click()
    cy.contains('Trenutno: 210.000,00 RSD', { timeout: 10000 }).should('be.visible')

    cy.visit('/portal/audit-log')
    cy.contains('h1', 'Audit log', { timeout: 15000 }).should('be.visible')

    // S44 — filter by action type. The "Tip akcije" <select> uses the
    // action key as the option value; "Promena limita" → limit.change.
    cy.contains('label', 'Tip akcije').find('select').select('limit.change')
    cy.contains('tr', 'Promena limita', { timeout: 10000 }).should('be.visible')

    // S45 — filter by user. The supervisor performed the action; their
    // display name is the actor. Filtering by their name keeps the row;
    // a nonsense needle empties the table.
    cy.contains('label', 'Korisnik').find('input').clear().type('NepostojeciKorisnik123')
    cy.contains('Nema zapisa.', { timeout: 10000 }).should('be.visible')
  })

  it('klijentu je zabranjen pristup audit logu (S46)', () => {
    // The /portal layout redirects clients to /banking before the
    // audit-log route's own admin/supervisor gate even runs, so a client
    // visiting /portal/audit-log lands in the banking app, never on the log.
    cy.loginAsClient()
    cy.visit('/portal/audit-log')
    cy.url({ timeout: 10000 }).should('include', '/banking')
    cy.url().should('not.include', '/audit-log')
    cy.contains('h1', 'Audit log').should('not.exist')
  })
})
