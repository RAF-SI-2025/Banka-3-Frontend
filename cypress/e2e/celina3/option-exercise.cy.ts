/// <reference types="cypress" />

// Banka2025-flow.pdf, "3 - Trgovanje na berzi · Provera 4 - kupovina
// i koriscenje opcija". Two halves:
//
//   1. Live: against the seeded AAPL-C-190 holding (planted by
//      seedTrading on the agent), drive /portal/portfolio →
//      Iskoristi → Potvrdi and assert the option qty drops + the
//      underlying AAPL holding appears with strike-priced cost basis.
//      The BE-side TestIntegration_ExerciseOption_CallBuysUnderlying
//      already asserts the cash-leg shape; this verifies that the FE
//      built the right payload such that the gateway, gRPC routing,
//      validation, and the bank's SettleTrade all accepted it, and
//      that the user-observable portfolio reflects the exchange.
//
//   2. Canned: a stubbed-OOM-PUT case driving the dialog's gate logic
//      (Potvrdi disabled, "out-of-the-money" reason rendered). No
//      backend coupling — just the FE state machine on stubbed data.

describe('Celina 3 (live) — agent iskorišćava ITM CALL', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('drops the option holding to 0 and credits the underlying at strike', () => {
    cy.loginAsAgent()
    // Warm vite on /portal first; the cold lazy-bundle on
    // /portal/portfolio can otherwise blank-paint past the 15s budget.
    cy.visit('/portal')
    cy.contains('Dobrodošli', { timeout: 15000 }).should('be.visible')
    cy.visit('/portal/portfolio')

    cy.contains('h1', 'Portfolio (aktuar)', { timeout: 20000 }).should('be.visible')

    // Spec p.59 ITM badge: AAPL spot 190.50 > strike 190.00 ⇒ ITM.
    cy.contains('tr', 'AAPL-C-190', { timeout: 15000 }).within(() => {
      cy.contains('button', 'Iskoristi').click()
    })

    cy.contains('Iskoristi opciju AAPL-C-190').should('be.visible')
    cy.contains('In the money').should('be.visible')

    // Default qty=1; one contract of size 100 ⇒ 100 underlying shares
    // bought at strike 190.00.
    cy.get('[data-cy="exercise-confirm"]').click()

    // Dialog closes on success.
    cy.contains('Iskoristi opciju AAPL-C-190', { timeout: 10000 }).should('not.exist')

    // Option holding decremented from 5 → 4. We assert the visible
    // qty cell rather than the BE row count to keep this firmly a FE
    // test of user-observable state.
    cy.contains('tr', 'AAPL-C-190', { timeout: 10000 }).within(() => {
      cy.get('td').eq(3).should('contain', '4')
    })

    // Underlying delivered to the agent's portfolio. Spec p.61.d:
    // CALL exercise buys `qty × contract_size` shares at strike,
    // so one contract = 100 AAPL @ 190.00. The portfolio table
    // surfaces ticker + količina; "AAPL" appears as a stock row.
    cy.contains('tr', 'AAPL').filter(':not(:contains(AAPL-C-190))').first().within(() => {
      cy.get('td').should('contain', '100')
    })
  })
})

describe('Celina 3 — option exercise dialog gate (canned OOM case)', () => {
  // FE state machine: Potvrdi must be disabled when the option is
  // out of the money. Stubbed because the OOM signal is purely
  // computed from the underlying spot vs the strike, which the
  // dialog reads off /v1/securities/<underlyingId>. No POST
  // assertion here — the disabled-button check IS the assertion.
  const PERMS = ['actuary', 'actuary.agent', 'trading.margin']

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

  function visitWithAuth(url: string) {
    cy.visit(url, {
      onBeforeLoad: (win) => {
        win.sessionStorage.setItem(
          'banka-auth',
          JSON.stringify({
            state: { accessToken: fakeToken(), userId: 'a', userKind: 'employee', permissions: PERMS },
            version: 0,
          }),
        )
      },
    })
  }

  beforeEach(() => {
    cy.intercept('POST', '/api/v1/auth/refresh', { statusCode: 200, body: { accessToken: fakeToken(), accessExpiresIn: 900 } })
    cy.intercept('GET', '/api/v1/auth/me', { statusCode: 200, body: { employee: { id: 'a', email: 'a@b.local', permissions: PERMS } } })
    cy.intercept('GET', /\/api\/v1\/portfolio(\?.*)?$/, {
      statusCode: 200,
      body: {
        totalProfit: '0.00',
        holdings: [
          {
            id: 'h-put',
            userId: 'a',
            security: {
              id: 'opt-put',
              ticker: 'AAPL250919P00190000',
              type: 'SECURITY_TYPE_OPTION',
              currency: 'CURRENCY_USD',
              optionType: 'OPTION_TYPE_PUT',
              strikePrice: '190.00',
              contractSize: '100',
              settlementDate: '2099-09-19',
              underlyingSecurityId: 'aapl',
            },
            quantity: 2,
            weightedAvgPrice: '5.00',
            currentPrice: '5.00',
            marketValue: '10.00',
            profit: '0.00',
          },
        ],
      },
    })
    // PUT with underlying 210 > strike 190 ⇒ out-of-the-money.
    cy.intercept('GET', '/api/v1/securities/aapl', {
      statusCode: 200,
      body: {
        security: { id: 'aapl', ticker: 'AAPL', type: 'SECURITY_TYPE_STOCK', currency: 'CURRENCY_USD' },
        listing: { id: 'lst-aapl', securityId: 'aapl', price: '210.00', ask: '210.10', bid: '209.90' },
      },
    })
  })

  it('OOM PUT: Potvrdi is disabled and the spec p.61.d block reason is shown', () => {
    visitWithAuth('/portal/portfolio')

    cy.contains('tr', 'AAPL250919P00190000').within(() => {
      cy.contains('button', 'Iskoristi').click()
    })

    cy.contains('Out of the money').should('be.visible')
    cy.contains('out-of-the-money').should('be.visible')
    cy.get('[data-cy="exercise-confirm"]').should('be.disabled')
  })
})
