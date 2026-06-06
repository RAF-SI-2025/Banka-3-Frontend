/// <reference types="cypress" />

export {}

// todoSpec C4 S69-S72 — fund dividend handling.
//
//   S70 — the fund manager (supervisor) toggles the fund's
//         "Reinvestiranje dividendi" flag; it persists across reloads.
//   S71 — the per-client dividend-distribution history renders on the
//         fund detail ("Raspodela dividendi" table).
//
// The actual dividend *distribution computation* runs in the quarterly
// dividend cron (ListDividendCandidates → SettleDividend → proportional
// split into fund_dividend_distributions). That is not Cypress-drivable
// from a single stack — SKIP (cron), see note below. We plant a
// fund_dividend_distributions row via cy.pgSql and assert the FE renders
// it, which is what the new S71 UI surfaces.

const FUND_NAME = 'Dividend Fond'
const FUND_MIN = 1_000

// Resolve any seeded security id for the dividend_payouts FK (the
// payout's security is irrelevant to the FE distribution table, which
// only reads client/units/amount).
function anySecurityId(): Cypress.Chainable<string> {
  return cy
    .pgSql(`SELECT id FROM "trading".securities WHERE type = 'stock' LIMIT 1`)
    .then((s) => {
      const id = (s as string).trim()
      if (!id) throw new Error('no seeded security to anchor dividend payout')
      return id
    })
}

describe('Celina 4 — fund dividends (S70 reinvest toggle, S71 history)', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('S70 — menadžer (supervizor) menja reinvestiranje dividendi i promena se zadržava', () => {
    // Create the fund through the UI so we exercise the real create path
    // and land on the detail page.
    cy.loginAsSupervisor()
    cy.visit('/portal/fondovi')
    cy.contains('h1', 'Investicioni fondovi', { timeout: 15000 }).should('be.visible')
    cy.get('[data-cy="funds-create"]').click()
    cy.contains('Kreiraj fond').should('be.visible')
    cy.get('[data-cy="fund-name"]').type(FUND_NAME)
    cy.get('[data-cy="fund-description"]').type('Fond za S70/S71 dividend test')
    cy.get('[data-cy="fund-min"]').type(String(FUND_MIN))
    cy.get('[data-cy="fund-create-submit"]').click()

    cy.url({ timeout: 15000 }).should('match', /\/portal\/fondovi\/[0-9a-f-]+/)
    cy.contains('[data-cy="fund-detail-name"]', FUND_NAME).should('be.visible')

    // Default is "Isključeno". Toggle on; the button re-renders from the
    // refetched fund (data-on flips to "true"); reload to prove it stuck.
    cy.get('[data-cy="fund-reinvest-toggle"]')
      .should('have.attr', 'data-on', 'false')
      .and('contain', 'Isključeno')
      .click()
    cy.get('[data-cy="fund-reinvest-toggle"]', { timeout: 15000 })
      .should('have.attr', 'data-on', 'true')
      .and('contain', 'Uključeno')

    cy.reload()
    cy.get('[data-cy="fund-reinvest-toggle"]', { timeout: 15000 })
      .should('have.attr', 'data-on', 'true')
      .and('contain', 'Uključeno')

    // Toggle back off — the mutation round-trips both directions.
    cy.get('[data-cy="fund-reinvest-toggle"]').click()
    cy.get('[data-cy="fund-reinvest-toggle"]', { timeout: 15000 })
      .should('have.attr', 'data-on', 'false')
      .and('contain', 'Isključeno')
  })

  it('S71 — raspodela dividendi po klijentima se prikazuje u istoriji fonda', () => {
    // SKIP (cron): distribution computation — the quarterly dividend cron
    // computes + writes fund_dividend_distributions. Here we plant one
    // distribution row directly so the new "Raspodela dividendi" table is
    // asserted to render the persisted attribution.
    cy.loginAsSupervisor()
    cy.visit('/portal/fondovi')
    cy.contains('h1', 'Investicioni fondovi', { timeout: 15000 }).should('be.visible')
    cy.get('[data-cy="funds-create"]').click()
    cy.get('[data-cy="fund-name"]').type(FUND_NAME)
    cy.get('[data-cy="fund-min"]').type(String(FUND_MIN))
    cy.get('[data-cy="fund-create-submit"]').click()
    cy.url({ timeout: 15000 }).should('match', /\/portal\/fondovi\/[0-9a-f-]+/)
    cy.contains('[data-cy="fund-detail-name"]', FUND_NAME).should('be.visible')

    cy.url().then((url) => {
      const fundId = url.match(/\/portal\/fondovi\/([0-9a-f-]+)/)![1]

      // Plant a dividend_payouts row (the distribution FK target) for the
      // fund, then a fund_dividend_distributions row attributing 250 RSD
      // to one investor at a 30/100-unit share snapshot.
      const payoutId = crypto.randomUUID()
      const clientId = crypto.randomUUID()
      anySecurityId().then((securityId) => {
        cy.pgSql(
          `INSERT INTO "trading".dividend_payouts
             (id, user_id, user_kind, security_id, quantity, price,
              gross_amount, currency, account_id, tax_rsd, op_id, status, paid_at)
           VALUES ('${payoutId}', '${clientId}', 'fund', '${securityId}', 100,
              '10.0000', '1000.0000', 'RSD', '${crypto.randomUUID()}', '0',
              '${crypto.randomUUID()}', 'paid', now())`,
        )
        cy.pgSql(
          `INSERT INTO "trading".fund_dividend_distributions
             (fund_id, dividend_payout_id, client_id,
              share_units, fund_total_units, amount_rsd)
           VALUES ('${fundId}', '${payoutId}', '${clientId}',
              '30.00000000', '100.00000000', '250.0000')`,
        )

        // Reload so the dividends query refetches the planted row.
        cy.reload()
        cy.contains('Raspodela dividendi', { timeout: 15000 }).should('be.visible')
        // The history table now has one attribution row (was the empty
        // "Fond još nije primio dividendu." state before).
        cy.contains('Fond još nije primio dividendu.').should('not.exist')
        cy.contains('tr', '30').should('contain', '100') // share / total units
        // Amount renders in the RSD column.
        cy.contains('tr', '250').should('be.visible')
      })
    })
  })
})
