/// <reference types="cypress" />

// Terminski valutni ugovori / forex forwards (todoSpec C3). Live against
// the seeded c3 stack.
//
// Client surface: /banking/terminski (src/routes/_authed/banking/
// terminski.tsx) — fill base currency / notional / settlement date to get
// a forward quote (forward rate + commission), conclude it (verification-
// gated, spec p.11), and cancel an active one.
//
// Supervisor surface: /portal/terminski-spreadovi
// (src/routes/_authed/portal/terminski-spreadovi.tsx) — set the annualised
// spread factor per currency pair that feeds the forward-rate formula.
//
// The forms use RHF register (no data-cy), so we target inputs by their
// forwarded name attribute and scope by the form aria-label.
//
// resetBackend truncates bank.* (incl. reservations) + trading.*, so each
// test starts with no forwards. USD/RSD FX rates are seeded (the trading
// account is USD), so the USD-leg quote resolves.

// A settlement date comfortably in the future (forward needs daysToSettlement > 0).
function futureDate(daysAhead: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + daysAhead)
  return d.toISOString().slice(0, 10)
}

describe('Celina 3 — terminski valutni ugovori (forex forwards)', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('quotes a forward (rate + commission), concludes it (verification-gated), then cancels it', () => {
    cy.loginAsClient()
    cy.visit('/banking/terminski')
    cy.contains('h1', 'Terminski valutni ugovori', { timeout: 15000 }).should('be.visible')

    cy.get('form[aria-label="Nov terminski ugovor"]').within(() => {
      cy.get('select[name="baseCurrency"]').select('CURRENCY_USD')
      cy.get('input[name="settlementDate"]').type(futureDate(90))
      cy.get('input[name="notional"]').clear().type('1000')
    })

    // The quote box renders once the BE returns forward rate + commission.
    cy.contains('Terminski kurs:', { timeout: 15000 }).should('be.visible')
    cy.contains('Provizija:').should('be.visible')
    cy.contains('Obaveza (rezerviše se):').should('be.visible')

    // Capture the dev-mode verification code (spec p.11) then conclude.
    cy.intercept('POST', '/api/v1/verification/request').as('verifReq')
    cy.contains('button', /Zaključi ugovor/).click()

    cy.wait('@verifReq').then((i) => {
      const code = (i.response?.body as { code?: string })?.code as string
      expect(code, 'dev-mode verification code').to.match(/^\d{6}$/)
      cy.get('#verif-code').type(code)
      cy.findByRole('button', { name: /^Potvrdi$/ }).click()
    })

    // The forward appears in the list with status "Aktivan".
    cy.contains('h2', 'Moji terminski ugovori').should('be.visible')
    cy.contains('tr', 'Aktivan', { timeout: 15000 }).should('be.visible')

    // Cancel the active forward — status flips to "Otkazan".
    cy.contains('tr', 'Aktivan').contains('button', 'Otkaži').click()
    cy.contains('tr', 'Otkazan', { timeout: 10000 }).should('be.visible')
  })

  it('rejects a past settlement date (no quote, conclude disabled)', () => {
    cy.loginAsClient()
    cy.visit('/banking/terminski')
    cy.contains('h1', 'Terminski valutni ugovori', { timeout: 15000 }).should('be.visible')

    cy.get('form[aria-label="Nov terminski ugovor"]').within(() => {
      cy.get('select[name="baseCurrency"]').select('CURRENCY_USD')
      cy.get('input[name="notional"]').clear().type('1000')
      // A date in the past — the quote query is gated on
      // settlementDate > now, so no quote box renders.
      cy.get('input[name="settlementDate"]').type(futureDate(-30))
    })

    cy.contains('Terminski kurs:').should('not.exist')
    // With no quote the conclude button stays disabled.
    cy.contains('button', /Zaključi ugovor/).should('be.disabled')
  })

  it('supervisor sets a spread factor for a pair and it persists', () => {
    cy.loginAsSupervisor()
    cy.visit('/portal/terminski-spreadovi')
    cy.contains('h1', 'Terminski ugovori — spread faktor', { timeout: 15000 }).should('be.visible')

    cy.get('form[aria-label="Podešavanje spread faktora"]').within(() => {
      cy.get('select[name="baseCurrency"]').select('CURRENCY_USD')
      cy.get('input[name="spreadFactor"]').clear().type('0.035')
      cy.contains('button', /Sačuvaj/).click()
    })

    // The configured pair shows up in "Podešeni parovi" with the saved factor.
    cy.contains('h2', 'Podešeni parovi').should('be.visible')
    cy.contains('tr', '0.035', { timeout: 15000 }).should('be.visible')

    // Persists across a reload (read back from the BE).
    cy.reload()
    cy.contains('tr', '0.035', { timeout: 15000 }).should('be.visible')
  })
})
