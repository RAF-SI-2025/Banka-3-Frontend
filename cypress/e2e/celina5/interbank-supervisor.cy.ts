/// <reference types="cypress" />

export {}

// Celina 5 — supervisor/admin inter-bank observability & control portal
// under /portal/medjubankarske. Three sub-pages:
//   * index         — "Međubankarske transakcije" (2PC tx status board)
//   * komunikacija   — "Međubankarska komunikacija" (inbound message audit)
//   * blokade        — "Blokirane banke" (partner blacklist + manual
//                       block / unblock)
//
// Single-stack coverage: live inter-bank tx + comms data needs a partner
// bank to round-trip, so for those two pages we assert the page LOADS and
// renders its empty-state (no 500 / broken route). The blacklist control
// path is fully local (writes bank.interbank_blacklist), so we drive the
// manual block → unblock flow end-to-end. We also assert access control:
// a client is redirected away from the portal section.

const CLIENT_EMAIL = 'klijent@banka.local'
const CLIENT_PASSWORD = 'Klijent123!'

const PARTNER_ROUTING = '444'

function loginViaUi(email: string, password: string): void {
  cy.visit('/login')
  cy.findByLabelText('Email', { timeout: 30000 }).clear().type(email)
  cy.findByLabelText('Lozinka').clear().type(password)
  cy.findByRole('button', { name: /Prijavi se/ }).click()
  cy.url({ timeout: 10000 }).should('not.include', '/login')
}

function clearAuth(): void {
  cy.clearCookies()
  cy.window().then((w) => {
    w.sessionStorage.clear()
    w.localStorage.clear()
  })
}

describe('Celina 5 — inter-bank supervisor portal', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('transakcije + komunikacija stranice se učitavaju (prazno stanje)', () => {
    cy.loginAsSupervisor()

    // Transactions board.
    cy.visit('/portal/medjubankarske')
    cy.contains('h1', 'Međubankarske transakcije', { timeout: 15000 }).should('be.visible')
    // No partner traffic yet → empty row, page rendered (no 500).
    cy.contains('Nema transakcija.', { timeout: 15000 }).should('be.visible')

    // Comms / audit board.
    cy.visit('/portal/medjubankarske/komunikacija')
    cy.contains('h1', 'Međubankarska komunikacija', { timeout: 15000 }).should('be.visible')
    cy.contains('Nema zapisa.', { timeout: 15000 }).should('be.visible')

    // Blacklist board.
    cy.visit('/portal/medjubankarske/blokade')
    cy.contains('h1', 'Blokirane banke', { timeout: 15000 }).should('be.visible')
    cy.contains('Nema blokiranih banaka.', { timeout: 15000 }).should('be.visible')
  })

  it('blokade: ručno blokira partnera, prikazuje ga, pa odblokira', () => {
    cy.loginAsSupervisor()
    cy.visit('/portal/medjubankarske/blokade')
    cy.contains('h1', 'Blokirane banke', { timeout: 15000 }).should('be.visible')
    cy.contains('Nema blokiranih banaka.', { timeout: 15000 }).should('be.visible')

    // Manual block via the form.
    cy.findByPlaceholderText('npr. 444').clear().type(PARTNER_ROUTING)
    cy.findByPlaceholderText('npr. sumnjiva aktivnost').clear().type('cypress test blokada')
    cy.contains('button', 'Blokiraj').click()

    // The active blacklist now shows the partner row with our reason and
    // an "Aktivna blokada" status.
    cy.contains('tr', PARTNER_ROUTING, { timeout: 15000 }).should('be.visible')
    cy.contains('tr', PARTNER_ROUTING).should('contain', 'cypress test blokada')
    cy.contains('tr', PARTNER_ROUTING).should('contain', 'Aktivna blokada')
    // Cross-check the DB write landed.
    cy.pgSql(
      `SELECT active::text FROM "bank".interbank_blacklist
        WHERE sender_routing_number = ${PARTNER_ROUTING}`,
    ).then((s) => {
      expect((s as string).trim(), 'blacklist row active').to.eq('true')
    })

    // Unblock → the row leaves the active list (default view is
    // active-only). The audit row is retained (active=false) but hidden
    // until "Prikaži i istoriju" is checked.
    cy.contains('tr', PARTNER_ROUTING).contains('button', 'Odblokiraj').click()
    cy.contains('Nema blokiranih banaka.', { timeout: 15000 }).should('be.visible')

    // History view surfaces the now-inactive row as "Odblokirana".
    cy.contains('label', 'Prikaži i istoriju').find('input[type="checkbox"]').check()
    cy.contains('tr', PARTNER_ROUTING, { timeout: 15000 }).should('contain', 'Odblokirana')

    cy.pgSql(
      `SELECT active::text FROM "bank".interbank_blacklist
        WHERE sender_routing_number = ${PARTNER_ROUTING}`,
    ).then((s) => {
      expect((s as string).trim(), 'blacklist row deactivated').to.eq('false')
    })
  })

  it('blokade: prikazuje unapred zasejanu blokadu (pgSql fixture)', () => {
    // Plant an active blacklist row directly so the list renders a row
    // independent of the manual-block UI path.
    cy.pgSql(
      `INSERT INTO "bank".interbank_blacklist
         (sender_routing_number, reason, blocked_by, active)
       VALUES (555, 'zasejana sumnjiva aktivnost', 'system', true)
       ON CONFLICT (sender_routing_number)
       DO UPDATE SET active = true, reason = excluded.reason,
                     blocked_by = excluded.blocked_by, unblocked_at = null`,
    )

    cy.loginAsSupervisor()
    cy.visit('/portal/medjubankarske/blokade')
    cy.contains('h1', 'Blokirane banke', { timeout: 15000 }).should('be.visible')
    cy.contains('tr', '555', { timeout: 15000 })
      .should('contain', 'zasejana sumnjiva aktivnost')
      .and('contain', 'Aktivna blokada')
    // Auto-blocks (blocked_by='system') render as "Automatski".
    cy.contains('tr', '555').should('contain', 'Automatski')
  })

  it('access control: klijent ne može da pristupi inter-bank portalu', () => {
    clearAuth()
    loginViaUi(CLIENT_EMAIL, CLIENT_PASSWORD)
    // A client hitting the portal section is redirected out (portal layer
    // sends clients to /banking; the route guard also fires).
    cy.visit('/portal/medjubankarske')
    cy.url({ timeout: 10000 }).should('not.include', '/medjubankarske')
    cy.visit('/portal/medjubankarske/blokade')
    cy.url({ timeout: 10000 }).should('not.include', '/medjubankarske')
  })
})
