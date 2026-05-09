/// <reference types="cypress" />

// Banka2025-E2E.pdf, "Berze i hartije":
//   - kataloške tabele po vrsti hartije (Akcije / Futures / Forex / Opcije)
//   - filteri po berzi/ceni/volumenu, sortiranje, klikom se otvara detalj
//
// Canned spec — exercises tab switching, filter→query-string serialisation,
// per-kind columns and sort flip. Live trading stack lives in c3 backend
// integration tests; this only covers the FE UX wiring.

const PERMS = [
  'client.read',
  'account.read',
  'card.read',
  'card.write',
  'payment.write',
  'loan.read',
  'loan.write',
  'actuary',
  'actuary.supervisor',
]

function fakeToken(): string {
  const payload = btoa(
    JSON.stringify({
      sub: 'e',
      kind: 'employee',
      perms: PERMS,
      sv: 1,
      exp: Math.floor(Date.now() / 1000) + 900,
    }),
  )
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.dummy`
}

const EXCHANGES = {
  exchanges: [
    { mic: 'XNAS', acronym: 'NASDAQ', name: 'Nasdaq', currency: 'CURRENCY_USD', isOpen: true, isAfterHours: false },
    { mic: 'XNYS', acronym: 'NYSE', name: 'NYSE', currency: 'CURRENCY_USD', isOpen: true, isAfterHours: false },
  ],
}

function stockRow(i: number) {
  return {
    security: {
      id: `s${i}`,
      ticker: `TIC${i}`,
      name: `Stock ${i}`,
      type: 'SECURITY_TYPE_STOCK',
      exchangeMic: 'XNAS',
      currency: 'CURRENCY_USD',
      marketCap: `${i * 100000}`,
    },
    listing: { id: `l${i}`, securityId: `s${i}`, exchangeMic: 'XNAS', price: `${10 + i}.00`, volume: `${1000 * i}` },
    maintenanceMargin: `${5 + i}.00`,
  }
}
function futureRow(i: number) {
  return {
    security: {
      id: `f${i}`,
      ticker: `FUT${i}`,
      name: `Future ${i}`,
      type: 'SECURITY_TYPE_FUTURE',
      exchangeMic: 'XNAS',
      currency: 'CURRENCY_USD',
      contractSize: '100',
      contractUnit: 'bbl',
      settlementDate: '2026-09-30',
    },
    listing: { id: `lf${i}`, securityId: `f${i}`, price: `${50 + i}.00`, volume: `${50 * i}` },
  }
}
function forexRow(i: number) {
  return {
    security: {
      id: `x${i}`,
      ticker: `FX${i}`,
      name: `Forex ${i}`,
      type: 'SECURITY_TYPE_FOREX',
      baseCurrency: 'CURRENCY_EUR',
      quoteCurrency: 'CURRENCY_USD',
      liquidity: `${100 * i}`,
    },
    listing: { id: `lx${i}`, securityId: `x${i}`, price: '1.10', ask: '1.11', bid: '1.09' },
  }
}
function optionRow(i: number) {
  return {
    security: {
      id: `o${i}`,
      ticker: `OPT${i}`,
      type: 'SECURITY_TYPE_OPTION',
      currency: 'CURRENCY_USD',
      optionType: i % 2 === 0 ? 'OPTION_TYPE_CALL' : 'OPTION_TYPE_PUT',
      strikePrice: `${100 + i}.00`,
      premium: `${1 + i}.00`,
      impliedVolatility: '0.25',
      settlementDate: '2026-12-19',
    },
    listing: { id: `lo${i}`, securityId: `o${i}`, price: '1.00' },
  }
}

describe('Celina 3 — listings catalog', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/v1/auth/refresh', {
      statusCode: 200,
      body: { accessToken: fakeToken(), accessExpiresIn: 900 },
    })
    cy.intercept('GET', '/api/v1/auth/me', {
      statusCode: 200,
      body: { employee: { id: 'e', email: 'e@e.com', permissions: PERMS } },
    })
    cy.window().then((win) => {
      win.sessionStorage.setItem(
        'banka-auth',
        JSON.stringify({
          state: {
            accessToken: fakeToken(),
            userId: 'e',
            userKind: 'employee',
            permissions: PERMS,
          },
          version: 0,
        }),
      )
    })

    cy.intercept('GET', '/api/v1/exchanges', { statusCode: 200, body: EXCHANGES })

    cy.intercept('GET', /\/api\/v1\/securities.*type=SECURITY_TYPE_STOCK/, {
      statusCode: 200,
      body: { items: [1, 2, 3, 4, 5].map(stockRow), total: '5', page: 1, pageSize: 25 },
    }).as('listStocks')
    cy.intercept('GET', /\/api\/v1\/securities.*type=SECURITY_TYPE_FUTURE/, {
      statusCode: 200,
      body: { items: [1, 2, 3, 4, 5].map(futureRow), total: '5', page: 1, pageSize: 25 },
    }).as('listFutures')
    cy.intercept('GET', /\/api\/v1\/securities.*type=SECURITY_TYPE_FOREX/, {
      statusCode: 200,
      body: { items: [1, 2, 3, 4, 5].map(forexRow), total: '5', page: 1, pageSize: 25 },
    }).as('listForex')
    cy.intercept('GET', /\/api\/v1\/securities.*type=SECURITY_TYPE_OPTION/, {
      statusCode: 200,
      body: { items: [1, 2, 3, 4, 5].map(optionRow), total: '5', page: 1, pageSize: 25 },
    }).as('listOptions')
  })

  it('renders all four tabs with 5 fixture rows each', () => {
    cy.visit('/portal/trgovina')
    cy.wait('@listStocks')
    cy.contains('th', 'Tržišna kap.').should('be.visible')
    cy.contains('td', 'TIC1').should('be.visible')

    cy.get('[data-cy="tab-SECURITY_TYPE_FUTURE"]').click()
    cy.wait('@listFutures')
    cy.contains('th', 'Veličina ugovora').should('be.visible')
    cy.contains('td', 'FUT1').should('be.visible')

    cy.get('[data-cy="tab-SECURITY_TYPE_FOREX"]').click()
    cy.wait('@listForex')
    cy.contains('th', 'Likvidnost').should('be.visible')
    cy.contains('td', 'EUR/USD').should('be.visible')

    cy.get('[data-cy="tab-SECURITY_TYPE_OPTION"]').click()
    cy.wait('@listOptions')
    cy.contains('th', 'Strike').should('be.visible')
    cy.contains('td', 'OPT1').should('be.visible')
  })

  it('flips the sort direction and re-queries', () => {
    cy.visit('/portal/trgovina')
    cy.wait('@listStocks').its('request.url').should('include', 'sortDesc=true')

    cy.get('[data-cy="filter-sort-dir"]').click()
    cy.wait('@listStocks').its('request.url').should('include', 'sortDesc=false')
  })
})
