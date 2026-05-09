/// <reference types="cypress" />

// Spec p.37: admin manually corrects listing price/ask/bid. Canned —
// fires the upsertListing PUT and re-fetches the security on success.

const PERMS = ['admin']

function fakeToken(): string {
  const payload = btoa(
    JSON.stringify({
      sub: 'a',
      kind: 'employee',
      perms: PERMS,
      sv: 1,
      exp: Math.floor(Date.now() / 1000) + 900,
    }),
  )
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.dummy`
}

describe('Celina 3 — admin price override', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/v1/auth/refresh', {
      statusCode: 200,
      body: { accessToken: fakeToken(), accessExpiresIn: 900 },
    })
    cy.intercept('GET', '/api/v1/auth/me', {
      statusCode: 200,
      body: { employee: { id: 'a', email: 'a@e.com', permissions: PERMS } },
    })
    cy.window().then((win) => {
      win.sessionStorage.setItem(
        'banka-auth',
        JSON.stringify({
          state: {
            accessToken: fakeToken(),
            userId: 'a',
            userKind: 'employee',
            permissions: PERMS,
          },
          version: 0,
        }),
      )
    })

    cy.intercept('GET', '/api/v1/securities/aapl', {
      statusCode: 200,
      body: {
        security: { id: 'aapl', ticker: 'AAPL', name: 'Apple Inc.', type: 'SECURITY_TYPE_STOCK', exchangeMic: 'XNAS', currency: 'CURRENCY_USD' },
        listing: { id: 'lst-aapl', securityId: 'aapl', exchangeMic: 'XNAS', price: '180.00', ask: '180.10', bid: '179.90' },
      },
    })
    cy.intercept('GET', /\/api\/v1\/listings\/lst-aapl\/history.*/, { statusCode: 200, body: { rows: [] } })
    cy.intercept('GET', '/api/v1/securities/aapl/option-chain*', { statusCode: 200, body: { groups: [] } })
  })

  it('admin opens the dialog, submits new prices and closes', () => {
    cy.intercept('PUT', '/api/v1/listings', (req) => {
      expect(req.body).to.deep.include({
        securityId: 'aapl',
        exchangeMic: 'XNAS',
        price: '185.00',
        ask: '185.20',
        bid: '184.80',
      })
      req.reply({
        statusCode: 200,
        body: { id: 'lst-aapl', securityId: 'aapl', exchangeMic: 'XNAS', price: '185.00', ask: '185.20', bid: '184.80' },
      })
    }).as('upsert')

    cy.visit('/portal/trgovina/aapl')
    cy.get('[data-cy="open-price-override"]').click()

    cy.get('#po-price').clear().type('185.00')
    cy.get('#po-ask').clear().type('185.20')
    cy.get('#po-bid').clear().type('184.80')
    cy.contains('button', 'Sačuvaj').click()

    cy.wait('@upsert')
    cy.get('#po-price').should('not.exist')
  })

  it('rejects non-numeric input client-side', () => {
    cy.visit('/portal/trgovina/aapl')
    cy.get('[data-cy="open-price-override"]').click()

    cy.get('#po-price').clear().type('abc')
    cy.contains('button', 'Sačuvaj').click()
    cy.contains('Mora biti broj.').should('be.visible')
  })
})
