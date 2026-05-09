/// <reference types="cypress" />

// FE-12: actuary management portal.
//   - supervisor edits an agent's daily limit and the table row reflects it
//   - reset-used button zeroes used_limit
//   - need-approval toggle flips on the row

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
const AGENT_ID = 'agent-1'

const SUPERVISOR_ROW = {
  employeeId: 's',
  type: 'ACTUARY_TYPE_SUPERVISOR',
  dailyLimit: '0',
  usedLimit: '0',
  needApproval: false,
}

const AGENT_INITIAL = {
  employeeId: AGENT_ID,
  type: 'ACTUARY_TYPE_AGENT',
  dailyLimit: '500000.00',
  usedLimit: '120000.00',
  needApproval: false,
}

function employeeFixture(id: string, overrides: Partial<{ firstName: string; lastName: string; email: string; position: string }> = {}) {
  return {
    id,
    email: overrides.email ?? `${id}@banka.local`,
    username: id,
    firstName: overrides.firstName ?? 'Marko',
    lastName: overrides.lastName ?? 'Marković',
    dateOfBirth: '1990-01-01',
    gender: 'GENDER_MALE',
    phone: '+38160000000',
    address: 'Beograd',
    position: overrides.position ?? 'Aktuar',
    department: 'Trgovina',
    active: true,
    activated: true,
    permissions: ['actuary', 'actuary.agent'],
  }
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

describe('Celina 3 — portal aktuari (supervisor)', () => {
  beforeEach(() => {
    commonAuth(SUPERVISOR_PERMS)
    cy.intercept('GET', `/api/v1/employees/${AGENT_ID}`, {
      statusCode: 200,
      body: employeeFixture(AGENT_ID, { firstName: 'Petar', lastName: 'Petrović', position: 'Aktuar (agent)' }),
    })
    cy.intercept('GET', '/api/v1/employees/s', {
      statusCode: 200,
      body: employeeFixture('s', { firstName: 'Sara', lastName: 'Supervizor', position: 'Supervizor', email: 's@banka.local' }),
    })
  })

  it('list shows agent row with limits', () => {
    cy.intercept('GET', '/api/v1/actuaries*', {
      statusCode: 200,
      body: { actuaries: [SUPERVISOR_ROW, AGENT_INITIAL], total: '2' },
    })

    visitWithAuth('/portal/aktuari', SUPERVISOR_PERMS)
    cy.contains('h1', 'Aktuari').should('be.visible')
    cy.get(`[data-cy="actuary-row-${AGENT_ID}"]`)
      .should('be.visible')
      .parents('tr')
      .as('row')
    cy.get('@row').find('[data-cy="cell-daily-limit"]').should('contain', '500.000,00')
    cy.get('@row').find('[data-cy="cell-used-limit"]').should('contain', '120.000,00')
  })

  it('supervisor edits limit, resets used, and toggles need_approval', () => {
    // Mutate the response on each subsequent GET so the page reflects
    // the supervisor's edits as if the backend recorded them.
    let current = { ...AGENT_INITIAL }
    cy.intercept('GET', '/api/v1/actuaries?*', (req) => {
      req.reply({ statusCode: 200, body: { actuaries: [SUPERVISOR_ROW, current], total: '2' } })
    })
    cy.intercept('GET', `/api/v1/actuaries/${AGENT_ID}`, (req) => {
      req.reply({ statusCode: 200, body: current })
    })

    cy.intercept('PATCH', `/api/v1/actuaries/${AGENT_ID}/limit`, (req) => {
      current = { ...current, dailyLimit: String(req.body.dailyLimit) }
      req.reply({ statusCode: 200, body: current })
    }).as('patchLimit')
    cy.intercept('POST', `/api/v1/actuaries/${AGENT_ID}/used-limit/reset`, (req) => {
      current = { ...current, usedLimit: '0' }
      req.reply({ statusCode: 200, body: current })
    }).as('resetUsed')
    cy.intercept('PATCH', `/api/v1/actuaries/${AGENT_ID}/need-approval`, (req) => {
      current = { ...current, needApproval: !!req.body.needApproval }
      req.reply({ statusCode: 200, body: current })
    }).as('patchApproval')

    visitWithAuth(`/portal/aktuari/${AGENT_ID}`, SUPERVISOR_PERMS)

    cy.get('[data-cy="daily-limit-input"]').should('have.value', '500000.00')
    cy.get('[data-cy="daily-limit-input"]').clear().type('750000')
    cy.get('[data-cy="save-limit"]').click()
    cy.wait('@patchLimit').its('request.body.dailyLimit').should('eq', '750000')

    cy.get('[data-cy="reset-used"]').click()
    cy.get('[data-cy="confirm-reset"]').click()
    cy.wait('@resetUsed')
    cy.get('[data-cy="used-limit-display"]').should('contain', '0,00')

    cy.get('[data-cy="need-approval-toggle"]').check()
    cy.wait('@patchApproval').its('request.body.needApproval').should('eq', true)
    cy.get('[data-cy="need-approval-toggle"]').should('be.checked')
  })

  it('non-supervisor agent cannot reach /portal/aktuari', () => {
    const AGENT_PERMS = ['actuary', 'actuary.agent']
    commonAuth(AGENT_PERMS, 'a')
    visitWithAuth('/portal/aktuari', AGENT_PERMS, 'a')
    cy.location('pathname').should('eq', '/portal')
  })
})
