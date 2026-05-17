/// <reference types="cypress" />

// Banka2025-E2E.pdf, "Feature: Krediti":
//   - zaposleni vidi listu zahteva za kredit u statusu Pending
//   - odobrava ili odbija (sa razlogom) zahtev
//
// We bypass the UI login and let useBootstrapAuth hydrate the store
// from intercepted /auth/refresh + /auth/me. Going through the login
// form would still work, but useBootstrapAuth's first effect fires
// before the form is submitted and racily clear()s the store on a 401
// refresh — easier to just stub a successful bootstrap.

const ADMIN_PERMS = [
  'admin',
  'employee.read',
  'employee.write',
  'client.read',
  'client.write',
  'permission.grant',
  'company.read',
  'company.write',
  'account.read',
  'account.write',
  'card.read',
  'card.write',
  'loan.read',
  'loan.write',
  'payment.write',
  'exchange.write',
]

function fakeAdminToken(): string {
  const payload = btoa(
    JSON.stringify({
      sub: 'admin-1',
      kind: 'employee',
      perms: ADMIN_PERMS,
      sv: 1,
      exp: Math.floor(Date.now() / 1000) + 900,
    }),
  )
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.dummy`
}

const PENDING_REQ = {
  id: 'req-1',
  clientId: 'client-1',
  accountId: 'acc-1',
  loanType: 'LOAN_TYPE_CASH',
  interestType: 'INTEREST_TYPE_FIXED',
  amount: '500000',
  currency: 'CURRENCY_RSD',
  purpose: 'kupovina automobila',
  monthlySalary: '120000',
  employmentStatus: 'EMPLOYMENT_STATUS_PERMANENT',
  employmentDurationMonths: 36,
  installmentsTotal: 36,
  contactPhone: '+381641234567',
  status: 'LOAN_REQUEST_STATUS_PENDING',
  createdAt: '2026-05-01T10:00:00Z',
}

describe('Celina 2 — odobravanje zahteva za kredit', () => {
  beforeEach(() => {
    // Skip useBootstrapAuth's clear() path: refresh succeeds, returns
    // a JWT carrying the admin perms, then me confirms identity.
    cy.intercept('POST', '/api/v1/auth/refresh', {
      statusCode: 200,
      body: { accessToken: fakeAdminToken(), accessExpiresIn: 900 },
    })
    cy.intercept('GET', '/api/v1/auth/me', {
      statusCode: 200,
      body: { employee: { id: 'admin-1', email: 'admin@banka.local', permissions: ADMIN_PERMS } },
    })

    // Bypass beforeLoad's accessToken check by seeding the persisted
    // auth store. Zustand persists to sessionStorage under 'banka-auth';
    // when the SPA boots, the persisted state is restored synchronously
    // before any route guard runs, so beforeLoad sees the token.
    cy.window().then((win) => {
      win.sessionStorage.setItem(
        'banka-auth',
        JSON.stringify({
          state: {
            accessToken: fakeAdminToken(),
            userId: 'admin-1',
            userKind: 'employee',
            permissions: ADMIN_PERMS,
          },
          version: 0,
        }),
      )
    })
  })

  it('admin odobrava zahtev', () => {
    let listCalls = 0
    cy.intercept('GET', '/api/v1/loan-requests*', (req) => {
      listCalls++
      const status = listCalls === 1 ? 'LOAN_REQUEST_STATUS_PENDING' : 'LOAN_REQUEST_STATUS_APPROVED'
      req.reply({ statusCode: 200, body: { requests: [{ ...PENDING_REQ, status }] } })
    }).as('list')

    cy.intercept('POST', '/api/v1/loan-requests/req-1/decide', (req) => {
      expect(req.body.approve).to.eq(true)
      req.reply({
        statusCode: 200,
        body: { ...PENDING_REQ, status: 'LOAN_REQUEST_STATUS_APPROVED' },
      })
    }).as('approve')

    cy.visit('/portal/loan-requests')
    cy.url({ timeout: 5000 }).should('include', '/portal/loan-requests')
    cy.wait('@list')

    cy.contains('tr', '500.000,00').findByRole('button', { name: /Odobri/ }).click()
    cy.wait('@approve')
  })

  it('admin odbija zahtev sa razlogom', () => {
    cy.intercept('GET', '/api/v1/loan-requests*', {
      statusCode: 200,
      body: { requests: [PENDING_REQ] },
    }).as('list')

    cy.intercept('POST', '/api/v1/loan-requests/req-1/decide', (req) => {
      expect(req.body.approve).to.eq(false)
      expect(req.body.reason).to.contain('plata')
      req.reply({
        statusCode: 200,
        body: {
          ...PENDING_REQ,
          status: 'LOAN_REQUEST_STATUS_REJECTED',
          rejectionReason: req.body.reason,
        },
      })
    }).as('reject')

    cy.visit('/portal/loan-requests')
    cy.wait('@list')

    cy.contains('tr', '500.000,00').findByRole('button', { name: /Odbij/ }).click()
    // The Dialog renders a single Input for the reason — grab the
    // dialog content's last input.
    cy.get('input').last().type('Nedovoljna plata za traženi iznos')
    cy.findByRole('button', { name: /Odbij zahtev/ }).click()
    cy.wait('@reject')
  })
})
