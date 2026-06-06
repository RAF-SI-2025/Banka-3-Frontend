/// <reference types="cypress" />

// Dividends (todoSpec C3 S54-S59). Live against the seeded c3 stack.
//
// The quarterly dividend payout (S54-S58: who gets paid, the
// shares × price × yield/4 computation, the same-currency / default-
// currency / RSD account-selection fallback, and the 15% capital-gains
// tax on client holders) is a scheduler-driven cron and is NOT
// Cypress-drivable — it's covered by backend unit tests.
//
// SKIP (cron): S54-S58 payout computation + account selection + tax.
//
// This spec focuses on the DISPLAY (S59): the per-position portfolio
// detail page (/banking/portfolio/$securityId,
// src/routes/_authed/banking/portfolio/$securityId.tsx) renders the
// dividend history (date + amount) for the position. We plant a payout
// row directly (as the cron would write it) and assert it renders.
//
// The dividends list endpoint scopes to the caller's (user_id, user_kind)
// from the JWT; for klijent that's the client's UUID + 'client'.
// resetBackend reseeds klijent with a fresh UUID, so we read it back from
// the DB and plant against it. dividend_payouts has no FK to accounts and
// isn't in the resetBackend truncate set, so we delete the client's prior
// rows first to stay hermetic across re-runs.

describe('Celina 3 — dividende (display, S59)', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('S59 — portfolio position detail shows planted dividend history (date + amount)', () => {
    // Resolve the freshly-seeded klijent's client id + AAPL's security id.
    cy.pgSql(`SELECT id FROM "user".clients WHERE email = 'klijent@banka.local'`).then((clientId) => {
      const cid = clientId.trim()
      expect(cid, 'klijent client id').to.match(/^[0-9a-f-]{36}$/)

      cy.pgSql(`SELECT id FROM "trading".securities WHERE ticker = 'AAPL' AND type = 'stock' LIMIT 1`).then((secId) => {
        const sid = secId.trim()
        expect(sid, 'AAPL security id').to.match(/^[0-9a-f-]{36}$/)

        // Plant a dividend payout exactly as the quarterly cron would:
        // 10 shares × $190.55 × (yield/4) ≈ $47.64 gross, paid in USD,
        // with the 15% capital-gains tax recorded in RSD. account_id is a
        // free-text column on this table, so a placeholder is fine for the
        // S59 display assertion.
        cy.pgSql(`DELETE FROM "trading".dividend_payouts WHERE user_id = '${cid}'`)
        cy.pgSql(`
          INSERT INTO "trading".dividend_payouts
            (user_id, user_kind, security_id, quantity, price, gross_amount,
             currency, account_id, tax_rsd, op_id, status, paid_at)
          VALUES
            ('${cid}', 'client', '${sid}', 10, 190.55, 47.6375,
             'USD', 'seed-acct', 837.66, gen_random_uuid(), 'paid', now())
        `)

        cy.loginAsClient()
        cy.visit(`/banking/portfolio/${sid}`)

        cy.get('[data-cy="dividend-history"]', { timeout: 15000 }).should('be.visible')
        cy.get('[data-cy="dividend-history"]').within(() => {
          cy.contains('Isplaćene dividende').should('be.visible')
          // S59: the history row carries the quantity, the gross amount in
          // the listing currency (USD), and the tax (RSD). formatMoney
          // renders with '.' thousands / ',' decimal, two decimals always:
          // 47.6375 → "47,64 USD", 837.66 → "837,66".
          cy.contains('td', '10').should('exist')
          cy.contains('td', /47,64\s+USD/).should('exist')
          cy.contains('td', '837,66').should('exist')
          // A date cell renders (DD.MM.YYYY via formatDate of paid_at).
          cy.contains('td', /\d{2}\.\d{2}\.\d{4}/).should('exist')
        })
      })
    })
  })
})
