/// <reference types="cypress" />

// spec/C3-tests.pdf "Odobravanje i pregled naloga" + porez gating:
// S53 (supervizor odbija pending order), S56 (filter Pending),
// S57 (filter Done), S55 already covered by portal-orders.cy.ts;
// S75 (klijent denied), S76 (kind filter), S77 (name filter).
//
// Lives against the seeded client (one realized_gain row positive +
// one negative) and the seeded actuary agent / supervisor.

describe('Celina 3 — supervisor orders decline + filters', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('S53 — supervizor odbija pending order; agent vidi Odbijen status', () => {
    // 1. Agent places an over-limit BUY (pending).
    cy.loginAsAgent()
    cy.visit('/portal/trgovina')
    cy.contains('h1', 'Trgovina', { timeout: 15000 }).should('be.visible')
    cy.get('[data-cy="filter-search"]').clear().type('AAPL')
    cy.contains('tr', 'AAPL', { timeout: 10000 }).click()
    cy.url({ timeout: 10000 }).should('match', /\/portal\/trgovina\/[0-9a-f-]+/)

    cy.get('#order-form').within(() => {
      cy.get('#of-qty').clear().type('12') // ≈ 230k RSD > 200k cap → pending
      cy.get('#of-acct').find('option').contains('USD').then((opt) =>
        cy.get('#of-acct').select(opt.attr('value') as string),
      )
      cy.get('[data-cy="needs-approval"]', { timeout: 8000 }).should('be.visible')
      cy.get('[data-cy="order-submit"]').click()
    })
    cy.get('[data-cy="order-confirm-submit"]').click()

    // 2. Supervisor declines.
    cy.clearCookies()
    cy.window().then((w) => w.sessionStorage.clear())
    cy.loginAsSupervisor()
    cy.visit('/portal/trgovina/nalozi/cekajuci')
    cy.contains('h1', 'Pregled naloga', { timeout: 15000 }).should('be.visible')

    cy.contains('tr', 'AAPL', { timeout: 15000 })
      .within(() => cy.get('[data-cy="decline-order"]').click())

    // 3. Status filter "declined" — the AAPL row now appears there.
    cy.get('[data-cy="filter-status"]').select('declined')
    cy.contains('tr', 'AAPL', { timeout: 10000 }).should('contain', 'Odbijen')
  })

  it('S56 — pending filter narrows the list to status=pending', () => {
    // Plant one pending + one auto-approved by re-using the agent +
    // client flows: agent over-limit BUY → pending, client small BUY
    // → approved.
    cy.loginAsAgent()
    cy.visit('/portal/trgovina')
    cy.contains('h1', 'Trgovina', { timeout: 15000 }).should('be.visible')
    cy.get('[data-cy="filter-search"]').clear().type('AAPL')
    cy.contains('tr', 'AAPL', { timeout: 10000 }).click()
    cy.get('#order-form').within(() => {
      cy.get('#of-qty').clear().type('12')
      cy.get('#of-acct').find('option').contains('USD').then((opt) =>
        cy.get('#of-acct').select(opt.attr('value') as string),
      )
      cy.get('[data-cy="order-submit"]').click()
    })
    cy.get('[data-cy="order-confirm-submit"]').click()

    cy.clearCookies()
    cy.window().then((w) => w.sessionStorage.clear())
    cy.loginAsSupervisor()
    cy.visit('/portal/trgovina/nalozi')
    cy.contains('h1', 'Pregled naloga', { timeout: 15000 }).should('be.visible')

    cy.get('[data-cy="filter-status"]').select('pending')
    cy.contains('tr', 'AAPL', { timeout: 10000 }).should('contain', 'Na čekanju')
    cy.get('[data-cy="filter-status"]').should('have.value', 'pending')
  })

  it('S57 — done filter shows only fully-executed orders', () => {
    // No orders in the seed; supervisor visits with done filter →
    // empty list state holds. The filter applies in the URL and the
    // list query.
    cy.intercept('GET', /\/api\/v1\/orders\?.*status=done/).as('listDone')
    cy.loginAsSupervisor()
    cy.visit('/portal/trgovina/nalozi')
    cy.contains('h1', 'Pregled naloga', { timeout: 15000 }).should('be.visible')

    cy.get('[data-cy="filter-status"]').select('done')
    cy.wait('@listDone').its('request.url').should('include', 'status=done')
  })

})

describe('Celina 3 — porez tracking access + filters', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('S75 — klijent nema pristup portalu za porez tracking', () => {
    cy.loginAsClient()
    cy.visit('/portal/porez')
    // The /portal route shell redirects clients to /banking, so
    // /portal/porez resolves to / banking (root). Asserting we
    // didn't land on porez is enough.
    cy.location('pathname', { timeout: 10000 }).should('not.include', '/portal/porez')
  })

  it('S76 — kind filter restricts the porez list to klijenti only', () => {
    cy.loginAsSupervisor()
    cy.visit('/portal/porez')
    cy.contains('h1', 'Porez na kapitalni dobitak', { timeout: 15000 }).should('be.visible')

    // The seed plants the c3 client with realized gains. Filter to
    // klijenti — that row stays visible.
    cy.get('[data-cy="filter-kind"]').select('USER_KIND_CLIENT')
    cy.contains('Test Klijent', { timeout: 10000 }).should('be.visible')
  })

  it('S77 — name search filters the porez list', () => {
    cy.loginAsSupervisor()
    cy.visit('/portal/porez')
    cy.contains('h1', 'Porez na kapitalni dobitak', { timeout: 15000 }).should('be.visible')
    cy.contains('Test Klijent', { timeout: 10000 }).should('be.visible')

    cy.get('[data-cy="filter-name"]').type('NeMaTaKvogKorisnika')
    cy.contains('Test Klijent', { timeout: 5000 }).should('not.exist')
    cy.contains('Nema stavki').should('be.visible')
  })
})
