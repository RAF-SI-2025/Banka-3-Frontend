/// <reference types="cypress" />

// FE-10 + FE-11: portal-side trading.
//   - agent placing an order over their daily limit sees the
//     "ide na odobrenje" pending badge
//   - supervisor lists orders, sees the spec p.57 column set,
//     and the cekajuci shortcut redirects to status=pending
//   - agent without supervisor perm cannot approve/decline
//
// Live against the seeded aktuar (200k RSD daily limit) +
// supervizor + AAPL (~$190 ≈ 19k RSD/share, so qty 12 ≈ 230k RSD
// crosses the limit, qty 1 stays well under).

function navigateToAaplDetailAsAgent() {
  cy.visit('/portal/trgovina')
  cy.contains('h1', 'Trgovina', { timeout: 15000 }).should('be.visible')
  cy.get('[data-cy="filter-search"]').clear().type('AAPL')
  cy.contains('tr', 'AAPL', { timeout: 10000 }).click()
  cy.url({ timeout: 10000 }).should('match', /\/portal\/trgovina\/[0-9a-f-]+/)
}

function selectActuaryUsdAccount() {
  cy.get('#of-acct')
    .find('option')
    .contains('USD')
    .then((opt) => cy.get('#of-acct').select(opt.attr('value') as string))
}

describe('Celina 3 — portal trading (agent limit panel)', () => {
  beforeEach(() => {
    cy.resetBackend()
    // Normalize agent.used_limit. In the soak-e2e harness resetBackend
    // is a no-op past spec #1, so accumulated agent trades push
    // usedLimit past 200k and the qty=1 "stays under cap" assertion
    // below flips to needing approval. Idempotent in cypress:run too.
    cy.resetAgentLimit()
    cy.loginAsAgent()
  })

  it('shows pending-approval badge once the form crosses the limit', () => {
    navigateToAaplDetailAsAgent()
    cy.get('#order-form').within(() => {
      // 200k RSD daily limit; 1 USD ≈ 100 RSD; AAPL ~ $190 ≈ 19k RSD;
      // qty 12 ≈ 230k RSD, comfortably over the limit.
      cy.get('#of-qty').clear().type('12')
      selectActuaryUsdAccount()
      cy.get('[data-cy="limit-panel"]', { timeout: 10000 }).should('be.visible')
      cy.get('[data-cy="needs-approval"]', { timeout: 10000 })
        .should('be.visible')
        .and('contain', 'odobrenje')
    })
  })

  it('does not show needs-approval badge when projected stays under the cap', () => {
    navigateToAaplDetailAsAgent()
    cy.get('#order-form').within(() => {
      // qty 1 ≈ 19k RSD ≪ 200k cap.
      cy.get('#of-qty').clear().type('1')
      selectActuaryUsdAccount()
      cy.get('[data-cy="limit-panel"]', { timeout: 10000 }).should('be.visible')
      cy.get('[data-cy="needs-approval"]').should('not.exist')
    })
  })
})

describe('Celina 3 — portal trading (supervisor)', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('renders the spec p.57 column set on Pregled naloga', () => {
    cy.loginAsSupervisor()
    cy.visit('/portal/trgovina/nalozi')
    cy.contains('h1', 'Pregled naloga', { timeout: 15000 }).should('be.visible')
    cy.contains('th', 'Kreirano').should('be.visible')
    cy.contains('th', 'Agent').should('be.visible')
    cy.contains('th', 'Tip').should('be.visible')
    cy.contains('th', 'Hartija').should('be.visible')
    cy.contains('th', 'Količina').should('be.visible')
    cy.contains('th', 'Veličina ugovora').should('be.visible')
    cy.contains('th', 'Cena/jed.').should('be.visible')
    cy.contains('th', 'Smer').should('be.visible')
    cy.contains('th', 'Preostalo').should('be.visible')
    cy.contains('th', 'Status').should('be.visible')
  })

  it('cekajuci preset redirects to status=pending', () => {
    cy.loginAsSupervisor()
    cy.visit('/portal/trgovina/nalozi/cekajuci')
    cy.location('pathname', { timeout: 10000 }).should('eq', '/portal/trgovina/nalozi')
    cy.location('search').should('include', 'status=pending')
  })

  it('agent without supervisor perm cannot act on orders', () => {
    cy.loginAsAgent()
    cy.visit('/portal/trgovina/nalozi')
    cy.contains('h1', /Pregled naloga|Moji nalozi/, { timeout: 15000 }).should('be.visible')
    cy.get('[data-cy="approve-order"]').should('not.exist')
    cy.get('[data-cy="decline-order"]').should('not.exist')
    cy.get('[data-cy="filter-user"]').should('not.exist')
  })
})
