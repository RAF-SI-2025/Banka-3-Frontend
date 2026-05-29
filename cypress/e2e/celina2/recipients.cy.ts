/// <reference types="cypress" />

// Spec p.16 + Banka2025-E2E.pdf, "Feature: Primaoci":
//   - klijent dodaje primaoca, vidi ga na /banking/primaoci
//   - na formi za plaćanje dropdown "Sačuvani primaoci" popunjava
//     polja Naziv + Račun

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

describe('Celina 2 — primaoci', () => {
  beforeEach(bootstrap)

  it('klijent dodaje novog primaoca', () => {
    let listCalls = 0
    cy.intercept('GET', '/api/v1/payment-recipients', (req) => {
      listCalls++
      if (listCalls === 1) {
        req.reply({ statusCode: 200, body: { recipients: [] } })
      } else {
        req.reply({
          statusCode: 200,
          body: {
            recipients: [
              {
                id: 'r-1',
                ownerClientId: 'c',
                name: 'EPS Snabdevanje',
                accountNumber: '160005412345678905',
              },
            ],
          },
        })
      }
    }).as('list')

    cy.intercept('POST', '/api/v1/payment-recipients', (req) => {
      expect(req.body.name).to.eq('EPS Snabdevanje')
      expect(req.body.accountNumber).to.eq('160005412345678905')
      req.reply({
        statusCode: 200,
        body: {
          id: 'r-1',
          ownerClientId: 'c',
          name: 'EPS Snabdevanje',
          accountNumber: '160005412345678905',
        },
      })
    }).as('create')

    cy.visit('/banking/primaoci')
    cy.wait('@list')
    cy.contains('Nema sačuvanih primaoca.').should('be.visible')

    cy.findByRole('button', { name: /Dodaj primaoca/ }).click()
    cy.get('input[name="name"]').type('EPS Snabdevanje')
    cy.get('input[name="accountNumber"]').type('160005412345678905')
    cy.findByRole('button', { name: /^Sačuvaj$/ }).click()
    cy.wait('@create')
    cy.contains('EPS Snabdevanje').should('be.visible')
    // Maskovani prikaz formatAccountNumber-om: 160-0054-123456789-05
    cy.contains('160-0054-123456789-05').should('be.visible')
  })

  it('odbacuje primaoca sa neispravnim kontrolnim brojem računa', () => {
    cy.intercept('GET', '/api/v1/payment-recipients', {
      statusCode: 200,
      body: { recipients: [] },
    }).as('list')

    cy.visit('/banking/primaoci')
    cy.wait('@list')
    cy.findByRole('button', { name: /Dodaj primaoca/ }).click()
    cy.get('input[name="name"]').type('Pogrešan')
    // 160005412345678905 je validan (sum mod 11 = 0); +1 na poslednju
    // cifru pomera sumu na mod-11 = 1 → invalidan kontrolni broj.
    cy.get('input[name="accountNumber"]').type('160005412345678906')
    cy.findByRole('button', { name: /^Sačuvaj$/ }).click()
    cy.contains('Neispravan kontrolni broj računa').should('be.visible')
  })

  it('sa /banking/placanja predefinisani primalac popuni polja na formi', () => {
    cy.intercept('GET', '/api/v1/payment-recipients', {
      statusCode: 200,
      body: {
        recipients: [
          {
            id: 'r-1',
            ownerClientId: 'c',
            name: 'EPS Snabdevanje',
            accountNumber: '160005412345678905',
          },
        ],
      },
    }).as('list')
    cy.intercept('GET', '/api/v1/transactions*', {
      statusCode: 200,
      body: { transactions: [] },
    })

    cy.visit('/banking/placanja')
    cy.wait('@list')
    // Šablon select nema atribut name (podiže se ručno preko applyTemplate);
    // hvatamo ga preko susednog <label>.
    cy.contains('label', 'Sačuvani primaoci').next('select').select('r-1')
    cy.get('input[name="recipientName"]').should('have.value', 'EPS Snabdevanje')
    cy.get('input[name="toAccountNumber"]').should('have.value', '160005412345678905')
  })
})
