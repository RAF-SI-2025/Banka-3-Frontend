/// <reference types="cypress" />

// Banka2025-E2E.pdf, "Postavljanje naloga":
//   - klijent otvara detalj hartije, popuni nalog (smer, količina,
//     opc. limit/stop, AON/Margin, izvorni račun) i pošalje
//
// Canned. Live placement is covered by trading service integration
// tests; this only nails the FE wiring (form fields, deep-link
// initials, derived OrderType, submit shape).

const PERMS = ['client.read', 'account.read', 'trading.client']

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

function visitWithAuth(url: string) {
  cy.visit(url, {
    onBeforeLoad: (win) => {
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
    },
  })
}

function authStub() {
  cy.intercept('POST', '/api/v1/auth/refresh', {
    statusCode: 200,
    body: { accessToken: fakeToken(), accessExpiresIn: 900 },
  })
  cy.intercept('GET', '/api/v1/auth/me', {
    statusCode: 200,
    body: { client: { id: 'c', email: 'c@e.com', permissions: PERMS } },
  })

  cy.intercept('GET', '/api/v1/accounts*', {
    statusCode: 200,
    body: {
      accounts: [
        {
          id: 'usd',
          number: '265000111111111110',
          ownerClientId: 'c',
          currency: 'CURRENCY_USD',
          status: 'ACCOUNT_STATUS_ACTIVE',
          balance: '50000.00',
          availableBalance: '50000.00',
        },
        {
          id: 'rsd',
          number: '265000122222222220',
          ownerClientId: 'c',
          currency: 'CURRENCY_RSD',
          status: 'ACCOUNT_STATUS_ACTIVE',
          balance: '500000.00',
          availableBalance: '500000.00',
        },
      ],
    },
  })
  cy.intercept('POST', '/api/v1/menjacnica/quote', {
    statusCode: 200,
    body: { fromAmount: '1', toAmount: '1', rate: '1', commission: '0' },
  })
  cy.intercept('GET', '/api/v1/securities/aapl', {
    statusCode: 200,
    body: {
      security: { id: 'aapl', ticker: 'AAPL', type: 'SECURITY_TYPE_STOCK', exchangeMic: 'XNAS', currency: 'CURRENCY_USD', contractSize: '1' },
      listing: { id: 'lst-aapl', securityId: 'aapl', exchangeMic: 'XNAS', price: '180.00', ask: '180.10', bid: '179.90' },
    },
  })
  cy.intercept('GET', /\/api\/v1\/listings\/lst-aapl\/history.*/, { statusCode: 200, body: { rows: [] } })
  cy.intercept('GET', '/api/v1/securities/aapl/option-chain*', { statusCode: 200, body: { groups: [] } })
}

describe('Celina 3 — order placement', () => {
  beforeEach(authStub)

  it('client places a market BUY order', () => {
    cy.intercept('POST', '/api/v1/orders', (req) => {
      expect(req.body).to.deep.include({
        securityId: 'aapl',
        direction: 'DIRECTION_BUY',
        orderType: 'ORDER_TYPE_MARKET',
        quantity: 10,
        accountId: 'usd',
        allOrNone: false,
        margin: false,
      })
      req.reply({
        statusCode: 200,
        body: { id: 'o1', securityId: 'aapl', direction: 'DIRECTION_BUY', orderType: 'ORDER_TYPE_MARKET', quantity: 10 },
      })
    }).as('place')

    visitWithAuth('/banking/trgovina/aapl')
    cy.get('#of-qty').type('10')
    cy.get('#of-acct').select('usd')
    cy.get('[data-cy="order-submit"]').click()

    // Spec p.56: confirmation dialog gates the actual submit.
    cy.get('[data-cy="order-confirm-dialog"]').should('be.visible')
    cy.get('[data-cy="order-confirm-submit"]').click()

    cy.wait('@place')
  })

  it('limit price toggles derived OrderType in submit', () => {
    cy.intercept('POST', '/api/v1/orders', (req) => {
      expect(req.body).to.deep.include({
        orderType: 'ORDER_TYPE_LIMIT',
        limitPrice: '175.00',
        quantity: 5,
        direction: 'DIRECTION_BUY',
      })
      req.reply({ statusCode: 200, body: { id: 'o2' } })
    }).as('placeLimit')

    visitWithAuth('/banking/trgovina/aapl')
    cy.get('#of-qty').type('5')
    cy.get('#of-limit').type('175.00')
    cy.get('#of-acct').select('usd')
    cy.get('[data-cy="order-submit"]').click()
    cy.get('[data-cy="order-confirm-submit"]').click()
    cy.wait('@placeLimit')
  })

  it('cancel in confirm dialog does not POST', () => {
    let placed = false
    cy.intercept('POST', '/api/v1/orders', () => {
      placed = true
    }).as('placeNever')

    visitWithAuth('/banking/trgovina/aapl')
    cy.get('#of-qty').type('2')
    cy.get('#of-acct').select('usd')
    cy.get('[data-cy="order-submit"]').click()

    cy.get('[data-cy="order-confirm-dialog"]').should('be.visible')
    cy.get('[data-cy="order-confirm-cancel"]').click()
    cy.get('[data-cy="order-confirm-dialog"]').should('not.exist')

    // Give Cypress a tick to be sure no request was sent.
    cy.wait(150).then(() => expect(placed).to.equal(false))
  })

  it('sell deep-link pre-fills quantity + filters accounts to listing currency', () => {
    visitWithAuth('/banking/trgovina/aapl?direction=sell&qty=3')

    cy.get('#of-qty').should('have.value', '3')
    // Sell must restrict source-account list to USD (listing ccy);
    // the RSD account from the fixture must not appear. Use retrying
    // assertions so we don't snapshot the dropdown before the
    // accounts query resolves.
    cy.get('#of-acct option[value="usd"]').should('exist')
    cy.get('#of-acct option[value="rsd"]').should('not.exist')
  })
})
