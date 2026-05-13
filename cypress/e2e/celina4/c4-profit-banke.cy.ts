/// <reference types="cypress" />

export {}

// Scenarios 47-50 of spec/c4-tests.pdf — Portal "Profit Banke".
// The PDF re-labels scenario 49 as "Scenario 40" (a typo in the
// source — see c4-tests.pdf line 302); we keep the bank-positions
// list as S49a and the bank-invest action as S49b.

const ADMIN_EMAIL = 'admin@banka.local'
const ADMIN_PASSWORD = 'Admin123!'
const SUP_EMAIL = 'supervizor@banka.local'
const SUP_PASSWORD = 'Supervizor123!'
const AGENT_EMAIL = 'aktuar@banka.local'
const AGENT_PASSWORD = 'Aktuar123!'

const FOREX_BOOK_OWNER_ID = '00000000-0000-0000-0000-000000000020'
const BANK_AS_CLIENT_OWNER_ID = '00000000-0000-0000-0000-000000000030'

function gatewayLogin(email: string, password: string): Cypress.Chainable<string> {
  return cy
    .request('POST', '/api/v1/auth/login', { email, password })
    .then((r) => r.body.accessToken as string)
}

function loginViaUi(email: string, password: string): void {
  cy.visit('/login')
  cy.findByLabelText('Email', { timeout: 30000 }).clear().type(email)
  cy.findByLabelText('Lozinka').clear().type(password)
  cy.findByRole('button', { name: /Prijavi se/ }).click()
  cy.url({ timeout: 10000 }).should('not.include', '/login')
}

function clearAuth(): void {
  cy.clearCookies()
  cy.window().then((w) => {
    w.sessionStorage.clear()
    w.localStorage.clear()
  })
}

function findRsdAccount(token: string, ownerClientId: string, kind?: string) {
  let url = `/api/v1/accounts?ownerClientId=${ownerClientId}`
  if (kind) url += `&kind=${kind}`
  return cy.request({ url, headers: { Authorization: `Bearer ${token}` } }).then((r) => {
    const accs = (r.body.accounts ?? []) as Array<{ id?: string; currency?: string; kind?: string }>
    const rsd = accs.find((a) => a.currency === 'CURRENCY_RSD' && (kind ? a.kind === kind : true))
    if (!rsd?.id) throw new Error(`no RSD account for ${ownerClientId} (kind=${kind ?? 'any'})`)
    return rsd.id
  })
}

function requestVerification(token: string, kind: string) {
  return cy
    .request({
      method: 'POST',
      url: '/api/v1/verification/request',
      headers: { Authorization: `Bearer ${token}` },
      body: { actionKind: kind },
    })
    .then((r) => ({ id: r.body.verificationId as string, code: r.body.code as string }))
}

function createFund(supTok: string, name: string, min: number) {
  return cy
    .request({
      method: 'POST',
      url: '/api/v1/funds',
      headers: { Authorization: `Bearer ${supTok}`, 'Idempotency-Key': crypto.randomUUID() },
      body: { name, description: name, minimumContribution: String(min) },
    })
    // CreateFund returns the Fund proto directly (no wrapper).
    .then((r) => r.body.id as string)
}

function investFund(
  token: string,
  fundId: string,
  amount: string,
  sourceAccountId: string,
  opts: { onBehalfBank?: boolean } = {},
) {
  return requestVerification(token, 'fund_invest').then((v) =>
    cy.request({
      method: 'POST',
      url: `/api/v1/funds/${fundId}/invest`,
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Verification-Id': v.id,
        'X-Verification-Code': v.code,
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: {
        amount,
        sourceAccountId,
        onBehalfClientId: opts.onBehalfBank ? BANK_AS_CLIENT_OWNER_ID : undefined,
      },
    }),
  )
}

describe('Celina 4 — Portal Profit Banke (S47-S50)', () => {
  before(() => {
    cy.resetBackend()
    // Create one fund + bank invests so the bank-positions page has a
    // row. The actuary-profit page reads realized_gains; without a
    // realized fill the list is empty but the route still renders.
    gatewayLogin(SUP_EMAIL, SUP_PASSWORD).then((supTok) =>
      createFund(supTok, 'Alpha Fond', 1000).then((fundId) => {
        gatewayLogin(ADMIN_EMAIL, ADMIN_PASSWORD).then((adminTok) =>
          findRsdAccount(adminTok, FOREX_BOOK_OWNER_ID, 'ACCOUNT_KIND_FOREX_BOOK').then((bankRsdId) =>
            investFund(supTok, fundId, '30000', bankRsdId, { onBehalfBank: true }),
          ),
        )
      }),
    )
  })

  it('S47 — supervizor sa bank.profit.read vidi spisak aktuara sa ime/prezime/profit u RSD', () => {
    clearAuth()
    loginViaUi(SUP_EMAIL, SUP_PASSWORD)
    cy.visit('/portal/profit-banke/aktuari')
    cy.contains('h1', 'Profit banke — aktuari', { timeout: 15000 }).should('be.visible')
    // The page renders the table even when empty (seed has no realized
    // sells by actuaries on cold start); the FE shows "Nema podataka."
    // or one or more rows depending on prior tests. We just confirm
    // the header + table shell.
    cy.contains('Ime i prezime').should('be.visible')
    cy.contains('Profit (RSD)').should('be.visible')
  })

  it('S48 — agent (bez bank.profit.read) ne pristupa portalu Profit Banke', () => {
    clearAuth()
    loginViaUi(AGENT_EMAIL, AGENT_PASSWORD)
    cy.visit('/portal/profit-banke/aktuari')
    cy.url({ timeout: 10000 }).should('not.include', '/profit-banke')
  })

  it('S49a (PDF "S40") — supervizor vidi pozicije banke u fondovima sa udeo + profit', () => {
    clearAuth()
    loginViaUi(SUP_EMAIL, SUP_PASSWORD)
    cy.visit('/portal/profit-banke/fondovi')
    cy.contains('h1', 'Profit banke — pozicije u fondovima', { timeout: 15000 }).should('be.visible')
    cy.contains('Alpha Fond', { timeout: 15000 }).should('be.visible')
    // Manager column shows the supervizor's display name (seed-planted
    // "Supervizor Test" or similar).
    cy.contains('Udeo (%)').should('be.visible')
    cy.contains('Profit (RSD)').should('be.visible')
  })

  it('S49b — supervizor uplaćuje u fond u ime banke iz Profit Banke stranice (bez provizije)', () => {
    clearAuth()
    loginViaUi(SUP_EMAIL, SUP_PASSWORD)
    cy.visit('/portal/profit-banke/fondovi')
    cy.contains('Alpha Fond', { timeout: 15000 }).should('be.visible')
    cy.get('[data-cy^="bank-fund-invest-"]', { timeout: 15000 }).first().click()
    cy.contains('Uplata u fond (u ime banke)', { timeout: 10000 }).should('be.visible')
    cy.get('[data-cy="fund-invest-source"]', { timeout: 15000 }).should('not.be.disabled')
    cy.get('[data-cy="fund-invest-amount"]').type('10000')
    cy.get('[data-cy="fund-invest-confirm"]').click()
    cy.get('[aria-label="verifikacioni-kod"]', { timeout: 10000 })
      .invoke('text')
      .then((code) => {
        cy.get('#verif-code').type(code.trim())
        cy.contains('button', 'Potvrdi').click()
      })
    // Dialog closes on success.
    cy.contains('Uplata u fond (u ime banke)').should('not.exist')
  })

  it('S50 — supervizor povlači novac iz fonda u ime banke (bez provizije)', () => {
    clearAuth()
    loginViaUi(SUP_EMAIL, SUP_PASSWORD)
    cy.visit('/portal/profit-banke/fondovi')
    cy.contains('Alpha Fond', { timeout: 15000 }).should('be.visible')
    cy.get('[data-cy^="bank-fund-withdraw-"]', { timeout: 15000 }).first().click()
    cy.contains('Povlačenje iz fonda (u ime banke)', { timeout: 10000 }).should('be.visible')
    cy.get('[data-cy="fund-withdraw-dest"]', { timeout: 15000 }).should('not.be.disabled')
    cy.get('[data-cy="fund-withdraw-amount"]').type('5000')
    cy.get('[data-cy="fund-withdraw-confirm"]').click()
    cy.get('[aria-label="verifikacioni-kod"]', { timeout: 10000 })
      .invoke('text')
      .then((code) => {
        cy.get('#verif-code').type(code.trim())
        cy.contains('button', 'Potvrdi').click()
      })
    cy.contains('Povlačenje iz fonda (u ime banke)').should('not.exist')
  })
})
