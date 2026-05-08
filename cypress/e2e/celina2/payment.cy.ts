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

  it('klijent kreira novo plaćanje sa svog tekućeg računa', () => {
    cy.intercept('POST', '/api/v1/payments', (req) => {
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
    cy.get('input[name="toAccountNumber"]').type('160005412345678901')
    cy.get('input[name="amount"]').type('1500')
    cy.get('input[name="paymentCode"]').clear().type('221')
    cy.get('input[name="purpose"]').type('Račun za struju — april')
    cy.findByRole('button', { name: /Pošalji plaćanje/ }).click()
    cy.wait('@createPayment')

    // After success, the FE redirects to /banking/racuni.
    cy.url({ timeout: 5000 }).should('include', '/banking/racuni')
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
})
