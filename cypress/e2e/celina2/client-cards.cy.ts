/// <reference types="cypress" />

// Spec p.13–14, "Feature: Klijent — kartice":
//   - klijent vidi svoje kartice, blokira aktivnu (samo block — unblock je
//     zaposlenom rezervisan), ne može iz UI-a da reaktivira deaktiviranu
//   - novu karticu izdaje preko verifikacionog koda; ograničenje od 2
//     kartice po ličnom računu vraća se kao 400 sa porukom iz spec p.13
//
// Canned responses; live-side ograničenja pokriva backend integration
// (services/bank/internal/service/cards_test.go).

const PERMS = [
  'client.read',
  'account.read',
  'card.read',
  'card.write',
  'payment.write',
  'loan.read',
  'loan.write',
]

function fakeToken(): string {
  const payload = btoa(
    JSON.stringify({
      sub: 'c',
      kind: 'client',
      perms: PERMS,
      sv: 1,
      exp: Math.floor(Date.now() / 1000) + 900,
    }),
  )
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.dummy`
}

const TODAY = '2026-05-08T12:00:00Z'

const ACCOUNT = {
  id: 'acc-rsd',
  number: '265000111111111110',
  name: 'Tekući RSD',
  ownerClientId: 'c',
  kind: 'ACCOUNT_KIND_PERSONAL_CHECKING_RSD',
  subtype: 'ACCOUNT_SUBTYPE_STANDARD',
  currency: 'CURRENCY_RSD',
  status: 'ACCOUNT_STATUS_ACTIVE',
  balance: '50000.00',
  availableBalance: '50000.00',
  dailyLimit: '100000',
  monthlyLimit: '1000000',
  dailySpent: '0',
  monthlySpent: '0',
  maintenanceFee: '255',
}

function bootstrap() {
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
    body: { accounts: [ACCOUNT] },
  }).as('accounts')
}

describe('Celina 2 — kartice (klijent)', () => {
  beforeEach(bootstrap)

  it('klijent blokira svoju aktivnu karticu', () => {
    let listCalls = 0
    cy.intercept('GET', '/api/v1/cards*', (req) => {
      listCalls++
      const status = listCalls === 1 ? 'CARD_STATUS_ACTIVE' : 'CARD_STATUS_BLOCKED'
      req.reply({
        statusCode: 200,
        body: {
          cards: [
            {
              id: 'card-1',
              accountId: 'acc-rsd',
              brand: 'CARD_BRAND_VISA',
              name: 'Lična kartica',
              number: '4111111111111111',
              status,
              cardLimit: '50000',
              expiresAt: '2030-12-31T00:00:00Z',
            },
          ],
        },
      })
    }).as('cards')

    cy.intercept('POST', '/api/v1/cards/card-1/status', (req) => {
      expect(req.body.status).to.eq('CARD_STATUS_BLOCKED')
      req.reply({
        statusCode: 200,
        body: {
          id: 'card-1',
          accountId: 'acc-rsd',
          brand: 'CARD_BRAND_VISA',
          name: 'Lična kartica',
          number: '4111111111111111',
          status: 'CARD_STATUS_BLOCKED',
          cardLimit: '50000',
          expiresAt: '2030-12-31T00:00:00Z',
        },
      })
    }).as('block')

    cy.visit('/banking/kartice')
    cy.wait('@cards')
    cy.contains('tr', 'Lična kartica').findByRole('button', { name: /Blokiraj/ }).click()
    cy.wait('@block')
    // Posle invalidate cache-a, drugo čitanje vraća BLOCKED — Blokiraj
    // dugme se sklanja, badge prebacuje na crveno.
    cy.contains('tr', 'Lična kartica').within(() => {
      cy.contains('Blokirana').should('be.visible')
      cy.contains('Blokiraj').should('not.exist')
      cy.contains('Limit').should('not.exist')
    })
  })

  it('deaktivirana kartica ne nudi akcije za reaktivaciju', () => {
    cy.intercept('GET', '/api/v1/cards*', {
      statusCode: 200,
      body: {
        cards: [
          {
            id: 'card-2',
            accountId: 'acc-rsd',
            brand: 'CARD_BRAND_MASTERCARD',
            name: 'Stara kartica',
            number: '5500000000000004',
            status: 'CARD_STATUS_DEACTIVATED',
            cardLimit: '20000',
            expiresAt: '2026-01-31T00:00:00Z',
          },
        ],
      },
    }).as('cards')

    cy.visit('/banking/kartice')
    cy.wait('@cards')
    cy.contains('tr', 'Stara kartica').within(() => {
      cy.contains('Deaktivirana').should('be.visible')
      // Spec: deaktivacija je terminalna; klijent ne može reaktivirati.
      cy.contains('Blokiraj').should('not.exist')
      cy.contains('Limit').should('not.exist')
    })
  })

  it('treća kartica na ličnom računu — backend odbija (max 2)', () => {
    cy.intercept('GET', '/api/v1/cards*', {
      statusCode: 200,
      body: {
        cards: [
          {
            id: 'card-a',
            accountId: 'acc-rsd',
            brand: 'CARD_BRAND_VISA',
            name: 'Lična',
            number: '4111111111111111',
            status: 'CARD_STATUS_ACTIVE',
            cardLimit: '50000',
            expiresAt: '2030-12-31T00:00:00Z',
          },
          {
            id: 'card-b',
            accountId: 'acc-rsd',
            brand: 'CARD_BRAND_MASTERCARD',
            name: 'Putna',
            number: '5500000000000004',
            status: 'CARD_STATUS_ACTIVE',
            cardLimit: '30000',
            expiresAt: '2030-12-31T00:00:00Z',
          },
        ],
      },
    }).as('cards')
    cy.intercept('GET', '/api/v1/authorized-persons*', {
      statusCode: 200,
      body: { authorizedPersons: [] },
    })
    cy.intercept('POST', '/api/v1/verification/request', {
      statusCode: 200,
      body: { verificationId: 'v-card', code: '424242', expiresAt: TODAY },
    }).as('verifReq')
    cy.intercept('POST', '/api/v1/cards', {
      statusCode: 400,
      body: { code: 400, message: 'Lični račun može imati najviše 2 kartice.' },
    }).as('createCard')

    cy.visit('/banking/kartice')
    cy.wait('@cards')
    cy.findByRole('button', { name: /Nova kartica/ }).click()
    // CardCreateDialog: pretraga + klik bira račun.
    cy.contains('button', '265-0001-111111111-10').click()
    cy.get('input[inputmode="decimal"]').last().clear().type('20000')
    cy.findByRole('button', { name: /Kreiraj karticu/ }).click()
    cy.wait('@verifReq')
    cy.get('#verif-code').type('424242')
    cy.findByRole('button', { name: /^Potvrdi$/ }).click()
    cy.wait('@createCard')
    // Poruka iz backend-a stiže do oba banner-a (CardCreateDialog
    // create.error + VerificationDialog submitError); proveravamo da je
    // negde na ekranu, ne i koji dialog je gore — overlay-i se preklapaju
    // i visibility provera nije pouzdana.
    cy.contains('Lični račun može imati najviše 2 kartice.').should('exist')
  })
})
