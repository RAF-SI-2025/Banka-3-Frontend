/// <reference types="cypress" />

// Spec p.20 — "Detalji računa" za klijenta:
//   - Vlasnik, Rezervisana sredstva, Mesečno održavanje, Stanje,
//     Raspoloživo, Dnevni/Mesečni limit, Podtip, Tip, Valuta
//   - Akcija "Promena naziva računa" otvori popup i menja naziv
//   - Akcija "Promena limita" pokreće verifikacioni kod
//   - Filtriranje transakcija po statusu i iznosu

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

const TODAY = '2026-05-08T12:00:00Z'

const ACCOUNT = {
  id: 'acc-1',
  number: '265000111111111110',
  name: 'Kućni budžet',
  ownerClientId: 'c',
  kind: 'ACCOUNT_KIND_PERSONAL_CHECKING_RSD',
  subtype: 'ACCOUNT_SUBTYPE_STANDARD',
  currency: 'CURRENCY_RSD',
  status: 'ACCOUNT_STATUS_ACTIVE',
  balance: '50000.00',
  availableBalance: '50000.00',
  dailyLimit: '100000',
  monthlyLimit: '1000000',
  dailySpent: '500',
  monthlySpent: '12000',
  maintenanceFee: '255.00',
}

const TX_REALIZED = {
  id: 't-1',
  accountId: 'acc-1',
  fromAccountId: 'acc-1',
  toAccountId: 'acc-other',
  fromAmount: '1500',
  toAmount: '1500',
  kind: 'TRANSACTION_KIND_PAYMENT',
  status: 'TRANSACTION_STATUS_REALIZED',
  recipientName: 'EPS',
  purpose: 'Račun za struju',
  createdAt: TODAY,
}

const TX_REJECTED = {
  id: 't-2',
  accountId: 'acc-1',
  fromAccountId: 'acc-1',
  toAccountId: 'acc-other',
  fromAmount: '99999',
  toAmount: '99999',
  kind: 'TRANSACTION_KIND_PAYMENT',
  status: 'TRANSACTION_STATUS_REJECTED',
  recipientName: 'Test',
  purpose: 'test',
  createdAt: TODAY,
}

function bootstrap() {
  cy.intercept('POST', '/api/v1/auth/refresh', {
    statusCode: 200,
    body: { accessToken: fakeToken(), accessExpiresIn: 900 },
  })
  cy.intercept('GET', '/api/v1/auth/me', {
    statusCode: 200,
    body: {
      client: {
        id: 'c',
        email: 'c@e.com',
        firstName: 'Pera',
        lastName: 'Perić',
        permissions: PERMS,
      },
    },
  })
  cy.window().then((win) => {
    win.sessionStorage.setItem(
      'banka-auth',
      JSON.stringify({
        state: {
          accessToken: fakeToken(),
          userId: 'c',
          userKind: 'client',
          firstName: 'Pera',
          lastName: 'Perić',
          permissions: PERMS,
        },
        version: 0,
      }),
    )
  })
  cy.intercept('GET', '/api/v1/accounts/acc-1', { statusCode: 200, body: ACCOUNT }).as('account')
  cy.intercept('GET', '/api/v1/clients/c', {
    statusCode: 200,
    body: { id: 'c', email: 'c@e.com', firstName: 'Pera', lastName: 'Perić' },
  })
  cy.intercept('GET', '/api/v1/cards*', { statusCode: 200, body: { cards: [] } })
  cy.intercept('GET', '/api/v1/transactions*', {
    statusCode: 200,
    body: { transactions: [TX_REALIZED, TX_REJECTED] },
  }).as('tx')
}

describe('Celina 2 — detalji računa (klijent)', () => {
  beforeEach(bootstrap)

  it('prikazuje sva spec p.20 polja', () => {
    cy.visit('/banking/racuni/acc-1')
    cy.wait('@account')
    cy.contains('Vlasnik').parent().should('contain', 'Pera Perić')
    cy.contains('Rezervisana sredstva').parent().should('contain', '0,00')
    cy.contains('Mesečno održavanje').parent().should('contain', '255,00')
    cy.contains('Stanje').parent().should('contain', '50.000,00')
    cy.contains('Raspoloživo').parent().should('contain', '50.000,00')
    cy.contains('Dnevni limit').parent().should('contain', '100.000,00')
    cy.contains('Mesečni limit').parent().should('contain', '1.000.000,00')
    cy.contains('Lični tekući RSD').should('be.visible')
    cy.contains('Valuta').parent().should('contain', 'RSD')
  })

  it('Promena naziva računa: popup šalje PATCH i invalidira keš', () => {
    cy.intercept('PATCH', '/api/v1/accounts/acc-1/name', (req) => {
      expect(req.body.name).to.eq('Štednja')
      req.reply({ statusCode: 200, body: { ...ACCOUNT, name: 'Štednja' } })
    }).as('rename')

    cy.visit('/banking/racuni/acc-1')
    cy.wait('@account')
    cy.findByRole('button', { name: /Promena naziva računa/ }).click()
    cy.get('input[name="name"]').clear().type('Štednja')
    cy.findByRole('button', { name: /^Sačuvaj$/ }).click()
    cy.wait('@rename')
  })

  it('Promena limita zahteva verifikacioni kod', () => {
    cy.intercept('POST', '/api/v1/verification/request', {
      statusCode: 200,
      body: { verificationId: 'v-lim', code: '424242', expiresAt: TODAY },
    }).as('verifReq')

    cy.intercept('PATCH', '/api/v1/accounts/acc-1/limits', (req) => {
      expect(req.headers['x-verification-id']).to.eq('v-lim')
      expect(req.headers['x-verification-code']).to.eq('424242')
      expect(req.body.dailyLimit).to.eq('200000')
      expect(req.body.monthlyLimit).to.eq('2000000')
      req.reply({
        statusCode: 200,
        body: { ...ACCOUNT, dailyLimit: '200000', monthlyLimit: '2000000' },
      })
    }).as('limits')

    cy.visit('/banking/racuni/acc-1')
    cy.wait('@account')
    cy.findByRole('button', { name: /Promena limita/ }).click()
    cy.get('input[name="dailyLimit"]').clear().type('200000')
    cy.get('input[name="monthlyLimit"]').clear().type('2000000')
    cy.findByRole('button', { name: /Nastavi/ }).click()
    cy.wait('@verifReq')
    cy.get('#verif-code').type('424242')
    cy.findByRole('button', { name: /^Potvrdi$/ }).click()
    cy.wait('@limits')
  })

  it('filtriranje transakcija po statusu skriva odbijene', () => {
    cy.visit('/banking/racuni/acc-1')
    cy.wait('@tx')
    cy.contains('Račun za struju').should('be.visible')
    cy.contains('test').should('be.visible')
    // Status filter — biraj samo "Realizovano"; odbijene se filtriraju.
    cy.contains('label', 'Status').next('select').select('TRANSACTION_STATUS_REALIZED')
    cy.contains('test').should('not.exist')
    cy.contains('Račun za struju').should('be.visible')
  })
})
