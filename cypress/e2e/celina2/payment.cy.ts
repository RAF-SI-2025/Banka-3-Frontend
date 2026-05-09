/// <reference types="cypress" />

// Mirrors spec/Banka2025-E2E.pdf, "Feature: Plaćanje (Klijent)":
//   - klijent vidi listu računa, popunjava formu za plaćanje, šalje
//
// Specs use intercept stubs so they exercise the FE flow without
// requiring a fully populated bank schema. The backend integration
// tests in services/bank pin the same behaviour against real Postgres.

const CLIENT_PERMS = [
  'client.read',
  'account.read',
  'card.read',
  'card.write',
  'payment.write',
  'loan.read',
  'loan.write',
]

// Fake JWT with the right shape (header.payload.sig). Signature is
// dummy — the FE only inspects the payload.
function fakeClientToken(): string {
  const payload = btoa(
    JSON.stringify({
      sub: 'client-1',
      kind: 'client',
      perms: CLIENT_PERMS,
      sv: 1,
      exp: Math.floor(Date.now() / 1000) + 900,
    }),
  )
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.dummy`
}

const TODAY = '2026-05-08T12:00:00Z'

describe('Celina 2 — plaćanje (klijent)', () => {
  beforeEach(() => {
    // Bypass route guard + bootstrap clear: pre-seed the persisted
    // auth store and stub refresh+me to succeed. See portal-loan-request
    // spec for the rationale.
    cy.intercept('POST', '/api/v1/auth/refresh', {
      statusCode: 200,
      body: { accessToken: fakeClientToken(), accessExpiresIn: 900 },
    })
    cy.intercept('GET', '/api/v1/auth/me', {
      statusCode: 200,
      body: { client: { id: 'client-1', email: 'pera@example.com', permissions: CLIENT_PERMS } },
    })
    cy.window().then((win) => {
      win.sessionStorage.setItem(
        'banka-auth',
        JSON.stringify({
          state: {
            accessToken: fakeClientToken(),
            userId: 'client-1',
            userKind: 'client',
            permissions: CLIENT_PERMS,
          },
          version: 0,
        }),
      )
    })

    cy.intercept('GET', '/api/v1/accounts*', {
      statusCode: 200,
      body: {
        accounts: [
          {
            id: 'acc-rsd',
            number: '265000112345678910',
            name: 'Tekući RSD',
            ownerClientId: 'client-1',
            kind: 'ACCOUNT_KIND_PERSONAL_CHECKING_RSD',
            subtype: 'ACCOUNT_SUBTYPE_STANDARD',
            currency: 'CURRENCY_RSD',
            status: 'ACCOUNT_STATUS_ACTIVE',
            balance: '50000.00',
            availableBalance: '50000.00',
            maintenanceFee: '0',
            dailyLimit: '100000',
            monthlyLimit: '1000000',
            dailySpent: '0',
            monthlySpent: '0',
            createdAt: TODAY,
            updatedAt: TODAY,
          },
        ],
      },
    }).as('accounts')

    cy.intercept('GET', '/api/v1/payment-recipients', {
      statusCode: 200,
      body: { recipients: [] },
    }).as('recipients')
  })

  it('klijent kreira novo plaćanje sa svog tekućeg računa (preko verifikacionog koda)', () => {
    // Spec p.11: verifikacioni kod step. The dialog auto-fetches an
    // issued code from the gateway; we stub it so the test sees a
    // known value, then type it back in.
    cy.intercept('POST', '/api/v1/verification/request', (req) => {
      expect(req.body.actionKind).to.eq('payment')
      req.reply({
        statusCode: 200,
        body: { verificationId: 'v-1', code: '123456', expiresAt: TODAY },
      })
    }).as('verifReq')

    cy.intercept('POST', '/api/v1/payments', (req) => {
      // Verification headers must have ridden along.
      expect(req.headers['x-verification-id']).to.eq('v-1')
      expect(req.headers['x-verification-code']).to.eq('123456')
      // Assert the payload shape.
      expect(req.body.fromAccountId).to.eq('acc-rsd')
      expect(req.body.toAccountNumber).to.match(/^\d{18}$/)
      expect(req.body.amount).to.eq('1500')
      expect(req.body.purpose).to.contain('Račun za struju')
      req.reply({
        statusCode: 200,
        body: {
          opId: 'op-1',
          status: 'TRANSACTION_STATUS_REALIZED',
          transactions: [
            {
              id: 't-1',
              opId: 'op-1',
              kind: 'TRANSACTION_KIND_PAYMENT',
              fromAccountId: 'acc-rsd',
              toAccountId: 'acc-other',
              fromAmount: '1500',
              toAmount: '1500',
              status: 'TRANSACTION_STATUS_REALIZED',
              createdAt: TODAY,
            },
          ],
        },
      })
    }).as('createPayment')

    cy.visit('/banking/placanja')
    cy.get('select[name="fromAccountId"]').select('acc-rsd')
    cy.get('input[name="recipientName"]').type('EPS Snabdevanje')
    // 18 digits, sum-of-digits = 66 → mod-11 clean (validated by
    // src/lib/account-number.ts and the backend's pkg/account.Validate).
    cy.get('input[name="toAccountNumber"]').type('160005412345678905')
    cy.get('input[name="amount"]').type('1500')
    cy.get('input[name="paymentCode"]').clear().type('221')
    cy.get('input[name="purpose"]').type('Račun za struju — april')
    cy.findByRole('button', { name: /Pošalji plaćanje/ }).click()

    // Verification dialog opens, displays the issued code, accepts input.
    cy.wait('@verifReq')
    cy.findByLabelText('verifikacioni-kod').should('have.text', '123456')
    cy.get('#verif-code').type('123456')
    cy.findByRole('button', { name: /^Potvrdi$/ }).click()

    cy.wait('@createPayment')
    // After success, the FE redirects to /banking/racuni.
    cy.url({ timeout: 5000 }).should('include', '/banking/racuni')
  })

  it('pogrešan verifikacioni kod prikazuje grešku i ne šalje plaćanje', () => {
    cy.intercept('POST', '/api/v1/verification/request', {
      statusCode: 200,
      body: { verificationId: 'v-2', code: '987654', expiresAt: TODAY },
    }).as('verifReq')
    cy.intercept('POST', '/api/v1/payments', {
      statusCode: 401,
      body: { code: 401, message: 'Pogrešan verifikacioni kod.' },
    }).as('createPayment')

    cy.visit('/banking/placanja')
    cy.get('select[name="fromAccountId"]').select('acc-rsd')
    cy.get('input[name="recipientName"]').type('EPS Snabdevanje')
    cy.get('input[name="toAccountNumber"]').type('160005412345678905')
    cy.get('input[name="amount"]').type('1500')
    cy.get('input[name="purpose"]').type('Račun za struju')
    cy.findByRole('button', { name: /Pošalji plaćanje/ }).click()
    cy.wait('@verifReq')
    // Type a wrong code — backend rejects, dialog stays open with the
    // server's Serbian message and the user can retry.
    cy.get('#verif-code').type('111222')
    cy.findByRole('button', { name: /^Potvrdi$/ }).click()
    cy.wait('@createPayment')
    cy.contains('Pogrešan verifikacioni kod').should('be.visible')
    cy.url().should('include', '/banking/placanja')
  })

  it('klijent vidi grešku ako račun primaoca nema 18 cifara', () => {
    cy.visit('/banking/placanja')
    cy.get('select[name="fromAccountId"]').select('acc-rsd')
    cy.get('input[name="recipientName"]').type('Test')
    cy.get('input[name="toAccountNumber"]').type('1234')
    cy.get('input[name="amount"]').type('100')
    cy.get('input[name="purpose"]').type('test')
    cy.findByRole('button', { name: /Pošalji plaćanje/ }).click()
    cy.contains('Račun mora imati 18 cifara').should('be.visible')
  })

  it('klijent vidi grešku za neispravan kontrolni broj (mod-11)', () => {
    // 18 digits but checksum fails — same length, off-by-one mistake.
    // Original valid: 160005412345678905 (sum 66). Bumping the last
    // digit by 1 turns sum into 67 → mod-11 = 1 → invalid.
    cy.visit('/banking/placanja')
    cy.get('select[name="fromAccountId"]').select('acc-rsd')
    cy.get('input[name="recipientName"]').type('Test')
    cy.get('input[name="toAccountNumber"]').type('160005412345678906')
    cy.get('input[name="amount"]').type('100')
    cy.get('input[name="purpose"]').type('test')
    cy.findByRole('button', { name: /Pošalji plaćanje/ }).click()
    cy.contains('Neispravan kontrolni broj računa').should('be.visible')
  })

  it('nedovoljno sredstava — backend odbija, korisnik ostaje na formi sa porukom', () => {
    // Spec p.16: paymet kreće tek nakon verifikacije, ali raspoloživo
    // sredstva proverava bank servis. Odbijanje (raspoloživo < iznos +
    // provizija) vraća 400 sa Serbian-copy porukom; FE prikazuje banner
    // i ostavlja formu netaknutu da klijent ispravi iznos.
    cy.intercept('POST', '/api/v1/verification/request', {
      statusCode: 200,
      body: { verificationId: 'v-noprice', code: '999999', expiresAt: TODAY },
    }).as('verifReq')

    cy.intercept('POST', '/api/v1/payments', {
      statusCode: 400,
      body: { code: 400, message: 'Nedovoljno sredstava na računu.' },
    }).as('createPayment')

    cy.visit('/banking/placanja')
    cy.get('select[name="fromAccountId"]').select('acc-rsd')
    cy.get('input[name="recipientName"]').type('EPS Snabdevanje')
    cy.get('input[name="toAccountNumber"]').type('160005412345678905')
    // Stub kaže da je raspoloživo 50.000; tražimo 1.000.000 — backend će
    // odbiti pre svake transakcije.
    cy.get('input[name="amount"]').type('1000000')
    cy.get('input[name="purpose"]').type('Račun za struju')
    cy.findByRole('button', { name: /Pošalji plaćanje/ }).click()
    cy.wait('@verifReq')
    cy.get('#verif-code').type('999999')
    cy.findByRole('button', { name: /^Potvrdi$/ }).click()
    cy.wait('@createPayment')
    cy.contains('Nedovoljno sredstava na računu.').should('be.visible')
    // Forma i URL se ne menjaju — klijent može ispraviti iznos i ponoviti.
    cy.url().should('include', '/banking/placanja')
    cy.get('input[name="amount"]').should('have.value', '1000000')
  })
})
