/// <reference types="cypress" />

// Live-backend c2 spec — zakazivanje plaćanja (todoSpec C2).
//
// The payment form (/banking/placanja) has a "Zakaži plaćanje" checkbox
// that reveals a "Datum izvršenja" date input. With a future date the
// submit routes through schedulePayment (verification-gated, same 6-digit
// dialog as an immediate payment) and lands on /banking/placanja/zakazana
// with the new row in status "Zakazano". Cancelling it removes the row.
// A past date is rejected client-side before the dialog opens.
//
// Recipient: a syntactically valid 18-digit, mod-11-clean number
// (160005412345678905, digit-sum 66 → 66 % 11 == 0). The same number is
// used in payment.cy.ts; the schedule endpoint only validates the number
// shape at create time (realization is a cron, not exercised here).

const VALID_TO = '160005412345678905'

// A YYYY-MM-DD value a few days out, computed from the browser clock so
// the spec stays valid regardless of run date.
function futureDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function fillPaymentBase() {
  // Pick the seeded RSD checking account (Tekući RSD, 250.000 raspoloživo).
  cy.get('select[name="fromAccountId"]', { timeout: 15000 })
    .find('option')
    .contains('250.000,00')
    .then(($opt) => cy.get('select[name="fromAccountId"]').select($opt.attr('value')!))
  cy.get('input[name="recipientName"]').clear().type('Stanar Komšija')
  cy.get('input[name="toAccountNumber"]').clear().type(VALID_TO)
  cy.get('input[name="amount"]').clear().type('1200')
  cy.get('input[name="paymentCode"]').clear().type('289')
  cy.get('input[name="purpose"]').clear().type('Mesečna kirija')
}

describe('Celina 2 — zakazivanje plaćanja (live backend)', () => {
  beforeEach(() => {
    cy.resetBackend()
    cy.loginAsClient()
  })

  it('zakaže plaćanje za budući datum → status Zakazano → otkaže ga', () => {
    cy.visit('/banking/placanja')
    fillPaymentBase()

    // Enable scheduling + pick a future date.
    cy.contains('label', 'Zakaži plaćanje').find('input[type="checkbox"]').check()
    cy.get('input[name="scheduledDate"]').type(futureDate(5))

    // Submit button copy flips to "Zakaži plaćanje".
    cy.findByRole('button', { name: /Zakaži plaćanje/ }).click()

    // Verification dialog opens (scheduling is gated). Read the real code
    // the gateway returned inline and type it back.
    cy.findByLabelText('verifikacioni-kod', { timeout: 10000 })
      .invoke('text')
      .then((code) => {
        const trimmed = code.trim()
        expect(trimmed).to.match(/^\d{6}$/)
        cy.get('#verif-code').type(trimmed)
        cy.findByRole('button', { name: /^Potvrdi$/ }).click()
      })

    // On success the FE navigates to the scheduled-payments list with the
    // new row visible in status "Zakazano".
    cy.url({ timeout: 15000 }).should('include', '/banking/placanja/zakazana')
    cy.contains('tr', 'Stanar Komšija', { timeout: 10000 })
      .should('be.visible')
      .and('contain.text', 'Zakazano')

    // Cancel it → row disappears from the list.
    cy.contains('tr', 'Stanar Komšija').findByRole('button', { name: /Otkaži/ }).click()
    cy.contains('tr', 'Stanar Komšija', { timeout: 10000 }).should('not.exist')
  })

  it('odbija datum u prošlosti pre nego što otvori verifikaciju', () => {
    cy.visit('/banking/placanja')
    fillPaymentBase()

    cy.contains('label', 'Zakaži plaćanje').find('input[type="checkbox"]').check()
    // Yesterday — must be rejected by the Zod superRefine (strictly future).
    cy.get('input[name="scheduledDate"]').type(futureDate(-1))
    cy.findByRole('button', { name: /Zakaži plaćanje/ }).click()

    cy.contains('Datum mora biti u budućnosti').should('be.visible')
    // No verification dialog opened, still on the form.
    cy.findByLabelText('verifikacioni-kod').should('not.exist')
    cy.url().should('include', '/banking/placanja')
  })
})
