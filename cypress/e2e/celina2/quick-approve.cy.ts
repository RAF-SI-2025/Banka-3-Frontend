/// <reference types="cypress" />

// Live-backend c2 spec — Brzo odobravanje / quick-approve (todoSpec S12,
// web side).
//
// Instead of typing the 6-digit code, the user taps "Odobri" on the
// mobile app. The web dialog polls GET /verification/{id}/status every
// 2s and, once the status flips to "approved", auto-proceeds id-only
// (no X-Verification-Code header — proofHeaders sends X-Verification-Id
// alone). We simulate the phone tap by calling
// POST /api/v1/verification/{id}/approve with the same client's token
// (ownership is enforced server-side in verification.Approve, so the
// approving principal must be the record's owner).
//
// Flow: initiate a verification-gated PAYMENT → capture the id from the
// /verification/request response → approve out-of-band → assert the
// dialog auto-proceeds and the payment lands (redirect to /banking/racuni).
//
// Recipient: a planted RSD account on klijent2, valid mod-11 number.

const TO_NUMBER = '160005412345678905'

describe('Celina 2 — brzo odobravanje (live backend)', () => {
  beforeEach(() => {
    cy.resetBackend()
    // Plant an RSD destination on the second seeded client.
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
    cy.loginAsClient()
  })

  it('telefon odobri zahtev → web dijalog automatski potvrdi plaćanje (S12)', () => {
    // Capture the verification id the gateway issues when the dialog opens.
    cy.intercept('POST', '/api/v1/verification/request').as('verifReq')

    // A fresh client token for the out-of-band approve call. The web app
    // keeps its token in memory (Zustand), so logging in again over the
    // API is the clean way to get one we can attach to cy.request.
    cy.request('POST', '/api/v1/auth/login', {
      email: 'klijent@banka.local',
      password: 'Klijent123!',
    }).then((login) => {
      cy.wrap(login.body.accessToken as string).as('clientToken')
    })

    // Fill + submit the payment to open the verification dialog.
    cy.visit('/banking/placanja')
    cy.get('select[name="fromAccountId"]', { timeout: 15000 })
      .find('option')
      .contains('250.000,00')
      .then(($opt) => cy.get('select[name="fromAccountId"]').select($opt.attr('value')!))
    cy.get('input[name="recipientName"]').type('Primalac RSD')
    cy.get('input[name="toAccountNumber"]').type(TO_NUMBER)
    cy.get('input[name="amount"]').type('900')
    cy.get('input[name="paymentCode"]').clear().type('289')
    cy.get('input[name="purpose"]').type('Brzo odobravanje')
    cy.findByRole('button', { name: /Pošalji plaćanje/ }).click()

    // The dialog issued a code; grab its id from the request response and
    // approve it out-of-band as the same client (the phone "Odobri" tap).
    cy.wait('@verifReq', { timeout: 15000 })
      .its('response.body.verificationId')
      .then((verificationId) => {
        expect(verificationId, 'verification id issued').to.be.a('string')
        cy.get<string>('@clientToken').then((token) => {
          cy.request({
            method: 'POST',
            url: `/api/v1/verification/${verificationId}/approve`,
            headers: { Authorization: `Bearer ${token}` },
            body: {},
          }).then((res) => {
            // The endpoint confirms the record is now approved.
            expect(res.status).to.eq(200)
            expect(res.body.approved).to.eq(true)
          })
        })
      })

    // The dialog's 2s status poll sees "approved" and auto-proceeds the
    // payment id-only (no typed code). Success navigates to /banking/racuni
    // and the sender account is debited 250.000 - 900 = 249.100.
    cy.url({ timeout: 20000 }).should('include', '/banking/racuni')
    cy.contains('249.100,00', { timeout: 10000 }).should('be.visible')
  })

  // Best-effort limitation: if the web poll-mode auto-proceed proves
  // timing-sensitive in CI (the status query is gated on !submit.isPending
  // and refetches every 2s), the load-bearing assertion above is the
  // approve endpoint returning {approved:true} — that alone proves the
  // mobile quick-approve path marks the record approved. The subsequent
  // auto-proceed + balance check exercises the web dialog reacting to it.
})
