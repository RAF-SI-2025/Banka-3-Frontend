/// <reference types="cypress" />

// Banka2025-E2E.pdf, "Feature: Firme i ovlašćena lica":
//   - admin / agent kreira firmu (naziv, MB, PIB, šifra delatnosti,
//     adresa, vlasnik) → preusmerava na /portal/companies
//   - na detalju firme dodaje ovlašćeno lice → tabela se ažurira

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

function bootstrap() {
  cy.intercept('POST', '/api/v1/auth/refresh', {
    statusCode: 200,
    body: { accessToken: fakeAdminToken(), accessExpiresIn: 900 },
  })
  cy.intercept('GET', '/api/v1/auth/me', {
    statusCode: 200,
    body: { employee: { id: 'admin-1', email: 'admin@banka.local', permissions: ADMIN_PERMS } },
  })
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
}

describe('Celina 2 — firme i ovlašćena lica', () => {
  beforeEach(bootstrap)

  it('admin kreira novu firmu', () => {
    cy.intercept('GET', '/api/v1/clients*', {
      statusCode: 200,
      body: {
        clients: [
          { id: 'cli-1', firstName: 'Pera', lastName: 'Perić', email: 'pera@e.com' },
        ],
      },
    }).as('clients')
    cy.intercept('GET', '/api/v1/companies*', {
      statusCode: 200,
      body: { companies: [] },
    })
    cy.intercept('POST', '/api/v1/companies', (req) => {
      expect(req.body.name).to.eq('ACME doo')
      expect(req.body.registryId).to.eq('12345678')
      expect(req.body.taxId).to.eq('123456789')
      expect(req.body.activityCode).to.eq('62.01')
      expect(req.body.address).to.eq('Knez Mihailova 1')
      expect(req.body.ownerClientId).to.eq('cli-1')
      req.reply({
        statusCode: 200,
        body: {
          id: 'co-1',
          name: req.body.name,
          registryId: req.body.registryId,
          taxId: req.body.taxId,
          activityCode: req.body.activityCode,
          address: req.body.address,
          ownerClientId: req.body.ownerClientId,
        },
      })
    }).as('create')

    cy.visit('/portal/companies/new')
    cy.wait('@clients')
    cy.get('input[name="name"]').type('ACME doo')
    cy.get('input[name="registryId"]').type('12345678')
    cy.get('input[name="taxId"]').type('123456789')
    cy.get('input[name="activityCode"]').type('62.01')
    cy.get('input[name="address"]').type('Knez Mihailova 1')
    cy.get('select[name="ownerClientId"]').select('cli-1')
    cy.findByRole('button', { name: /Kreiraj firmu/ }).click()
    cy.wait('@create')
    cy.url({ timeout: 5000 }).should('include', '/portal/companies')
    cy.url().should('not.include', '/new')
  })

  it('admin dodaje ovlašćeno lice na detalju firme', () => {
    const COMPANY = {
      id: 'co-1',
      name: 'ACME doo',
      registryId: '12345678',
      taxId: '123456789',
      activityCode: '6201',
      address: 'Knez Mihailova 1',
      ownerClientId: 'cli-1',
    }
    cy.intercept('GET', '/api/v1/companies/co-1', { statusCode: 200, body: COMPANY })

    let listCalls = 0
    cy.intercept('GET', '/api/v1/authorized-persons*', (req) => {
      listCalls++
      if (listCalls === 1) {
        req.reply({ statusCode: 200, body: { authorizedPersons: [] } })
      } else {
        req.reply({
          statusCode: 200,
          body: {
            authorizedPersons: [
              {
                id: 'ap-1',
                companyId: 'co-1',
                firstName: 'Marko',
                lastName: 'Marković',
                dateOfBirth: '1985-04-12',
                gender: 'GENDER_MALE',
                email: 'marko@e.com',
                phone: '+381641234567',
                address: 'Beograd',
              },
            ],
          },
        })
      }
    }).as('list')

    cy.intercept('POST', '/api/v1/authorized-persons', (req) => {
      expect(req.body.companyId).to.eq('co-1')
      expect(req.body.firstName).to.eq('Marko')
      expect(req.body.lastName).to.eq('Marković')
      expect(req.body.email).to.eq('marko@e.com')
      req.reply({
        statusCode: 200,
        body: { id: 'ap-1', ...req.body },
      })
    }).as('add')

    cy.visit('/portal/companies/co-1')
    cy.wait('@list')
    cy.contains('Nema ovlašćenih lica').should('be.visible')
    cy.findByRole('button', { name: /Dodaj lice/ }).click()
    cy.get('input[name="firstName"]').type('Marko')
    cy.get('input[name="lastName"]').type('Marković')
    cy.get('input[name="dateOfBirth"]').type('1985-04-12')
    cy.get('select[name="gender"]').select('GENDER_MALE')
    cy.get('input[name="email"]').type('marko@e.com')
    cy.get('input[name="phone"]').type('+381641234567')
    // Dva input[name="address"] postoje na stranici (update firme + AP
    // dialog); AP dialog se otvori posle Update forme, pa je to drugi.
    cy.get('input[name="address"]').last().type('Beograd')
    // Dva "Sačuvaj" dugmeta — update firme + AP dialog. Uzimamo zadnje.
    cy.findAllByRole('button', { name: /^Sačuvaj$/ }).last().click()
    cy.wait('@add')
    cy.contains('Marko Marković').should('be.visible')
    cy.contains('marko@e.com').should('be.visible')
  })
})
