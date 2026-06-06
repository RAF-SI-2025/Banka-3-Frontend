/// <reference types="cypress" />

// Recurring orders / "Trajni nalog" (DCA — todoSpec C3 S47-S53). Live
// against the seeded c3 stack.
//
// klijent@banka.local has trading.client + a USD trading account
// ("Trgovinski USD") and the seeded RSD accounts from c2. The page lives
// at /banking/trgovina/trajni-nalozi (src/components/trading/
// RecurringOrdersPage.tsx) and is fully instrumented with data-cy hooks.
//
// The cron that materialises each recurring order into a real market
// order is a scheduler job (pkg/schedule), not Cypress-drivable — so we
// test the drivable surface: create BYAMOUNT / BYQUANTITY, the NextRun
// stamp, pause, and cancel. resetBackend truncates trading.* so each test
// starts with no recurring orders.

function openDca() {
  cy.loginAsClient()
  cy.visit('/banking/trgovina/trajni-nalozi')
  cy.contains('h1', 'Trajni nalog', { timeout: 15000 }).should('be.visible')
}

function pickSecurity(ticker: string) {
  cy.get('[data-cy="recurring-security"]').find('option').contains(ticker).then((opt) => {
    cy.get('[data-cy="recurring-security"]').select(opt.attr('value') as string)
  })
}

function pickAnyAccount() {
  // Any active account works for the form; pick the first non-placeholder.
  cy.get('[data-cy="recurring-account"]').find('option').eq(1).then((opt) => {
    cy.get('[data-cy="recurring-account"]').select(opt.attr('value') as string)
  })
}

describe('Celina 3 — trajni nalog / DCA (S47-S53)', () => {
  beforeEach(() => {
    cy.resetBackend()
    cy.clearExchangeOverride('XNYS')
  })

  it('S47-S48 — creates a BYAMOUNT recurring order (MSFT, 5000 RSD, MONTHLY) that is active with a NextRun', () => {
    openDca()

    pickSecurity('MSFT')
    cy.get('[data-cy="recurring-mode"]').select('RECURRING_MODE_BYAMOUNT')
    cy.get('[data-cy="recurring-amount"]').clear().type('5000')
    cy.get('[data-cy="recurring-cadence"]').select('MONTHLY')
    pickAnyAccount()
    cy.get('[data-cy="recurring-submit"]').click()

    // The new order shows up in "Moji trajni nalozi" — active, MSFT,
    // 5.000,00 RSD, with a "Sledeće:" next-run timestamp.
    cy.get('[data-cy="recurring-list"]', { timeout: 15000 }).find('[data-cy="recurring-item"]').should('have.length', 1)
    cy.get('[data-cy="recurring-item"]').within(() => {
      cy.get('[data-cy="recurring-item-ticker"]').should('contain', 'MSFT')
      cy.get('[data-cy="recurring-item-status"]').should('contain', 'Aktivan')
      cy.contains('Sledeće:').should('be.visible')
    })

    // SKIP (cron-driven): S49/S50/S53 — the materialisation of this
    // recurring order into a real market order at next_run (and the
    // skip-on-insufficient-funds path) is a scheduler job; covered by
    // backend unit tests. We assert the persisted row + next_run instead.
    cy.pgSql(`
      SELECT mode, amount_rsd, cadence, active, (next_run IS NOT NULL)
        FROM "trading".recurring_orders ORDER BY created_at DESC LIMIT 1
    `).then((row) => {
      expect(row).to.contain('BYAMOUNT')
      expect(row).to.contain('MONTHLY')
      // active=true and next_run is set.
      expect(row).to.contain('|t|t')
    })
  })

  it('S51 — creates a BYQUANTITY recurring order (AAPL, 5, WEEKLY)', () => {
    openDca()

    pickSecurity('AAPL')
    cy.get('[data-cy="recurring-mode"]').select('RECURRING_MODE_BYQUANTITY')
    cy.get('[data-cy="recurring-quantity"]').clear().type('5')
    cy.get('[data-cy="recurring-cadence"]').select('WEEKLY')
    pickAnyAccount()
    cy.get('[data-cy="recurring-submit"]').click()

    cy.get('[data-cy="recurring-item"]', { timeout: 15000 }).should('have.length', 1)
    cy.get('[data-cy="recurring-item"]').within(() => {
      cy.get('[data-cy="recurring-item-ticker"]').should('contain', 'AAPL')
      // BYQUANTITY renders "5 kom.".
      cy.contains('5 kom.').should('be.visible')
      cy.get('[data-cy="recurring-item-status"]').should('contain', 'Aktivan')
    })
  })

  it('S52 — pauses an active recurring order, then cancels it (gone from the list)', () => {
    openDca()

    pickSecurity('MSFT')
    cy.get('[data-cy="recurring-mode"]').select('RECURRING_MODE_BYAMOUNT')
    cy.get('[data-cy="recurring-amount"]').clear().type('5000')
    cy.get('[data-cy="recurring-cadence"]').select('MONTHLY')
    pickAnyAccount()
    cy.get('[data-cy="recurring-submit"]').click()
    cy.get('[data-cy="recurring-item"]', { timeout: 15000 }).should('have.length', 1)

    // Pause → status flips to "Pauziran" and a "Nastavi" affordance appears.
    cy.get('[data-cy="recurring-pause"]').click()
    cy.get('[data-cy="recurring-item-status"]', { timeout: 10000 }).should('contain', 'Pauziran')
    cy.get('[data-cy="recurring-resume"]').should('be.visible')

    // Cancel → row disappears (cancelled orders drop out of the active list).
    cy.get('[data-cy="recurring-cancel"]').click()
    cy.get('[data-cy="recurring-empty"]', { timeout: 10000 }).should('be.visible')
    cy.get('[data-cy="recurring-item"]').should('not.exist')
  })
})
