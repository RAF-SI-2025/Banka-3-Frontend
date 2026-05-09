/// <reference types="cypress" />

// FE-13: tax board portal.
//   - supervisor sees the unpaid + paid-YTD board
//   - run-tax confirms via dialog and shows the summary
//   - per-user detail shows realized P&L; loss row renders 0 RSD tax
//   - non-supervisor agent is redirected away from /portal/porez

function fakeToken(perms: string[], sub = 's'): string {
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

function visitWithAuth(url: string, perms: string[], sub = 's') {
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

const SUPERVISOR_PERMS = ['actuary', 'actuary.supervisor']
const CLIENT_ID = 'client-1'
const EMP_ID = 'emp-1'

const BOARD = {
  positions: [
    {
      userId: CLIENT_ID,
      userKind: 'USER_KIND_CLIENT',
      displayName: 'Marko Marković',
      unpaidTaxRsd: '598.4437',
      paidTaxYtdRsd: '0',
    },
    {
      userId: EMP_ID,
      userKind: 'USER_KIND_EMPLOYEE',
      displayName: 'Petar Petrović',
      unpaidTaxRsd: '0',
      paidTaxYtdRsd: '12000.00',
    },
  ],
}

function commonAuth(perms: string[], sub = 's') {
  cy.intercept('POST', '/api/v1/auth/refresh', {
    statusCode: 200,
    body: { accessToken: fakeToken(perms, sub), accessExpiresIn: 900 },
  })
  cy.intercept('GET', '/api/v1/auth/me', {
    statusCode: 200,
    body: { employee: { id: sub, email: `${sub}@banka.local`, permissions: perms } },
  })
}

describe('Celina 3 — portal porez (supervisor)', () => {
  beforeEach(() => {
    commonAuth(SUPERVISOR_PERMS)
  })

  it('shows the board with unpaid + paid-YTD rows', () => {
    cy.intercept('GET', '/api/v1/tax/positions*', {
      statusCode: 200,
      body: BOARD,
    })

    visitWithAuth('/portal/porez', SUPERVISOR_PERMS)
    cy.contains('h1', 'Porez na kapitalni dobitak').should('be.visible')

    cy.get(`[data-cy="tax-row-${CLIENT_ID}"]`).should('contain', 'Marko Marković')
    cy.get(`[data-cy="tax-row-${CLIENT_ID}"]`)
      .parents('tr')
      .find('[data-cy="cell-unpaid"]')
      .should('contain', '598,44')
    cy.get(`[data-cy="tax-row-${EMP_ID}"]`)
      .parents('tr')
      .find('[data-cy="cell-paid-ytd"]')
      .should('contain', '12.000,00')
  })

  it('runs the tax job through the confirm dialog and shows the summary', () => {
    cy.intercept('GET', '/api/v1/tax/positions*', { statusCode: 200, body: BOARD }).as('board')
    cy.intercept('POST', '/api/v1/tax/run', {
      statusCode: 200,
      body: { usersTaxed: 1, totalCollectedRsd: '598.4437' },
    }).as('runTax')

    visitWithAuth('/portal/porez', SUPERVISOR_PERMS)
    cy.wait('@board')

    cy.get('[data-cy="run-tax"]').click()
    cy.get('[data-cy="confirm-run-tax"]').click()

    cy.wait('@runTax')
    cy.get('[data-cy="run-tax-result"]').should('contain', '1 korisnika').and('contain', '598,44')
  })

  it('detail page shows standings + realized P&L; loss row renders 0 RSD tax', () => {
    cy.intercept('GET', '/api/v1/tax/positions*', { statusCode: 200, body: BOARD })

    const realized = {
      rows: [
        {
          id: 'pnl-1',
          saleAt: '2026-04-15T10:00:00Z',
          securityId: 'sec-aapl',
          ticker: 'AAPL',
          quantity: 5,
          costBasisAmt: '450.10',
          proceedsAmt: '470.00',
          currency: 'CURRENCY_USD',
          profitNative: '99.50',
          profitRsd: '11000.00',
          taxAmountRsd: '1650.00',
          taxed: false,
          accountId: 'acct-usd',
        },
        {
          id: 'pnl-2',
          saleAt: '2026-04-20T10:00:00Z',
          securityId: 'sec-msft',
          ticker: 'MSFT',
          quantity: 2,
          costBasisAmt: '500.00',
          proceedsAmt: '480.00',
          currency: 'CURRENCY_USD',
          profitNative: '-40.00',
          profitRsd: '-4400.00',
          taxAmountRsd: '0',
          taxed: false,
          accountId: 'acct-usd',
        },
      ],
    }
    cy.intercept('GET', '/api/v1/tax/realized*', { statusCode: 200, body: realized }).as('realized')

    visitWithAuth(`/portal/porez/${CLIENT_ID}?kind=USER_KIND_CLIENT`, SUPERVISOR_PERMS)

    cy.get('[data-cy="standings-unpaid"]').should('contain', '598,44')
    cy.get('[data-cy="standings-paid-ytd"]').should('contain', '0,00')

    cy.wait('@realized')
    cy.get('[data-cy="pnl-row-pnl-1"]').parents('tr').find('[data-cy="cell-tax"]').should('contain', '1.650,00')
    // Loss row collapses tax to 0,00 regardless of what taxAmountRsd carries.
    cy.get('[data-cy="pnl-row-pnl-2"]').parents('tr').find('[data-cy="cell-tax"]').should('contain', '0,00')
  })

  it('non-supervisor agent cannot reach /portal/porez', () => {
    const AGENT_PERMS = ['actuary', 'actuary.agent']
    commonAuth(AGENT_PERMS, 'a')
    visitWithAuth('/portal/porez', AGENT_PERMS, 'a')
    cy.location('pathname').should('eq', '/portal')
  })
})
