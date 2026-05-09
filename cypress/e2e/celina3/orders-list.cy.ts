/// <reference types="cypress" />

// "Moji nalozi" — list view at /banking/trgovina/nalozi.
// Detail page exposes a Cancel button only when status ∈ {pending,
// approved} and the order is not done/cancelled.

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

function authIntercepts() {
  cy.intercept('POST', '/api/v1/auth/refresh', { statusCode: 200, body: { accessToken: fakeToken(), accessExpiresIn: 900 } })
  cy.intercept('GET', '/api/v1/auth/me', { statusCode: 200, body: { client: { id: 'c', email: 'c@e.com', permissions: PERMS } } })
}

const PENDING_ORDER = {
  id: 'o1',
  userId: 'c',
  securityId: 'aapl',
  orderType: 'ORDER_TYPE_MARKET',
  direction: 'DIRECTION_BUY',
  quantity: 10,
  remainingQuantity: 10,
  pricePerUnit: '180.10',
  status: 'ORDER_STATUS_PENDING',
  isDone: false,
  cancelled: false,
  createdAt: '2026-05-09T10:00:00Z',
}

const DONE_ORDER = { ...PENDING_ORDER, id: 'o2', remainingQuantity: 0, status: 'ORDER_STATUS_APPROVED', isDone: true }

describe('Celina 3 — Moji nalozi', () => {
  beforeEach(authIntercepts)

  it('lists pending + done orders with status badges', () => {
    cy.intercept('GET', '/api/v1/orders*', { statusCode: 200, body: { orders: [PENDING_ORDER, DONE_ORDER], total: '2' } })

    visitWithAuth('/banking/trgovina/nalozi')
    cy.contains('Moji nalozi').should('be.visible')
    cy.contains('Na čekanju').should('be.visible')
    cy.contains('Realizovan').should('be.visible')
  })

  it('cancel button is visible on pending order detail', () => {
    cy.intercept('GET', '/api/v1/orders/o1', { statusCode: 200, body: PENDING_ORDER })
    cy.intercept('POST', '/api/v1/orders/o1/cancel', { statusCode: 200, body: { ...PENDING_ORDER, cancelled: true } }).as('cancel')

    visitWithAuth('/banking/trgovina/nalozi/o1')
    cy.get('[data-cy="cancel-order"]').should('be.visible').click()
    cy.wait('@cancel')
  })

  it('cancel button is hidden on done order detail', () => {
    cy.intercept('GET', '/api/v1/orders/o2', { statusCode: 200, body: DONE_ORDER })

    visitWithAuth('/banking/trgovina/nalozi/o2')
    cy.contains('Realizovan').should('be.visible')
    cy.get('[data-cy="cancel-order"]').should('not.exist')
  })
})
