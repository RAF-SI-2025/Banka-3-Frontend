/// <reference types="cypress" />

// Canned OTC FE flow. Drives /banking/otc → CreateOTCOfferDialog,
// /banking/otc/ponude → thread modal (accept gated by verification),
// /banking/otc/ugovori → exercise gated by verification.

const PERMS = ['trading.client', 'otc.read', 'otc.trade.client']

function fakeToken(): string {
  const payload = btoa(
    JSON.stringify({ sub: 'c', kind: 'client', perms: PERMS, sv: 1, exp: Math.floor(Date.now() / 1000) + 900 }),
  )
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.dummy`
}

const TODAY = '2026-05-12T12:00:00Z'

const SELLER_ITEM = {
  holdingId: 'h-seller-1',
  sellerId: 'seller-1',
  sellerKind: 'USER_KIND_CLIENT',
  sellerAccountId: 'acc-seller',
  sellerDisplayName: 'Petar Petrović',
  security: {
    id: 'sec-aapl',
    ticker: 'AAPL',
    name: 'Apple Inc.',
    type: 'SECURITY_TYPE_STOCK',
    currency: 'CURRENCY_USD',
  },
  availableCount: 50,
  publicCount: 50,
  reservedCount: 0,
  currentPrice: '180.00',
  currency: 'CURRENCY_USD',
}

const ACCOUNTS = {
  accounts: [
    {
      id: 'acc-buyer',
      number: '265000122222222220',
      name: 'USD',
      ownerClientId: 'c',
      kind: 'ACCOUNT_KIND_PERSONAL_FX',
      subtype: 'ACCOUNT_SUBTYPE_UNSPECIFIED',
      currency: 'CURRENCY_USD',
      status: 'ACCOUNT_STATUS_ACTIVE',
      balance: '10000.00',
      availableBalance: '10000.00',
    },
  ],
}

function authBeforeEach() {
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
        state: { accessToken: fakeToken(), userId: 'c', userKind: 'client', permissions: PERMS },
        version: 0,
      }),
    )
  })
}

describe('Celina 4 — OTC FE (canned)', () => {
  it('discovery → Napravi ponudu → submits CreateOTCOffer', () => {
    authBeforeEach()
    cy.intercept('GET', '/api/v1/otc/discovery*', { statusCode: 200, body: { items: [SELLER_ITEM] } })
    cy.intercept('GET', '/api/v1/accounts*', { statusCode: 200, body: ACCOUNTS })

    cy.intercept('POST', '/api/v1/otc/offers', (req) => {
      expect(req.body).to.include({
        sellerHoldingId: 'h-seller-1',
        buyerAccountId: 'acc-buyer',
        sellerAccountId: 'acc-seller',
        quantity: 10,
      })
      req.reply({ statusCode: 200, body: { id: 'o-1', threadId: 't-1' } })
    }).as('createOffer')

    cy.visit('/banking/otc', { onBeforeLoad: authBeforeEach })
    cy.contains('h1', 'OTC trgovina', { timeout: 15000 }).should('be.visible')
    cy.get('[data-cy="otc-make-offer-h-seller-1"]').click()
    cy.contains('Napravi ponudu — AAPL').should('be.visible')
    cy.get('[data-cy="otc-buyer-account"]').select('acc-buyer')
    cy.get('[data-cy="otc-qty"]').clear().type('10')
    cy.get('[data-cy="otc-ppu"]').clear().type('182.00')
    cy.get('[data-cy="otc-premium"]').clear().type('25.00')
    cy.get('[data-cy="otc-settlement"]').type('2026-12-31')
    cy.get('[data-cy="otc-create-offer-submit"]').click()
    cy.wait('@createOffer')
  })

  it('Aktivne ponude — accept opens verification → POST /accept fires with proof headers', () => {
    authBeforeEach()
    const offer = {
      id: 'o-1',
      threadId: 't-1',
      securityId: 'sec-aapl',
      securityTicker: 'AAPL',
      buyerId: 'c',
      buyerKind: 'USER_KIND_CLIENT',
      sellerId: 'seller-1',
      sellerKind: 'USER_KIND_CLIENT',
      quantity: 10,
      pricePerUnit: '182.00',
      premium: '25.00',
      currency: 'CURRENCY_USD',
      settlementDate: '2026-12-31',
      modifiedBy: 'seller-1',
      status: 'OTC_STATUS_OPEN',
    }
    cy.intercept('GET', '/api/v1/otc/offers*', { statusCode: 200, body: { threads: [offer] } })
    cy.intercept('GET', '/api/v1/otc/offers/t-1', {
      statusCode: 200,
      body: { iterations: [offer] },
    })
    cy.intercept('GET', '/api/v1/securities/sec-aapl', {
      statusCode: 200,
      body: { security: SELLER_ITEM.security, listing: { id: 'l-1', price: '180.00' } },
    })
    cy.intercept('POST', '/api/v1/verification/request', (req) => {
      expect(req.body.actionKind).to.eq('otc_accept')
      req.reply({ statusCode: 200, body: { verificationId: 'v-1', code: '424242', expiresAt: TODAY, delivery: 'inline' } })
    })
    cy.intercept('POST', '/api/v1/otc/offers/t-1/accept', (req) => {
      expect(req.headers['x-verification-id']).to.eq('v-1')
      expect(req.headers['x-verification-code']).to.eq('424242')
      req.reply({ statusCode: 200, body: { contract: { id: 'c-1' }, premiumOpId: 'op-1' } })
    }).as('acceptOTC')

    cy.visit('/banking/otc/ponude', { onBeforeLoad: authBeforeEach })
    cy.contains('h1', 'Aktivne ponude', { timeout: 15000 }).should('be.visible')
    cy.get('[data-cy="otc-thread-t-1"]').click()
    cy.contains('Pregovaranje — AAPL').should('be.visible')
    cy.get('[data-cy="otc-accept"]').click()
    cy.contains('Prihvatanje OTC ponude').should('be.visible')
    cy.contains('424242').should('be.visible')
    cy.get('input[inputmode="numeric"], #verification-code, input[type="text"]').first().type('424242')
    cy.get('button').contains('Potvrdi').click({ force: true })
    cy.wait('@acceptOTC')
  })
})
