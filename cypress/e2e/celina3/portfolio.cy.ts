/// <reference types="cypress" />

// Portfolio page + position detail. Sell deep-link from position
// detail → /banking/trgovina/$listingId?direction=sell&qty=N which
// pre-fills the OrderForm (covered separately by order-place.cy.ts).

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
          state: { accessToken: fakeToken(), userId: 'c', userKind: 'client', permissions: PERMS },
          version: 0,
        }),
      )
    },
  })
}

const HOLDINGS_RESPONSE = {
  totalProfit: '300.00',
  holdings: [
    {
      id: 'h-aapl',
      userId: 'c',
      security: { id: 'aapl', ticker: 'AAPL', type: 'SECURITY_TYPE_STOCK' },
      quantity: 10,
      weightedAvgPrice: '170.00',
      currentPrice: '180.00',
      marketValue: '1800.00',
      profit: '100.00',
    },
    {
      id: 'h-cl',
      userId: 'c',
      security: { id: 'cl-fut', ticker: 'CLZ6', type: 'SECURITY_TYPE_FUTURE' },
      quantity: 2,
      weightedAvgPrice: '70.00',
      currentPrice: '75.00',
      marketValue: '150.00',
      profit: '10.00',
    },
  ],
}

describe('Celina 3 — portfolio', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/v1/auth/refresh', { statusCode: 200, body: { accessToken: fakeToken(), accessExpiresIn: 900 } })
    cy.intercept('GET', '/api/v1/auth/me', { statusCode: 200, body: { client: { id: 'c', email: 'c@e.com', permissions: PERMS } } })
    cy.intercept('GET', '/api/v1/portfolio*', { statusCode: 200, body: HOLDINGS_RESPONSE })
  })

  it('lists holdings grouped by kind', () => {
    visitWithAuth('/banking/portfolio')
    cy.contains('Akcija').should('be.visible')
    cy.contains('Future').should('be.visible')
    cy.contains('AAPL').should('be.visible')
    cy.contains('CLZ6').should('be.visible')
    // Total profit summary
    cy.contains('300,00').should('be.visible')
  })

  it('sell deep-link routes to listing detail with direction=sell + qty pre-filled', () => {
    cy.intercept('GET', '/api/v1/securities/aapl', {
      statusCode: 200,
      body: {
        security: { id: 'aapl', ticker: 'AAPL', type: 'SECURITY_TYPE_STOCK', exchangeMic: 'XNAS', currency: 'CURRENCY_USD', contractSize: '1' },
        listing: { id: 'lst-aapl', securityId: 'aapl', exchangeMic: 'XNAS', price: '180.00', ask: '180.10', bid: '179.90' },
      },
    })
    cy.intercept('GET', /\/api\/v1\/listings\/lst-aapl\/history.*/, { statusCode: 200, body: { rows: [] } })
    cy.intercept('GET', '/api/v1/securities/aapl/option-chain*', { statusCode: 200, body: { groups: [] } })
    cy.intercept('GET', '/api/v1/accounts*', {
      statusCode: 200,
      body: { accounts: [{ id: 'usd', number: '265', ownerClientId: 'c', currency: 'CURRENCY_USD', status: 'ACCOUNT_STATUS_ACTIVE', balance: '5000', availableBalance: '5000' }] },
    })
    cy.intercept('POST', '/api/v1/menjacnica/quote', { statusCode: 200, body: { fromAmount: '1', toAmount: '1', rate: '1', commission: '0' } })

    visitWithAuth('/banking/portfolio/aapl')
    cy.get('[data-cy="sell-deeplink"]').click()
    cy.url().should('include', '/banking/trgovina/aapl')
    cy.url().should('include', 'direction=sell')
    cy.url().should('include', 'qty=10')
    cy.get('#of-qty').should('have.value', '10')
  })
})
