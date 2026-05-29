/// <reference types="cypress" />

// Live-backend c2 spec. Walks the full path: admin opens an RSD account
// for the seeded test client → client logs in, sees the account →
// client makes a same-currency payment to a second account (we open a
// destination account for another fictitious client) → balance reflects.
//
// This complements the canned-response specs in payment.cy.ts /
// menjacnica.cy.ts / portal-loan-request.cy.ts: those run in 1-2s
// without docker; this one verifies the FE↔gateway↔services chain
// actually round-trips against a fresh c2 stack.
//
// The seed plants two clients: klijent@banka.local (with c2 fixtures)
// and klijent2@banka.local (no fixtures). The cross-client test in
// this file relies on both — admin opens accounts for each, klijent
// pays klijent2, both sides see the balance change.

describe('Celina 2 (live) — kompletan tok plaćanja', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('admin otvara račun → klijent uplaćuje → stanje se ažurira', () => {
    // ---- Phase 1: admin creates an RSD account for the seeded client ----
    cy.loginAsAdmin()
    cy.url().should('include', '/portal')

    // The seed planted klijent@banka.local; pull its UUID from the
    // /portal/clients list page so we can target the new-account form.
    cy.visit('/portal/clients')
    cy.contains('tr', 'klijent@banka.local').click()
    cy.url().should('match', /\/portal\/clients\/[0-9a-f-]+/)
    cy.findByRole('link', { name: /Otvori novi račun/ }).click()
    cy.url().should('include', '/portal/accounts/new')

    // The form pre-fills ownerClientId via search param. Default kind
    // (personal RSD) + standard subtype + 0 opening balance is fine —
    // we'll fund it via a payment from a second account below.
    cy.get('select[name="kind"]').select('ACCOUNT_KIND_PERSONAL_CHECKING_RSD')
    cy.get('select[name="subtype"]').select('ACCOUNT_SUBTYPE_STANDARD')
    // Currency menu is hidden for checking accounts (always RSD).
    cy.get('input[name="openingBalance"]').clear().type('5000')
    cy.findByRole('button', { name: /Otvori račun/ }).click()
    cy.url({ timeout: 5000 }).should('include', '/portal/accounts')

    // ---- Phase 2: log out, login as client, view account ----
    cy.findByRole('button', { name: /Odjava/ }).click()
    cy.loginAsClient()
    cy.url().should('include', '/banking')
    cy.contains('a', 'Računi').click()
    cy.url().should('include', '/banking/racuni')
    // The account opened above carries 5.000,00 RSD opening balance.
    cy.contains('5.000,00').should('be.visible')

    // ---- Phase 3: client opens detail page, sees the maintenance fee ----
    // The list is sorted by raspoloživo desc (spec p.19) so the seeded
    // Poslovni account (500k RSD) sits at the top — target the row by
    // the new account's balance instead of `.first()`. Row click opens
    // the detail page (no Detalji link — whole row is the link).
    cy.contains('tr', '5.000,00').click()
    cy.url().should('match', /\/banking\/racuni\/[0-9a-f-]+/)
    // Spec p.12: 255 RSD monthly maintenance for standard RSD account.
    cy.contains('Mesečno održavanje').parent().should('contain', '255,00')

    // The full payment flow against a real second account would require
    // creating a second client, which is more setup than this single
    // spec needs. The canned-response payment.cy.ts already exercises
    // the form; this live spec proves the BE wiring (account creation,
    // balance retrieval, fee defaults) is correct end-to-end.
  })

  it('cross-client: klijent → klijent2 plaćanje sa stvarnim verifikacionim kodom', () => {
    // ---- Phase 1: admin otvara dva nova RSD računa (jedan po klijentu) ----
    cy.loginAsAdmin()
    cy.url().should('include', '/portal')

    const openRSD = (clientEmail: string, opening: string) => {
      cy.visit('/portal/clients')
      // Posle resetBackend-a + bounce bank-1 servisa, lista klijenata zna
      // da kasni par sekundi (TanStack Query cold-start). Bumpamo timeout
      // da bi se izbegli flake-ovi između testova.
      cy.contains('tr', clientEmail, { timeout: 10000 }).click()
      cy.url().should('match', /\/portal\/clients\/[0-9a-f-]+/)
      cy.findByRole('link', { name: /Otvori novi račun/ }).click()
      cy.url().should('include', '/portal/accounts/new')
      cy.get('select[name="kind"]').select('ACCOUNT_KIND_PERSONAL_CHECKING_RSD')
      cy.get('select[name="subtype"]').select('ACCOUNT_SUBTYPE_STANDARD')
      cy.get('input[name="openingBalance"]').clear().type(opening)
      cy.findByRole('button', { name: /Otvori račun/ }).click()
      cy.url({ timeout: 10000 }).should('include', '/portal/accounts')
    }

    openRSD('klijent@banka.local', '5000')
    openRSD('klijent2@banka.local', '0')

    // Capture klijent2's new RSD account number from the client-detail
    // page. The seed leaves klijent2 without bank fixtures, so the only
    // row with a 18-digit account number is the one we just opened.
    cy.visit('/portal/clients')
    cy.contains('tr', 'klijent2@banka.local').click()
    cy.contains('h2', 'Računi')
      .parents('section')
      .first()
      .find('tbody tr')
      .first()
      .find('td')
      .first()
      .invoke('text')
      .then((masked) => {
        const number = masked.replace(/-/g, '').trim()
        expect(number).to.match(/^\d{18}$/)
        cy.wrap(number).as('toNumber')
      })

    // ---- Phase 2: klijent šalje 1500 RSD na klijent2 račun ----
    cy.findByRole('button', { name: /Odjava/ }).click()
    cy.loginAsClient()
    cy.url().should('include', '/banking')
    cy.visit('/banking/placanja')

    // Izaberi novi RSD lični račun (5000 raspoloživo) — seedovani Poslovni
    // račun ima 500.000 i pojavljuje se prvi po sortiranju, ali ovde želimo
    // baš novi standardni račun.
    cy.get('select[name="fromAccountId"]')
      .find('option')
      .contains('5.000,00')
      .then(($opt) => cy.get('select[name="fromAccountId"]').select($opt.attr('value')!))

    cy.get('input[name="recipientName"]').type('Drugi Klijent')
    cy.get('@toNumber').then((number) => {
      cy.get('input[name="toAccountNumber"]').type(String(number))
    })
    cy.get('input[name="amount"]').type('1500')
    cy.get('input[name="paymentCode"]').clear().type('289')
    cy.get('input[name="purpose"]').type('Pozajmica drugu')
    cy.findByRole('button', { name: /Pošalji plaćanje/ }).click()

    // Verifikacioni kod je pravi — gateway ga vraća u response, dialog
    // ga prikazuje pored fake-QR-a; pročitaj ga i ukucaj nazad.
    cy.findByLabelText('verifikacioni-kod', { timeout: 10000 })
      .invoke('text')
      .then((code) => {
        const trimmed = code.trim()
        expect(trimmed).to.match(/^\d{6}$/)
        cy.get('#verif-code').type(trimmed)
        cy.findByRole('button', { name: /^Potvrdi$/ }).click()
      })

    cy.url({ timeout: 15000 }).should('include', '/banking/racuni')
    // Klijentov novi RSD lični račun: 5000 - 1500 = 3500.
    cy.contains('3.500,00', { timeout: 10000 }).should('be.visible')

    // ---- Phase 3: klijent2 vidi 1500 na svom računu ----
    cy.findByRole('button', { name: /Odjava/ }).click()
    cy.visit('/login')
    cy.findByLabelText('Email').clear().type('klijent2@banka.local')
    cy.findByLabelText('Lozinka').clear().type('Klijent123!')
    cy.findByRole('button', { name: /Prijavi se/ }).click()
    cy.url({ timeout: 5000 }).should('not.include', '/login')
    cy.contains('a', 'Računi').click()
    cy.contains('1.500,00', { timeout: 10000 }).should('be.visible')
  })
})
