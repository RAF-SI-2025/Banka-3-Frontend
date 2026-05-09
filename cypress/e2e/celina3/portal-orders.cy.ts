/// <reference types="cypress" />

// FE-10 + FE-11: portal-side trading.
//   - agent placing an order over their daily limit sees the
//     "ide na odobrenje" pending badge
//   - supervisor lands on /portal/trgovina/nalozi and can approve a
//     pending order

function fakeToken(perms: string[], sub = 'a'): string {
  const payload = btoa(
    JSON.stringify({
      sub,
      kind: 'employee',
      perms,
      sv: 1,
      exp: Math.floor(Date.now() / 1000) + 900,
    }),
  )
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.dummy`
}

function visitWithAuth(url: string, perms: string[], sub = 'a') {
  cy.visit(url, {
    onBeforeLoad: (win) => {
      win.sessionStorage.setItem(
        'banka-auth',
        JSON.stringify({
          state: { accessToken: fakeToken(perms, sub), userId: sub, userKind: 'employee', permissions: perms },
          version: 0,
        }),
      )
    },
  })
}

function commonAuth(perms: string[], sub = 'a') {
  cy.intercept('POST', '/api/v1/auth/refresh', { statusCode: 200, body: { accessToken: fakeToken(perms, sub), accessExpiresIn: 900 } })
  cy.intercept('GET', '/api/v1/auth/me', { statusCode: 200, body: { employee: { id: sub, email: `${sub}@banka.local`, permissions: perms } } })
}

function listingIntercepts() {
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
    body: {
      accounts: [
        { id: 'usd', number: '1', ownerClientId: 'a', currency: 'CURRENCY_USD', status: 'ACCOUNT_STATUS_ACTIVE', balance: '50000.00', availableBalance: '50000.00' },
      ],
    },
  })
  // Quote: 1 USD ≈ 100 RSD (no commission). Used for both
  // commission-cap conversion and the agent RSD-equivalent panel.
  cy.intercept('POST', '/api/v1/menjacnica/quote', { statusCode: 200, body: { fromAmount: '1', toAmount: '100', rate: '100', commission: '0' } })
}

describe('Celina 3 — portal trading (agent)', () => {
  const AGENT_PERMS = ['actuary', 'actuary.agent', 'trading.margin']

  beforeEach(() => {
    commonAuth(AGENT_PERMS)
    listingIntercepts()
    // Agent has 1m RSD daily, already used 950k. Even small orders
    // here will tip them over the cap.
    cy.intercept('GET', '/api/v1/actuaries/a', {
      statusCode: 200,
      body: {
        employeeId: 'a',
        type: 'ACTUARY_TYPE_AGENT',
        dailyLimit: '1000000.00',
        usedLimit: '950000.00',
        needApproval: false,
      },
    })
  })

  it('shows pending-approval badge once the form crosses the limit', () => {
    visitWithAuth('/portal/trgovina/aapl', AGENT_PERMS)
    // Listing currency is USD; ~1 USD = 100 RSD. Need approx > 50k RSD
    // to push past the 1m cap from 950k. 600 USD * 100 = 60k RSD over
    // the line.
    cy.get('#of-qty').type('600')
    cy.get('#of-acct').select('usd')
    cy.get('[data-cy="limit-panel"]').should('be.visible')
    cy.get('[data-cy="needs-approval"]').should('be.visible').and('contain', 'odobrenje')
  })

  it('does not show needs-approval badge when projected stays under the cap', () => {
    visitWithAuth('/portal/trgovina/aapl', AGENT_PERMS)
    cy.get('#of-qty').type('1')
    cy.get('#of-acct').select('usd')
    cy.get('[data-cy="limit-panel"]').should('be.visible')
    cy.get('[data-cy="needs-approval"]').should('not.exist')
  })
})

describe('Celina 3 — portal trading (supervisor)', () => {
  const SUPERVISOR_PERMS = ['actuary', 'actuary.supervisor']

  beforeEach(() => {
    commonAuth(SUPERVISOR_PERMS, 's')
  })

  const PENDING_ORDER = {
    id: 'o1',
    userId: 'agent-1',
    userKind: 'USER_KIND_EMPLOYEE',
    securityId: 'aapl',
    orderType: 'ORDER_TYPE_MARKET',
    direction: 'DIRECTION_BUY',
    quantity: 100,
    remainingQuantity: 100,
    status: 'ORDER_STATUS_PENDING',
    isDone: false,
    cancelled: false,
    createdAt: '2026-05-09T10:00:00Z',
  }

  it('approves a pending order from the cross-user list', () => {
    cy.intercept('GET', '/api/v1/orders*', { statusCode: 200, body: { orders: [PENDING_ORDER], total: '1' } })
    cy.intercept('POST', '/api/v1/orders/o1/approve', {
      statusCode: 200,
      body: { ...PENDING_ORDER, status: 'ORDER_STATUS_APPROVED' },
    }).as('approve')

    visitWithAuth('/portal/trgovina/nalozi', SUPERVISOR_PERMS, 's')
    cy.contains('Pregled naloga').should('be.visible')
    cy.contains('Zaposleni').should('be.visible')
    cy.get('[data-cy="filter-user"]').should('exist')
    cy.get('[data-cy="approve-order"]').first().click()
    cy.wait('@approve')
  })

  it('cekajuci preset redirects to status=pending', () => {
    cy.intercept('GET', '/api/v1/orders*', { statusCode: 200, body: { orders: [], total: '0' } }).as('list')
    visitWithAuth('/portal/trgovina/nalozi/cekajuci', SUPERVISOR_PERMS, 's')
    cy.location('pathname').should('eq', '/portal/trgovina/nalozi')
    cy.location('search').should('include', 'status=pending')
    cy.wait('@list').its('request.url').should('include', 'status=pending')
  })

  it('agent without supervisor perm cannot act on orders', () => {
    const AGENT_PERMS = ['actuary', 'actuary.agent']
    commonAuth(AGENT_PERMS, 'a')
    cy.intercept('GET', '/api/v1/orders*', { statusCode: 200, body: { orders: [PENDING_ORDER], total: '1' } })

    visitWithAuth('/portal/trgovina/nalozi', AGENT_PERMS, 'a')
    cy.get('[data-cy="approve-order"]').should('not.exist')
    cy.get('[data-cy="decline-order"]').should('not.exist')
    cy.get('[data-cy="filter-user"]').should('not.exist')
  })
})
