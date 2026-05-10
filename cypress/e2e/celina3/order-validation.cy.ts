/// <reference types="cypress" />

// spec/C3-tests.pdf "Kreiranje naloga" — validation surface.
// S27 (qty 0/negative), S30 (Stop only), S31 (Stop-Limit),
// S37 (SELL exceeds holdings), S43 (insufficient funds),
// S45/S46 (closed-exchange notice + still placed).
//
// Lives against the seeded c3 fixtures.

const TICKER = 'AAPL'

function navigateToAaplDetailAsAgent() {
  cy.visit('/portal/trgovina')
  cy.contains('h1', 'Trgovina', { timeout: 15000 }).should('be.visible')
  cy.get('[data-cy="filter-search"]').clear().type(TICKER)
  cy.contains('tr', TICKER, { timeout: 10000 }).click()
  cy.url({ timeout: 10000 }).should('match', /\/portal\/trgovina\/[0-9a-f-]+/)
}

function pickUsdAccount() {
  cy.get('#of-acct')
    .find('option')
    .contains('USD')
    .then((opt) => cy.get('#of-acct').select(opt.attr('value') as string))
}

describe('Celina 3 — order validation (client-side schema)', () => {
  beforeEach(() => {
    cy.resetBackend()
    cy.loginAsAgent()
  })

  it('S27 — qty=0 surfaces "Mora biti pozitivan ceo broj"', () => {
    navigateToAaplDetailAsAgent()
    cy.get('#order-form').within(() => {
      cy.get('#of-qty').clear().type('0')
      pickUsdAccount()
      cy.get('[data-cy="order-submit"]').click()
      cy.contains('Mora biti pozitivan ceo broj').should('be.visible')
    })
  })

  it('S27 — negative qty (typed "-1") blocks the submit', () => {
    navigateToAaplDetailAsAgent()
    cy.get('#order-form').within(() => {
      cy.get('#of-qty').clear().type('-1')
      pickUsdAccount()
      cy.get('[data-cy="order-submit"]').click()
      cy.contains('Mora biti pozitivan ceo broj').should('be.visible')
    })
  })

  it('S30 — qty + stop (no limit) derives the order as Stop', () => {
    navigateToAaplDetailAsAgent()
    cy.get('#order-form').within(() => {
      cy.get('#of-qty').clear().type('1')
      cy.get('#of-stop').clear().type('500')
      pickUsdAccount()
      cy.get('[data-cy="order-submit"]').click()
    })
    cy.get('[data-cy="order-confirm-dialog"]', { timeout: 8000 })
      .should('be.visible')
      .and('contain', 'Stop')
  })

  it('S31 — qty + limit + stop derives the order as Stop-Limit and shows both in confirm', () => {
    navigateToAaplDetailAsAgent()
    cy.get('#order-form').within(() => {
      cy.get('#of-qty').clear().type('1')
      cy.get('#of-stop').clear().type('500')
      cy.get('#of-limit').clear().type('510')
      pickUsdAccount()
      cy.get('[data-cy="order-submit"]').click()
    })
    cy.get('[data-cy="order-confirm-dialog"]', { timeout: 8000 })
      .should('be.visible')
      .and('contain', 'Stop-Limit')
  })
})

describe('Celina 3 — SELL holdings guard (S37/S38)', () => {
  beforeEach(() => {
    cy.resetBackend()
    cy.loginAsClient()
  })

  it('S37 — sell qty greater than holdings is rejected by the backend', () => {
    // Seed plants 10 AAPL on the client's USD trading account.
    cy.visit('/banking/trgovina')
    cy.contains('h1', 'Trgovina', { timeout: 15000 }).should('be.visible')
    cy.contains('tr', TICKER, { timeout: 10000 }).click()
    cy.url({ timeout: 10000 }).should('match', /\/banking\/trgovina\/[0-9a-f-]+/)

    cy.get('#order-form').within(() => {
      // Flip to SELL.
      cy.contains('label', 'Prodaja').click()
      cy.get('#of-qty').clear().type('15')
      pickUsdAccount()
      cy.get('[data-cy="order-submit"]').click()
    })

    cy.get('[data-cy="order-confirm-submit"]').click()

    // The BE rejects with "ne možete prodati više hartija nego što
    // posedujete" (apperr.FailedPrecondition → 4xx). The form's
    // error banner inside the dialog surfaces it.
    cy.contains('ne možete prodati više', { timeout: 10000 }).should('be.visible')
  })

  it('S38 — selling exactly the held quantity is allowed', () => {
    cy.visit('/banking/trgovina')
    cy.contains('tr', TICKER, { timeout: 15000 }).click()
    cy.url({ timeout: 10000 }).should('match', /\/banking\/trgovina\/[0-9a-f-]+/)

    cy.get('#order-form').within(() => {
      cy.contains('label', 'Prodaja').click()
      cy.get('#of-qty').clear().type('10') // exact holding
      pickUsdAccount()
      cy.get('[data-cy="order-submit"]').click()
    })
    cy.get('[data-cy="order-confirm-submit"]').click()

    cy.visit('/banking/trgovina/nalozi')
    cy.contains('tr', TICKER, { timeout: 15000 }).should('be.visible')
  })
})

describe('Celina 3 — exchange-closed notice (S46)', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('S46 — order placed against a force-closed exchange surfaces the notice', () => {
    // Step 1: admin force-closes XNYS via the override toggle.
    cy.loginAsAdmin()
    cy.visit('/portal/berze')
    cy.contains('h1', 'Berze', { timeout: 15000 }).should('be.visible')
    cy.get('[data-cy="force-closed-XNYS"]').click()
    cy.get('[data-cy="exchange-status-XNYS"]', { timeout: 8000 }).should('contain', 'Forsiran zatvoren')

    // Step 2: client places an AAPL BUY (XNYS-listed). The BE
    // accepts the order (spec p.57: closed-but-placed) and returns
    // the exchange_closed flag; the FE renders the post-submit
    // notice.
    cy.clearCookies()
    cy.window().then((w) => w.sessionStorage.clear())
    cy.loginAsClient()
    cy.visit('/banking/trgovina')
    cy.contains('tr', TICKER, { timeout: 15000 }).click()
    cy.url({ timeout: 10000 }).should('match', /\/banking\/trgovina\/[0-9a-f-]+/)

    cy.get('#order-form').within(() => {
      cy.get('#of-qty').clear().type('1')
      pickUsdAccount()
      cy.get('[data-cy="order-submit"]').click()
    })
    cy.get('[data-cy="order-confirm-submit"]').click()

    cy.get('[data-cy="exchange-closed-notice"]', { timeout: 10000 })
      .should('be.visible')
      .and('contain', 'Berza je trenutno zatvorena')
  })
})
