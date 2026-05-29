/// <reference types="cypress" />

// Banka2025-E2E.pdf, "Feature: Menjačnica":
//   - klijent bira sa-računa i na-račun (različite valute), unosi iznos,
//     dobija pregled (kurs, provizija, neto), realizuje
//
// Spec uses canned responses; the live-backend FX math is covered by
// services/bank/internal/service/integration_test.go (TestIntegration_CreateTransfer_FX).

const PERMS = ['client.read', 'account.read', 'card.read', 'card.write', 'payment.write', 'loan.read', 'loan.write']

function fakeToken(): string {
  const payload = btoa(
    JSON.stringify({ sub: 'c', kind: 'client', perms: PERMS, sv: 1, exp: Math.floor(Date.now() / 1000) + 900 }),
  )
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.dummy`
}

const TODAY = '2026-05-08T12:00:00Z'

describe('Celina 2 — menjačnica', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/v1/auth/refresh', {
      statusCode: 200,
      body: { accessToken: fakeToken(), accessExpiresIn: 900 },
    })
    cy.intercept('GET', '/api/v1/auth/me', {
      statusCode: 200,
      body: { client: { id: 'c', email: 'c@e.com', permissions: PERMS } },
    })
    cy.window().then((win) => {
      win.sessionStorage.setItem(
        'banka-auth',
        JSON.stringify({
          state: {
            accessToken: fakeToken(),
            userId: 'c',
            userKind: 'client',
            permissions: PERMS,
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
            id: 'rsd',
            number: '265000111111111110',
            name: 'RSD',
            ownerClientId: 'c',
            kind: 'ACCOUNT_KIND_PERSONAL_CHECKING_RSD',
            subtype: 'ACCOUNT_SUBTYPE_STANDARD',
            currency: 'CURRENCY_RSD',
            status: 'ACCOUNT_STATUS_ACTIVE',
            balance: '10000.00',
            availableBalance: '10000.00',
          },
          {
            id: 'eur',
            number: '265000122222222220',
            name: 'EUR',
            ownerClientId: 'c',
            kind: 'ACCOUNT_KIND_PERSONAL_FX',
            subtype: 'ACCOUNT_SUBTYPE_UNSPECIFIED',
            currency: 'CURRENCY_EUR',
            status: 'ACCOUNT_STATUS_ACTIVE',
            balance: '0',
            availableBalance: '0',
          },
        ],
      },
    })

    cy.intercept('GET', '/api/v1/exchange/rates', {
      statusCode: 200,
      body: {
        rates: [{ from: 'CURRENCY_EUR', to: 'CURRENCY_RSD', bid: '117.20', ask: '117.50', updatedAt: TODAY }],
      },
    })
  })

  it('klijent dobija pregled i realizuje konverziju RSD → EUR', () => {
    cy.intercept('POST', '/api/v1/menjacnica/quote', {
      statusCode: 200,
      body: {
        fromAmount: '1175.0000',
        toAmount: '9.9500',
        rate: '0.00851063',
        commission: '0.0500',
      },
    }).as('quote')

    cy.intercept('POST', '/api/v1/verification/request', (req) => {
      expect(req.body.actionKind).to.eq('transfer')
      req.reply({
        statusCode: 200,
        body: { verificationId: 'v-fx', code: '424242', expiresAt: TODAY },
      })
    }).as('verifReq')

    cy.intercept('POST', '/api/v1/transfers', (req) => {
      expect(req.headers['x-verification-id']).to.eq('v-fx')
      expect(req.headers['x-verification-code']).to.eq('424242')
      req.reply({
        statusCode: 200,
        body: { opId: 'op-fx', status: 'TRANSACTION_STATUS_REALIZED', transactions: [] },
      })
    }).as('transfer')

    cy.visit('/banking/menjacnica')

    cy.get('select[name="fromAccountId"]').select('rsd')
    cy.get('select[name="toAccountId"]').select('eur')
    cy.get('input[name="amount"]').type('1175')
    cy.wait('@quote')

    // Quote panel renders the bank's reply.
    cy.contains('9,95 EUR').should('be.visible')
    cy.contains('Provizija').parent().should('contain', '0,05 EUR')

    // Realizuj opens the verifikacioni-kod dialog directly.
    cy.findByRole('button', { name: /Realizuj/ }).click()
    cy.wait('@verifReq')
    cy.get('#verif-code').type('424242')
    cy.findByRole('button', { name: /^Potvrdi$/ }).click()
    cy.wait('@transfer')
    cy.url({ timeout: 5000 }).should('include', '/banking/racuni')
  })
})
