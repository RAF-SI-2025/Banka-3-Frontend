/// <reference types="cypress" />

// FE-14: exchange catalog admin (spec p.39 testing toggle).
//   - admin sees the exchanges table
//   - "Forsiraj zatvoreno" flips the badge to "Forsiran zatvoren"
//   - "Vrati na raspored" clears the override badge
//   - non-admin (supervisor) cannot reach /portal/berze

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

const ADMIN_PERMS = ['admin']

const NASDAQ = {
  mic: 'XNAS',
  name: 'Nasdaq Stock Market',
  acronym: 'NASDAQ',
  polity: 'US',
  currency: 'CURRENCY_USD',
  timezone: 'America/New_York',
  openLocal: '09:30',
  closeLocal: '16:00',
  isOpen: true,
  isAfterHours: false,
  updatedAt: '2026-05-09T10:00:00Z',
}

const NYSE = {
  mic: 'XNYS',
  name: 'New York Stock Exchange',
  acronym: 'NYSE',
  polity: 'US',
  currency: 'CURRENCY_USD',
  timezone: 'America/New_York',
  openLocal: '09:30',
  closeLocal: '16:00',
  isOpen: false,
  isAfterHours: false,
  updatedAt: '2026-05-09T10:00:00Z',
}

describe('Celina 3 — portal berze (admin)', () => {
  beforeEach(() => {
    commonAuth(ADMIN_PERMS)
  })

  it('lists exchanges and reflects override flips', () => {
    let exchanges: Array<Record<string, unknown>> = [
      { ...NASDAQ },
      { ...NYSE },
    ]
    cy.intercept('GET', '/api/v1/exchanges', (req) => {
      req.reply({ statusCode: 200, body: { exchanges } })
    })
    cy.intercept('PATCH', '/api/v1/exchanges/XNAS/override', (req) => {
      const idx = exchanges.findIndex((e) => e.mic === 'XNAS')
      const updated = { ...exchanges[idx] }
      if (req.body.clear) {
        delete updated.overrideOpen
      } else {
        updated.overrideOpen = !!req.body.open
      }
      exchanges = exchanges.map((e, i) => (i === idx ? updated : e))
      req.reply({ statusCode: 200, body: updated })
    }).as('patchOverride')

    visitWithAuth('/portal/berze', ADMIN_PERMS)
    cy.contains('h1', 'Berze').should('be.visible')

    cy.get('[data-cy="exchange-row-XNAS"]').should('be.visible')
    cy.get('[data-cy="exchange-status-XNAS"]').should('contain', 'Otvorena')
    cy.get('[data-cy="exchange-status-XNYS"]').should('contain', 'Zatvorena')

    // Force closed
    cy.get('[data-cy="force-closed-XNAS"]').click()
    cy.wait('@patchOverride').its('request.body').should('deep.equal', { open: false })
    cy.get('[data-cy="exchange-status-XNAS"]').should('contain', 'Forsiran zatvoren')

    // Clear back to schedule
    cy.get('[data-cy="clear-override-XNAS"]').click()
    cy.wait('@patchOverride').its('request.body').should('deep.equal', { clear: true })
    cy.get('[data-cy="exchange-status-XNAS"]').should('contain', 'Otvorena')
  })

  it('non-admin supervisor cannot reach /portal/berze', () => {
    const SUPERVISOR_PERMS = ['actuary', 'actuary.supervisor']
    commonAuth(SUPERVISOR_PERMS)
    visitWithAuth('/portal/berze', SUPERVISOR_PERMS)
    cy.location('pathname').should('eq', '/portal')
  })
})
