/// <reference types="cypress" />

// Banka2025-E2E.pdf, "Detalji hartije":
//   - leva strana: instrument card sa per-kind atributima
//   - desna strana: istorija cene + range toggle
//   - ispod: forma za trgovinu (placeholder do FE-6)
//   - za akcije: opcioni lanac sa pickerom datuma izvršenja

const PERMS = ['actuary', 'actuary.supervisor']

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

function authStub() {
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
}

describe('Celina 3 — listing detail', () => {
  beforeEach(authStub)

  it('stock detail renders option chain with strike bracket', () => {
    cy.intercept('GET', '/api/v1/securities/aapl', {
      statusCode: 200,
      body: {
        security: {
          id: 'aapl',
          ticker: 'AAPL',
          name: 'Apple Inc.',
          type: 'SECURITY_TYPE_STOCK',
          exchangeMic: 'XNAS',
          currency: 'CURRENCY_USD',
          marketCap: '3000000000',
          outstandingShares: '15000000',
          dividendYield: '0.005',
        },
        listing: { id: 'lst-aapl', securityId: 'aapl', exchangeMic: 'XNAS', price: '180.00', ask: '180.10', bid: '179.90', volume: '12000', changeAmt: '1.20' },
        maintenanceMargin: '54.00',
        initialMarginCost: '59.40',
      },
    })
    cy.intercept('GET', /\/api\/v1\/listings\/lst-aapl\/history.*/, {
      statusCode: 200,
      body: {
        rows: [
          { date: '2026-04-10', price: '170.00', volume: '11000' },
          { date: '2026-04-20', price: '175.00', volume: '11500' },
          { date: '2026-05-01', price: '180.00', volume: '12000' },
        ],
      },
    })
    cy.intercept('GET', '/api/v1/securities/aapl/option-chain*', {
      statusCode: 200,
      body: {
        groups: [
          {
            settlementDate: '2026-09-19',
            sharedPrice: '180.00',
            rows: [
              { strikePrice: '170.00', call: { id: 'c-170', premium: '12.00', impliedVolatility: '0.25', openInterest: 4321, optionType: 'OPTION_TYPE_CALL' }, put: { id: 'p-170', premium: '2.00', impliedVolatility: '0.25', openInterest: 1100, optionType: 'OPTION_TYPE_PUT' } },
              { strikePrice: '175.00', call: { id: 'c-175', premium: '8.00', impliedVolatility: '0.25', openInterest: 2000, optionType: 'OPTION_TYPE_CALL' }, put: { id: 'p-175', premium: '3.00', impliedVolatility: '0.25', openInterest: 800, optionType: 'OPTION_TYPE_PUT' } },
              { strikePrice: '180.00', call: { id: 'c-180', premium: '5.00', impliedVolatility: '0.25', openInterest: 1500, optionType: 'OPTION_TYPE_CALL' }, put: { id: 'p-180', premium: '5.00', impliedVolatility: '0.25', openInterest: 1500, optionType: 'OPTION_TYPE_PUT' } },
            ],
          },
          {
            settlementDate: '2026-12-19',
            sharedPrice: '180.00',
            rows: [{ strikePrice: '180.00', call: { id: 'c-180-dec', premium: '9.00', optionType: 'OPTION_TYPE_CALL' }, put: { id: 'p-180-dec', premium: '8.00', optionType: 'OPTION_TYPE_PUT' } }],
          },
        ],
      },
    })

    cy.visit('/portal/trgovina/aapl')

    cy.contains('AAPL').should('be.visible')
    cy.contains('Apple Inc.').should('be.visible')
    cy.contains('Tržišna kapitalizacija').should('be.visible')
    cy.contains('Maintenance margin').parent().should('contain', '54,00')

    cy.contains('Istorija cene').should('be.visible')
    cy.get('svg[role="img"]').should('exist')

    cy.contains('Opcioni lanac').should('be.visible')
    cy.contains('th', 'Strike').should('be.visible')
    cy.contains('td', '170,00').should('be.visible')
    // Spec p.59 chain layout: CALLS|Strike|PUTS headers + per-side
    // columns (Last/Theta/Bid/Ask/Vol/OI), and OI is the only one
    // backed by real proto data so it should render verbatim.
    cy.get('[data-cy="option-chain-table"]').within(() => {
      cy.contains('th', 'CALLS').should('be.visible')
      cy.contains('th', 'PUTS').should('be.visible')
      cy.contains('th', 'Theta').should('be.visible')
      cy.contains('td', '4321').should('be.visible')
    })
  })

  it('future detail renders without option chain', () => {
    cy.intercept('GET', '/api/v1/securities/cl-fut', {
      statusCode: 200,
      body: {
        security: {
          id: 'cl-fut',
          ticker: 'CLZ6',
          name: 'WTI Crude Oil December 2026',
          type: 'SECURITY_TYPE_FUTURE',
          exchangeMic: 'XNYM',
          currency: 'CURRENCY_USD',
          contractSize: '1000',
          contractUnit: 'bbl',
          settlementDate: '2026-12-20',
        },
        listing: { id: 'lst-cl', securityId: 'cl-fut', price: '70.00', volume: '500' },
      },
    })
    cy.intercept('GET', '/api/v1/listings/lst-cl/history*', { statusCode: 200, body: { rows: [] } })

    cy.visit('/portal/trgovina/cl-fut')

    cy.contains('CLZ6').should('be.visible')
    cy.contains('Veličina ugovora').parent().should('contain', '1000 bbl')
    cy.contains('Opcioni lanac').should('not.exist')
    cy.contains('Nema istorije').should('be.visible')
  })

  it('option detail shows underlying ticker and strike/premium fields', () => {
    cy.intercept('GET', '/api/v1/securities/opt-1', {
      statusCode: 200,
      body: {
        security: {
          id: 'opt-1',
          ticker: 'AAPL250919C00180000',
          type: 'SECURITY_TYPE_OPTION',
          currency: 'CURRENCY_USD',
          optionType: 'OPTION_TYPE_CALL',
          strikePrice: '180.00',
          premium: '5.00',
          impliedVolatility: '0.32',
          openInterest: '1500',
          settlementDate: '2026-09-19',
          underlyingSecurityId: 'aapl',
        },
        listing: { id: 'lst-opt', securityId: 'opt-1', price: '5.00', volume: '20' },
      },
    })
    cy.intercept('GET', '/api/v1/listings/lst-opt/history*', { statusCode: 200, body: { rows: [] } })
    cy.intercept('GET', '/api/v1/securities/aapl', {
      statusCode: 200,
      body: { security: { id: 'aapl', ticker: 'AAPL', type: 'SECURITY_TYPE_STOCK' } },
    })

    cy.visit('/portal/trgovina/opt-1')

    cy.contains('AAPL250919C00180000').should('be.visible')
    cy.contains('Strike').parent().should('contain', '180,00')
    cy.contains('Premium').parent().should('contain', '5,00')
    cy.contains('Bazna hartija').parent().should('contain', 'AAPL')
  })

  // Regression for the spec p.42 forex gate: ListingDetail's
  // tradable check used to exclude forex, so the OrderForm never
  // rendered. Just asserts the form exists; the end-to-end
  // submission lives in the live spec forex-buy.cy.ts.
  it('forex detail renders the order form (regression for the tradable gate)', () => {
    cy.intercept('GET', '/api/v1/securities/eurusd', {
      statusCode: 200,
      body: {
        security: {
          id: 'eurusd',
          ticker: 'EURUSD',
          name: 'Euro / US Dollar',
          type: 'SECURITY_TYPE_FOREX',
          exchangeMic: 'XFOREX',
          currency: 'CURRENCY_USD',
          baseCurrency: 'CURRENCY_EUR',
          quoteCurrency: 'CURRENCY_USD',
          contractSize: '1000',
          liquidity: 'high',
        },
        listing: { id: 'lst-eurusd', securityId: 'eurusd', exchangeMic: 'XFOREX', price: '1.10', ask: '1.11', bid: '1.09', volume: '5000' },
      },
    })
    cy.intercept('GET', /\/api\/v1\/listings\/lst-eurusd\/history.*/, { statusCode: 200, body: { rows: [] } })
    cy.intercept('GET', /\/api\/v1\/accounts\?.*/, { statusCode: 200, body: { accounts: [] } })

    cy.visit('/portal/trgovina/eurusd')

    cy.contains('EURUSD').should('be.visible')
    cy.contains('Bazna valuta').parent().should('contain', 'EUR')
    cy.contains('Kvotna valuta').parent().should('contain', 'USD')
    cy.get('#order-form').should('be.visible')
  })
})
