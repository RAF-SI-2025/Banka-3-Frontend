/// <reference types="cypress" />

// Banka2025-E2E.pdf, "Feature: Krediti — klijent":
//   - klijent popunjava formu za zahtev za kredit (tip, iznos, broj rata,
//     status zaposlenja, plata, telefon, svrha)
//   - posle slanja redirekcije na /banking/krediti
//
// Pratimo isti obrazac kao portal-loan-request: stub auth + accounts +
// POST /loan-requests; provera payload-a teče u intercept handler-u.

const PERMS = [
  'client.read',
  'account.read',
  'card.read',
  'card.write',
  'payment.write',
  'loan.read',
  'loan.write',
]

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

describe('Celina 2 — zahtev za kredit (klijent)', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/v1/auth/refresh', {
      statusCode: 200,
      body: { accessToken: fakeToken(), accessExpiresIn: 900 },
    })
    cy.intercept('GET', '/api/v1/auth/me', {
      statusCode: 200,
      body: { client: { id: 'c', email: 'c@e.com', permissions: PERMS } },
    })
    cy.window().then((win) => {
      win.sessionStorage.setItem(
        'banka-auth',
        JSON.stringify({
          state: {
            accessToken: fakeToken(),
            userId: 'c',
            userKind: 'client',
            permissions: PERMS,
          },
          version: 0,
        }),
      )
    })

    cy.intercept('GET', '/api/v1/accounts*', {
      statusCode: 200,
      body: {
        accounts: [
          {
            id: 'acc-rsd',
            number: '265000111111111110',
            name: 'Tekući RSD',
            ownerClientId: 'c',
            kind: 'ACCOUNT_KIND_PERSONAL_CHECKING_RSD',
            subtype: 'ACCOUNT_SUBTYPE_STANDARD',
            currency: 'CURRENCY_RSD',
            status: 'ACCOUNT_STATUS_ACTIVE',
            balance: '50000.00',
            availableBalance: '50000.00',
          },
        ],
      },
    }).as('accounts')

    cy.intercept('GET', '/api/v1/loan-requests*', {
      statusCode: 200,
      body: { requests: [] },
    }).as('listReq')
    cy.intercept('GET', '/api/v1/loans*', {
      statusCode: 200,
      body: { loans: [] },
    }).as('listLoans')
  })

  it('klijent šalje zahtev za gotovinski kredit', () => {
    cy.intercept('POST', '/api/v1/loan-requests', (req) => {
      expect(req.body.accountId).to.eq('acc-rsd')
      expect(req.body.loanType).to.eq('LOAN_TYPE_CASH')
      expect(req.body.interestType).to.eq('INTEREST_TYPE_FIXED')
      expect(req.body.amount).to.eq('500000')
      expect(req.body.installmentsTotal).to.eq(36)
      expect(req.body.monthlySalary).to.eq('120000')
      expect(req.body.employmentStatus).to.eq('EMPLOYMENT_STATUS_PERMANENT')
      expect(req.body.contactPhone).to.contain('641234567')
      expect(req.body.purpose).to.contain('automobil')
      req.reply({
        statusCode: 200,
        body: {
          id: 'req-new',
          ...req.body,
          status: 'LOAN_REQUEST_STATUS_PENDING',
          createdAt: '2026-05-09T10:00:00Z',
        },
      })
    }).as('submit')

    cy.visit('/banking/krediti/novi')
    cy.get('select[name="accountId"]').select('acc-rsd')
    cy.get('select[name="loanType"]').select('LOAN_TYPE_CASH')
    cy.get('select[name="interestType"]').select('INTEREST_TYPE_FIXED')
    cy.get('input[name="amount"]').type('500000')
    cy.get('select[name="installmentsTotal"]').select('36')
    cy.get('select[name="employmentStatus"]').select('EMPLOYMENT_STATUS_PERMANENT')
    cy.get('input[name="monthlySalary"]').type('120000')
    cy.get('input[name="employmentDurationMonths"]').clear().type('48')
    cy.get('input[name="contactPhone"]').type('+381641234567')
    cy.get('input[name="purpose"]').type('Kupovina automobila')
    cy.findByRole('button', { name: /Pošalji zahtev/ }).click()
    cy.wait('@submit')
    cy.url({ timeout: 5000 }).should('include', '/banking/krediti')
    cy.url().should('not.include', '/novi')
  })

  it('forma sakriva platu kada je status nezaposlen i šalje "0"', () => {
    cy.intercept('POST', '/api/v1/loan-requests', (req) => {
      // Spec p.22: nezaposleni može tražiti kredit; plata se šalje kao 0.
      expect(req.body.employmentStatus).to.eq('EMPLOYMENT_STATUS_UNEMPLOYED')
      expect(req.body.monthlySalary).to.eq('0')
      req.reply({
        statusCode: 200,
        body: { id: 'req-2', ...req.body, status: 'LOAN_REQUEST_STATUS_PENDING' },
      })
    }).as('submit')

    cy.visit('/banking/krediti/novi')
    cy.get('select[name="accountId"]').select('acc-rsd')
    cy.get('input[name="amount"]').type('100000')
    cy.get('select[name="employmentStatus"]').select('EMPLOYMENT_STATUS_UNEMPLOYED')
    cy.get('input[name="monthlySalary"]').should('not.exist')
    cy.get('input[name="employmentDurationMonths"]').clear().type('0')
    cy.get('input[name="contactPhone"]').type('+381641234567')
    cy.get('input[name="purpose"]').type('Refinansiranje')
    cy.findByRole('button', { name: /Pošalji zahtev/ }).click()
    cy.wait('@submit')
    cy.url({ timeout: 5000 }).should('include', '/banking/krediti')
  })
})
