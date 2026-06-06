/// <reference types="cypress" />

// Live-backend c2 spec — in-app obaveštenja (todoSpec S19).
//
// After a successful payment the bank service emits an in-app
// notification to the sender ("Potvrda plaćanja" — see
// services/bank/internal/service/notifications.go:notifyPaymentSucceeded).
// The shell's NotificationBell polls /api/v1/notifications, shows an
// unread badge, and marks an item read on click.
//
// Note on "transfer" vs "payment": the prompt frames this as a transfer
// between own accounts, but CreateTransfer does NOT notify — only
// CreatePayment does (notifyPaymentSucceeded). So this drives the real
// notification-producing path: a same-currency PAYMENT from the seeded
// klijent's funded RSD account to a planted RSD recipient. The verified
// flow is otherwise identical (verification-gated, 6-digit dialog).
//
// We plant the destination as an RSD account owned by the second seeded
// client (klijent2@banka.local) with a syntactically valid, mod-11-clean
// 18-digit number (digit-sum 66) so the form + backend both accept it.

const TO_NUMBER = '160005412345678905'

function plantRecipientAccount() {
  // owner = klijent2, created_by = the bootstrap admin employee — both
  // resolved by sub-select so the spec carries no hard-coded UUIDs.
  // ON CONFLICT keeps the insert idempotent if a prior attempt left it.
  cy.pgSql(`
    insert into "bank".accounts
      (number, name, owner_client_id, created_by_employee_id,
       kind, subtype, currency, status,
       balance, available_balance, maintenance_fee, daily_limit, monthly_limit)
    select '${TO_NUMBER}', 'Primalac RSD',
           (select id from "user".clients where email='klijent2@banka.local'),
           (select id from "user".employees where email='admin@banka.local'),
           'personal_checking_rsd', 'standard', 'RSD', 'active',
           0, 0, 0, 120000, 1000000
    on conflict (number) do nothing
  `)
}

describe('Celina 2 — obaveštenja (live backend)', () => {
  beforeEach(() => {
    cy.resetBackend()
    plantRecipientAccount()
    cy.loginAsClient()
  })

  it('klijent izvrši plaćanje → zvono prikazuje nepročitano obaveštenje → označi pročitano (S19)', () => {
    cy.visit('/banking/placanja')

    // Pay 1.000 RSD from the seeded RSD account (250.000 raspoloživo).
    cy.get('select[name="fromAccountId"]', { timeout: 15000 })
      .find('option')
      .contains('250.000,00')
      .then(($opt) => cy.get('select[name="fromAccountId"]').select($opt.attr('value')!))
    cy.get('input[name="recipientName"]').type('Primalac RSD')
    cy.get('input[name="toAccountNumber"]').type(TO_NUMBER)
    cy.get('input[name="amount"]').type('1000')
    cy.get('input[name="paymentCode"]').clear().type('289')
    cy.get('input[name="purpose"]').type('Test obaveštenja')
    cy.findByRole('button', { name: /Pošalji plaćanje/ }).click()

    // Verification — read the inline code, type it back.
    cy.findByLabelText('verifikacioni-kod', { timeout: 10000 })
      .invoke('text')
      .then((code) => {
        const trimmed = code.trim()
        expect(trimmed).to.match(/^\d{6}$/)
        cy.get('#verif-code').type(trimmed)
        cy.findByRole('button', { name: /^Potvrdi$/ }).click()
      })

    // Payment success navigates to /banking/racuni; the shell (with the
    // bell) is rendered on every banking page.
    cy.url({ timeout: 15000 }).should('include', '/banking/racuni')

    // The feed polls every 30s; force a reload so the freshly-emitted
    // notification lands without waiting on the interval.
    cy.reload()

    // Open the bell (aria-label="Obaveštenja"). The unread badge renders
    // as a count span inside the button; assert the panel content instead
    // of the badge glyph for a stable check.
    cy.findByRole('button', { name: 'Obaveštenja' }, { timeout: 15000 }).click()

    // Panel lists the "Potvrda plaćanja" notification (unread → the
    // "Označi sve kao pročitano" action is present while unread > 0).
    cy.contains('Potvrda plaćanja', { timeout: 10000 }).should('be.visible')
    cy.findByRole('button', { name: /Označi sve kao pročitano/ }).should('be.visible')

    // Mark it read by clicking the row; once unread hits 0 the
    // "Označi sve kao pročitano" action disappears (the markRead mutation
    // invalidated the cache and the count dropped).
    cy.contains('button', 'Potvrda plaćanja').click()
    cy.findByRole('button', { name: /Označi sve kao pročitano/ }, { timeout: 10000 }).should(
      'not.exist',
    )
  })
})
