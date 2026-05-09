/// <reference types="cypress" />

// Banking surface gating: clients without trading.client should NOT
// see Portfolio/Trgovina sidebar links or the home Trgovina tile.
// Clients with trading.client should see them all.

function fakeToken(perms: string[]): string {
  const payload = btoa(
    JSON.stringify({
      sub: 'c',
      kind: 'client',
      perms,
      sv: 1,
      exp: Math.floor(Date.now() / 1000) + 900,
    }),
  )
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.dummy`
}

function visitWithAuth(url: string, perms: string[]) {
  cy.visit(url, {
    onBeforeLoad: (win) => {
      win.sessionStorage.setItem(
        'banka-auth',
        JSON.stringify({
          state: { accessToken: fakeToken(perms), userId: 'c', userKind: 'client', permissions: perms },
          version: 0,
        }),
      )
    },
  })
}

function authStub(perms: string[]) {
  cy.intercept('POST', '/api/v1/auth/refresh', { statusCode: 200, body: { accessToken: fakeToken(perms), accessExpiresIn: 900 } })
  cy.intercept('GET', '/api/v1/auth/me', { statusCode: 200, body: { client: { id: 'c', email: 'c@e.com', permissions: perms } } })
  cy.intercept('GET', '/api/v1/accounts*', { statusCode: 200, body: { accounts: [] } })
  cy.intercept('GET', '/api/v1/portfolio*', { statusCode: 200, body: { holdings: [], totalProfit: '0' } })
}

describe('Celina 3 — banking trading gate', () => {
  it('client without trading.client sees no trading affordances', () => {
    const perms = ['client.read', 'account.read']
    authStub(perms)
    visitWithAuth('/banking', perms)

    cy.contains('Plaćanja').should('be.visible')
    cy.contains('Trgovina').should('not.exist')
    cy.contains('Portfolio').should('not.exist')
    cy.get('[data-cy="trading-tile"]').should('not.exist')
  })

  it('client with trading.client sees Portfolio + Trgovina nav and tile', () => {
    const perms = ['client.read', 'account.read', 'trading.client']
    authStub(perms)
    visitWithAuth('/banking', perms)

    cy.contains('Trgovina').should('be.visible')
    cy.contains('Portfolio').should('be.visible')
    cy.get('[data-cy="trading-tile"]').should('be.visible')
  })
})
