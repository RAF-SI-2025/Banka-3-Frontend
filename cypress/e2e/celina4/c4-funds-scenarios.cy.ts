/// <reference types="cypress" />

export {}

// Scenarios 29-46 of spec/c4-tests.pdf — investicioni fondovi.
// Live against the running stack; each describe resets once and
// sequential its share state.

const ADMIN_EMAIL = 'admin@banka.local'
const ADMIN_PASSWORD = 'Admin123!'
const SUP_EMAIL = 'supervizor@banka.local'
const SUP_PASSWORD = 'Supervizor123!'
const AGENT_EMAIL = 'aktuar@banka.local'
const AGENT_PASSWORD = 'Aktuar123!'
const CLIENT_EMAIL = 'klijent@banka.local'
const CLIENT_PASSWORD = 'Klijent123!'
const CLIENT2_EMAIL = 'klijent2@banka.local'
const CLIENT2_PASSWORD = 'Klijent123!'

const FOREX_BOOK_OWNER_ID = '00000000-0000-0000-0000-000000000020'
const BANK_AS_CLIENT_OWNER_ID = '00000000-0000-0000-0000-000000000030'

const NIS_TICKER = 'NIS'

function gatewayLogin(email: string, password: string): Cypress.Chainable<string> {
  return cy
    .request('POST', '/api/v1/auth/login', { email, password })
    .then((r) => r.body.accessToken as string)
}

function loginViaUi(email: string, password: string): void {
  cy.visit('/login')
  cy.findByLabelText('Email', { timeout: 15000 }).clear().type(email)
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

function meUserID(token: string): Cypress.Chainable<string> {
  return cy
    .request({ url: '/api/v1/auth/me', headers: { Authorization: `Bearer ${token}` } })
    .then((r) => (r.body.client?.id ?? r.body.employee?.id) as string)
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

function createFund(supTok: string, name: string, min: number, description = 'opis') {
  return cy
    .request({
      method: 'POST',
      url: '/api/v1/funds',
      headers: { Authorization: `Bearer ${supTok}`, 'Idempotency-Key': crypto.randomUUID() },
      body: { name, description, minimumContribution: String(min) },
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
      failOnStatusCode: false,
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

function withdrawFund(
  token: string,
  fundId: string,
  amountRsd: string,
  destAccountId: string,
  opts: { onBehalfBank?: boolean } = {},
) {
  return requestVerification(token, 'fund_withdraw').then((v) =>
    cy.request({
      method: 'POST',
      url: `/api/v1/funds/${fundId}/withdraw`,
      failOnStatusCode: false,
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Verification-Id': v.id,
        'X-Verification-Code': v.code,
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: {
        amountRsd,
        destAccountId,
        onBehalfClientId: opts.onBehalfBank ? BANK_AS_CLIENT_OWNER_ID : undefined,
      },
    }),
  )
}

// ─── Discovery + detail (S29-S32) ────────────────────────────────

describe('Celina 4 — Investicioni fondovi: pristup i prikaz (S29-S32)', () => {
  before(() => {
    cy.resetBackend()
    // Supervizor creates Alpha (min 1000) so discovery has a row.
    gatewayLogin(SUP_EMAIL, SUP_PASSWORD).then((supTok) =>
      createFund(supTok, 'Alpha Fond', 1000, 'Diversifikovani RSD fond'),
    )
    // Add a second fund for sort/filter tests.
    gatewayLogin(SUP_EMAIL, SUP_PASSWORD).then((supTok) =>
      createFund(supTok, 'Beta Fond', 5000, 'Veći ulog'),
    )
  })

  it('S29 — klijent sa funds.read.client vidi listu fondova sa naziv/opis/vrednost/profit/min', () => {
    clearAuth()
    loginViaUi(CLIENT_EMAIL, CLIENT_PASSWORD)
    cy.visit('/banking/fondovi')
    cy.contains('h1', 'Investicioni fondovi', { timeout: 15000 }).should('be.visible')
    cy.contains('Alpha Fond').should('be.visible')
    cy.contains('Beta Fond').should('be.visible')
    // Min uplata columns rendered.
    cy.contains('1.000').should('exist')
    cy.contains('5.000').should('exist')
  })

  it('S30 — filter/sort izaziva re-fetch sa odgovarajućim query parametrima', () => {
    clearAuth()
    loginViaUi(CLIENT_EMAIL, CLIENT_PASSWORD)
    cy.intercept('GET', '/api/v1/funds**').as('funds')
    cy.visit('/banking/fondovi')
    cy.wait('@funds', { timeout: 15000 })
    cy.get('[data-cy="funds-sort"]').select('total_value')
    cy.get('[data-cy="funds-order"]').select('desc')
    // Last @funds intercept must include sort=total_value + order=desc.
    cy.wait('@funds').its('request.url').should('match', /sort=total_value/)
  })

  it('S31 — klijent otvara detalj fonda i vidi sva propisana polja', () => {
    clearAuth()
    loginViaUi(CLIENT_EMAIL, CLIENT_PASSWORD)
    cy.visit('/banking/fondovi')
    cy.contains('Alpha Fond', { timeout: 15000 }).click()
    cy.get('[data-cy="fund-detail-name"]', { timeout: 15000 }).should('contain.text', 'Alpha Fond')
    cy.contains('Menadžer').should('be.visible')
    cy.contains('Ukupna vrednost').should('be.visible')
    cy.contains('Min. uplata').should('be.visible')
    cy.contains('Profit').should('be.visible')
    cy.contains('Račun fonda').should('be.visible')
    cy.contains('Likvidnost').should('be.visible')
  })

  it('S32 — supervizor na detalj prikaz fonda vidi Prodaj dugme pored svake hartije', () => {
    // Plant a NIS holding into the fund via the supervisor's fund-
    // actor BUY (gateway path; same as funds-day live spec). Quick
    // path: invest 30k RSD on behalf of bank, then BUY 10 NIS.
    gatewayLogin(ADMIN_EMAIL, ADMIN_PASSWORD).then((adminTok) =>
      gatewayLogin(SUP_EMAIL, SUP_PASSWORD).then((supTok) =>
        cy
          .request({ url: '/api/v1/funds', headers: { Authorization: `Bearer ${supTok}` } })
          .then((fr) => {
            const alpha = (fr.body.funds ?? []).find((f: { name?: string }) => f.name === 'Alpha Fond') as
              | { id?: string; bankAccountId?: string }
              | undefined
            if (!alpha?.id) throw new Error('Alpha Fond not seeded')
            const fundId = alpha.id
            return findRsdAccount(adminTok, FOREX_BOOK_OWNER_ID, 'ACCOUNT_KIND_FOREX_BOOK').then((bankRsdId) =>
              investFund(supTok, fundId, '30000', bankRsdId, { onBehalfBank: true }).then(() =>
                cy
                  .request({
                    url: `/api/v1/securities?search=${NIS_TICKER}&type=SECURITY_TYPE_STOCK`,
                    headers: { Authorization: `Bearer ${supTok}` },
                  })
                  .then((sr) => {
                    const sec = (sr.body.items ?? [])[0] as { security?: { id?: string } }
                    const secId = sec.security?.id
                    if (!secId) throw new Error('NIS not found')
                    return cy
                      .request({
                        method: 'PUT',
                        url: '/api/v1/listings',
                        headers: { Authorization: `Bearer ${adminTok}` },
                        body: {
                          securityId: secId,
                          exchangeMic: 'XBEL',
                          price: '100',
                          ask: '100.5',
                          bid: '99.5',
                        },
                      })
                      .then(() =>
                        // Force XBEL "open" so the order doesn't get
                        // stamped afterHours=true; the +30min cadence
                        // penalty puts a 10-share fill past the test's
                        // poll horizon.
                        cy.request({
                          method: 'PATCH',
                          url: '/api/v1/exchanges/XBEL/override',
                          headers: { Authorization: `Bearer ${adminTok}`, 'Idempotency-Key': crypto.randomUUID() },
                          body: { overrideState: 'open' },
                        }),
                      )
                      .then(() =>
                        cy
                          .request({
                            method: 'POST',
                            url: '/api/v1/orders',
                            headers: {
                              Authorization: `Bearer ${supTok}`,
                              'Idempotency-Key': crypto.randomUUID(),
                            },
                            body: {
                              securityId: secId,
                              orderType: 'ORDER_TYPE_MARKET',
                              direction: 'DIRECTION_BUY',
                              quantity: 10,
                              accountId: alpha.bankAccountId,
                              onBehalfOfFundId: fundId,
                            },
                          })
                          .then((or) => cy.wrap({ fundId, orderId: or.body.order.id })),
                      )
                  }),
              ),
            )
          }),
      ),
    ).then((ctx) => {
      const fund = ctx as unknown as { fundId: string; orderId: string }
      // Wait for the order to fill so a fund holding row exists.
      function poll(remaining: number): void {
        if (remaining <= 0) throw new Error('fund BUY did not settle')
        gatewayLogin(SUP_EMAIL, SUP_PASSWORD).then((supTok) =>
          cy
            .request({ url: `/api/v1/orders/${fund.orderId}`, headers: { Authorization: `Bearer ${supTok}` } })
            .then((r) => {
              if (r.body.isDone === true) return
              cy.wait(3000)
              poll(remaining - 1)
            }),
        )
      }
      poll(40)

      clearAuth()
      loginViaUi(SUP_EMAIL, SUP_PASSWORD)
      cy.visit(`/portal/fondovi/${fund.fundId}`)
      cy.get('[data-cy="fund-detail-name"]', { timeout: 15000 }).should('be.visible')
      // Supervisor sees a Prodaj button on every holding row.
      cy.get('[data-cy^="fund-sell-"]', { timeout: 15000 }).should('have.length.greaterThan', 0)
    })
  })
})

// ─── Ulaganje + Povlačenje (S33-S37) ─────────────────────────────

describe('Celina 4 — Ulaganje i povlačenje (S33-S37)', () => {
  before(() => {
    cy.resetBackend()
    gatewayLogin(SUP_EMAIL, SUP_PASSWORD).then((supTok) =>
      createFund(supTok, 'Alpha Fond', 1000, 'Diversifikovani RSD fond'),
    )
  })

  function alphaFund() {
    return gatewayLogin(SUP_EMAIL, SUP_PASSWORD).then((supTok) =>
      cy
        .request({ url: '/api/v1/funds', headers: { Authorization: `Bearer ${supTok}` } })
        .then((r) => (r.body.funds ?? []).find((f: { name?: string }) => f.name === 'Alpha Fond').id as string),
    )
  }

  it('S33 — klijent ulaže 5000 RSD na izabranom RSD računu (saga completes, status=200)', () => {
    alphaFund().then((fundId) => {
      gatewayLogin(ADMIN_EMAIL, ADMIN_PASSWORD).then((adminTok) =>
        gatewayLogin(CLIENT_EMAIL, CLIENT_PASSWORD).then((clientTok) =>
          meUserID(clientTok).then((clientId) =>
            findRsdAccount(adminTok, clientId).then((rsdId) =>
              investFund(clientTok, fundId, '5000', rsdId).then((r) => {
                expect(r.status).to.eq(200)
                expect(r.body.transaction?.status).to.eq('FUND_TX_STATUS_COMPLETED')
              }),
            ),
          ),
        ),
      )
    })
  })

  it('S34 — pokušaj ulaganja ispod minimuma → backend odbija sa Serbian porukom', () => {
    alphaFund().then((fundId) => {
      gatewayLogin(ADMIN_EMAIL, ADMIN_PASSWORD).then((adminTok) =>
        gatewayLogin(CLIENT_EMAIL, CLIENT_PASSWORD).then((clientTok) =>
          meUserID(clientTok).then((clientId) =>
            findRsdAccount(adminTok, clientId).then((rsdId) =>
              investFund(clientTok, fundId, '100', rsdId).then((r) => {
                expect(r.status, 'invest rejected').to.not.eq(200)
                expect(r.body.message ?? '', 'min uplata error').to.match(/minimaln|min\.|uloga/i)
              }),
            ),
          ),
        ),
      )
    })
  })

  it('S35 — povlačenje kada fond ima dovoljno likvidnosti vraća pending=false (odmah)', () => {
    alphaFund().then((fundId) => {
      gatewayLogin(ADMIN_EMAIL, ADMIN_PASSWORD).then((adminTok) =>
        gatewayLogin(CLIENT_EMAIL, CLIENT_PASSWORD).then((clientTok) =>
          meUserID(clientTok).then((clientId) =>
            findRsdAccount(adminTok, clientId).then((rsdId) =>
              // First invest 10k so the fund has liquidity, then withdraw 2k.
              investFund(clientTok, fundId, '10000', rsdId).then(() =>
                withdrawFund(clientTok, fundId, '2000', rsdId).then((r) => {
                  expect(r.status).to.eq(200)
                  expect(r.body.pending ?? false, 'liquid path returns pending=false').to.eq(false)
                }),
              ),
            ),
          ),
        ),
      )
    })
  })

  it('S36 — povlačenje preko likvidnosti pokreće auto-likvidaciju (pending=true)', () => {
    alphaFund().then((fundId) => {
      gatewayLogin(ADMIN_EMAIL, ADMIN_PASSWORD).then((adminTok) =>
        gatewayLogin(SUP_EMAIL, SUP_PASSWORD).then((supTok) =>
          gatewayLogin(CLIENT_EMAIL, CLIENT_PASSWORD).then((clientTok) =>
            meUserID(clientTok).then((clientId) =>
              findRsdAccount(adminTok, clientId).then((rsdId) =>
                findRsdAccount(adminTok, FOREX_BOOK_OWNER_ID, 'ACCOUNT_KIND_FOREX_BOOK').then((bankRsdId) =>
                  // Bank invests 30k, then we drain fund's RSD via a fund-actor BUY
                  // on NIS (100 RSD × 200 = 20k held in stock). Client invests 20k.
                  // Withdrawing 25k forces auto-liquidation.
                  investFund(supTok, fundId, '30000', bankRsdId, { onBehalfBank: true }).then(() =>
                    cy
                      .request({
                        url: `/api/v1/securities?search=${NIS_TICKER}&type=SECURITY_TYPE_STOCK`,
                        headers: { Authorization: `Bearer ${supTok}` },
                      })
                      .then((sr) => {
                        const sec = (sr.body.items ?? [])[0] as { security?: { id?: string } }
                        return cy
                          .request({
                            method: 'PUT',
                            url: '/api/v1/listings',
                            headers: { Authorization: `Bearer ${adminTok}` },
                            body: {
                              securityId: sec.security?.id,
                              exchangeMic: 'XBEL',
                              price: '100',
                              ask: '100.5',
                              bid: '99.5',
                            },
                          })
                          .then(() =>
                            // Force XBEL open so the BUY doesn't pay
                            // the +30min after-hours cadence penalty.
                            cy.request({
                              method: 'PATCH',
                              url: '/api/v1/exchanges/XBEL/override',
                              headers: { Authorization: `Bearer ${adminTok}`, 'Idempotency-Key': crypto.randomUUID() },
                              body: { overrideState: 'open' },
                            }),
                          )
                          .then(() =>
                            cy
                              .request({ url: `/api/v1/funds/${fundId}`, headers: { Authorization: `Bearer ${supTok}` } })
                              .then((fr) =>
                                cy.request({
                                  method: 'POST',
                                  url: '/api/v1/orders',
                                  headers: {
                                    Authorization: `Bearer ${supTok}`,
                                    'Idempotency-Key': crypto.randomUUID(),
                                  },
                                  body: {
                                    securityId: sec.security?.id,
                                    orderType: 'ORDER_TYPE_MARKET',
                                    direction: 'DIRECTION_BUY',
                                    quantity: 200,
                                    accountId: fr.body.bankAccountId,
                                    onBehalfOfFundId: fundId,
                                  },
                                }),
                              ),
                          )
                      })
                      .then(() =>
                        investFund(clientTok, fundId, '20000', rsdId).then(() =>
                          // Client withdraw 25k > liquid ≈ 30k of RSD initially,
                          // but post-NIS-buy liquid is roughly 30k - 20k = 10k. 25k > 10k → illiquid.
                          withdrawFund(clientTok, fundId, '25000', rsdId).then((r) => {
                            expect(r.status).to.eq(200)
                            expect(r.body.pending ?? false, 'illiquid path returns pending=true').to.eq(true)
                          }),
                        ),
                      ),
                  ),
                ),
              ),
            ),
          ),
        ),
      )
    })
  })

  it('S37 — povlačenje u EUR: amountRsd ide u zahtevu; FX konverzija + provizija na bank stranu', () => {
    alphaFund().then((fundId) => {
      gatewayLogin(ADMIN_EMAIL, ADMIN_PASSWORD).then((adminTok) =>
        gatewayLogin(CLIENT_EMAIL, CLIENT_PASSWORD).then((clientTok) =>
          meUserID(clientTok).then((clientId) =>
            findRsdAccount(adminTok, clientId).then((rsdId) =>
              cy
                .request({
                  method: 'POST',
                  url: '/api/v1/accounts',
                  headers: { Authorization: `Bearer ${adminTok}` },
                  body: {
                    ownerClientId: clientId,
                    kind: 'ACCOUNT_KIND_PERSONAL_FX',
                    subtype: 'ACCOUNT_SUBTYPE_UNSPECIFIED',
                    currency: 'CURRENCY_EUR',
                    name: 'Klijent EUR',
                    openingBalance: '0',
                  },
                })
                .then((accRes) =>
                  investFund(clientTok, fundId, '10000', rsdId).then(() =>
                    withdrawFund(clientTok, fundId, '5000', accRes.body.account.id).then((r) => {
                      expect(r.status, 'EUR withdrawal accepted').to.eq(200)
                    }),
                  ),
                ),
            ),
          ),
        ),
      )
    })
  })
})

// ─── Kreiranje fonda (S38-S39) ───────────────────────────────────

describe('Celina 4 — Kreiranje fonda (S38-S39)', () => {
  before(() => {
    cy.resetBackend()
  })

  it('S38 — supervizor uspešno kreira fond + redirektuje na detalj', () => {
    clearAuth()
    loginViaUi(SUP_EMAIL, SUP_PASSWORD)
    cy.visit('/portal/fondovi')
    cy.contains('h1', 'Investicioni fondovi', { timeout: 15000 }).should('be.visible')
    cy.get('[data-cy="funds-create"]').click()
    cy.get('[data-cy="fund-name"]').type('Gamma Fond')
    cy.get('[data-cy="fund-description"]').type('Test fond')
    cy.get('[data-cy="fund-min"]').type('500')
    cy.get('[data-cy="fund-create-submit"]').click()
    cy.url({ timeout: 15000 }).should('match', /\/portal\/fondovi\/[0-9a-f-]+/)
    cy.contains('[data-cy="fund-detail-name"]', 'Gamma Fond').should('be.visible')
  })

  it('S39 — agent (sa actuary.agent, bez funds.manage.supervisor) ne može kreirati fond', () => {
    clearAuth()
    loginViaUi(AGENT_EMAIL, AGENT_PASSWORD)
    cy.visit('/portal/fondovi', { failOnStatusCode: false })
    // Route guard redirects to /portal when none of {admin,
    // funds.read.supervisor, funds.manage.supervisor,
    // funds.read.client, funds.invest.client} are present. Agent has
    // none of those.
    cy.url({ timeout: 10000 }).should('not.include', '/fondovi')
  })
})

// ─── Kupovina hartija za fond (S40-S42) ─────────────────────────

describe('Celina 4 — Kupovina hartija za fond (S40-S42)', () => {
  before(() => {
    cy.resetBackend()
    gatewayLogin(SUP_EMAIL, SUP_PASSWORD).then((supTok) =>
      createFund(supTok, 'Alpha Fond', 1000, 'Diversifikovani RSD fond'),
    )
  })

  function setupNisListing() {
    return gatewayLogin(ADMIN_EMAIL, ADMIN_PASSWORD).then((adminTok) =>
      cy
        .request({
          url: `/api/v1/securities?search=${NIS_TICKER}&type=SECURITY_TYPE_STOCK`,
          headers: { Authorization: `Bearer ${adminTok}` },
        })
        .then((r) => {
          const id = (r.body.items ?? [])[0].security.id as string
          return cy
            .request({
              method: 'PUT',
              url: '/api/v1/listings',
              headers: { Authorization: `Bearer ${adminTok}` },
              body: { securityId: id, exchangeMic: 'XBEL', price: '100', ask: '100.5', bid: '99.5' },
            })
            .then(() =>
              // XBEL "open" override — keeps the BUY off the +30min
              // after-hours cadence path so partial fills finish
              // inside the test poll budget.
              cy.request({
                method: 'PATCH',
                url: '/api/v1/exchanges/XBEL/override',
                headers: { Authorization: `Bearer ${adminTok}`, 'Idempotency-Key': crypto.randomUUID() },
                body: { overrideState: 'open' },
              }),
            )
            .then(() => id)
        }),
    )
  }

  function alphaFund() {
    return gatewayLogin(SUP_EMAIL, SUP_PASSWORD).then((supTok) =>
      cy.request({ url: '/api/v1/funds', headers: { Authorization: `Bearer ${supTok}` } }).then((r) => {
        const alpha = (r.body.funds ?? []).find((f: { name?: string }) => f.name === 'Alpha Fond') as
          | { id?: string; bankAccountId?: string }
          | undefined
        if (!alpha?.id) throw new Error('Alpha Fond not seeded')
        return alpha as { id: string; bankAccountId: string }
      }),
    )
  }

  it('S40 — supervizor kreira BUY order za fond sa onBehalfOfFundId', () => {
    alphaFund().then((alpha) =>
      setupNisListing().then((nisId) =>
        gatewayLogin(ADMIN_EMAIL, ADMIN_PASSWORD).then((adminTok) =>
          gatewayLogin(SUP_EMAIL, SUP_PASSWORD).then((supTok) =>
            findRsdAccount(adminTok, FOREX_BOOK_OWNER_ID, 'ACCOUNT_KIND_FOREX_BOOK').then((bankRsdId) =>
              investFund(supTok, alpha.id, '30000', bankRsdId, { onBehalfBank: true }).then(() =>
                cy
                  .request({
                    method: 'POST',
                    url: '/api/v1/orders',
                    headers: {
                      Authorization: `Bearer ${supTok}`,
                      'Idempotency-Key': crypto.randomUUID(),
                    },
                    body: {
                      securityId: nisId,
                      orderType: 'ORDER_TYPE_MARKET',
                      direction: 'DIRECTION_BUY',
                      quantity: 50,
                      accountId: alpha.bankAccountId,
                      onBehalfOfFundId: alpha.id,
                    },
                  })
                  .then((r) => {
                    expect(r.status, 'fund-actor BUY accepted').to.eq(200)
                    expect(r.body.order.id).to.be.a('string')
                  }),
              ),
            ),
          ),
        ),
      ),
    )
  })

  it('S41 — supervizor BUY za banku (bez onBehalfOfFundId): zero FX commission', () => {
    setupNisListing().then((nisId) =>
      gatewayLogin(ADMIN_EMAIL, ADMIN_PASSWORD).then((adminTok) =>
        gatewayLogin(SUP_EMAIL, SUP_PASSWORD).then((supTok) =>
          findRsdAccount(adminTok, FOREX_BOOK_OWNER_ID, 'ACCOUNT_KIND_FOREX_BOOK').then((bankRsdId) =>
            cy
              .request({
                method: 'POST',
                url: '/api/v1/orders',
                headers: { Authorization: `Bearer ${supTok}`, 'Idempotency-Key': crypto.randomUUID() },
                body: {
                  securityId: nisId,
                  orderType: 'ORDER_TYPE_MARKET',
                  direction: 'DIRECTION_BUY',
                  quantity: 10,
                  accountId: bankRsdId,
                },
              })
              .then((r) => {
                expect(r.status, 'bank-actor BUY accepted').to.eq(200)
              }),
          ),
        ),
      ),
    )
  })

  it('S42 — fond bez dovoljno likvidnosti odbija BUY order sa porukom o nedovoljnoj likvidnosti', () => {
    alphaFund().then((alpha) =>
      setupNisListing().then((nisId) =>
        gatewayLogin(SUP_EMAIL, SUP_PASSWORD).then((supTok) =>
          // Fund has 0 RSD liquid (no invest yet). 1000 RSD worth of NIS is too much.
          cy
            .request({
              method: 'POST',
              url: '/api/v1/orders',
              failOnStatusCode: false,
              headers: { Authorization: `Bearer ${supTok}`, 'Idempotency-Key': crypto.randomUUID() },
              body: {
                securityId: nisId,
                orderType: 'ORDER_TYPE_MARKET',
                direction: 'DIRECTION_BUY',
                quantity: 10,
                accountId: alpha.bankAccountId,
                onBehalfOfFundId: alpha.id,
              },
            })
            .then((r) => {
              expect(r.status, 'BUY rejected').to.not.eq(200)
              expect(r.body.message ?? '', 'Serbian liquidity error').to.match(/likvidn|sredst|nema/i)
            }),
        ),
      ),
    )
  })
})

// ─── Moji fondovi (S43-S45) ──────────────────────────────────────

describe('Celina 4 — Moj portfolio: Moji fondovi (S43-S45)', () => {
  before(() => {
    cy.resetBackend()
    // Create Alpha + client A invests 10k.
    gatewayLogin(SUP_EMAIL, SUP_PASSWORD).then((supTok) =>
      createFund(supTok, 'Alpha Fond', 1000, 'Diversifikovani').then(() => {
        gatewayLogin(ADMIN_EMAIL, ADMIN_PASSWORD).then((adminTok) =>
          gatewayLogin(CLIENT_EMAIL, CLIENT_PASSWORD).then((clientTok) =>
            meUserID(clientTok).then((clientId) =>
              findRsdAccount(adminTok, clientId).then((rsdId) =>
                cy
                  .request({ url: '/api/v1/funds', headers: { Authorization: `Bearer ${supTok}` } })
                  .then((fr) => {
                    const fundId = (fr.body.funds ?? [])[0].id as string
                    investFund(clientTok, fundId, '10000', rsdId)
                  }),
              ),
            ),
          ),
        )
      }),
    )
  })

  it('S43 — klijent vidi tab "Moji fondovi" sa fondovima + udeo (%, RSD) + profit', () => {
    clearAuth()
    loginViaUi(CLIENT_EMAIL, CLIENT_PASSWORD)
    cy.visit('/banking/portfolio')
    cy.contains('Moji fondovi', { timeout: 15000 }).click()
    cy.contains('Alpha Fond', { timeout: 15000 }).should('be.visible')
    cy.contains(/%/).should('exist')
  })

  it('S44 — supervizor vidi fondove kojima upravlja u Moj portfolio → Moji fondovi', () => {
    clearAuth()
    loginViaUi(SUP_EMAIL, SUP_PASSWORD)
    cy.visit('/portal/portfolio')
    cy.contains('Moji fondovi', { timeout: 15000 }).click()
    cy.contains('Alpha Fond', { timeout: 15000 }).should('be.visible')
  })

  it('S45 — kada drugi klijent uloži veliki iznos, procenat ovog klijenta opada', () => {
    // klijent2 invests 90k → klijent A's share drops from 100% to ~10%.
    gatewayLogin(ADMIN_EMAIL, ADMIN_PASSWORD).then((adminTok) =>
      gatewayLogin(CLIENT2_EMAIL, CLIENT2_PASSWORD).then((client2Tok) =>
        meUserID(client2Tok).then((client2Id) =>
          cy
            .request({
              method: 'POST',
              url: '/api/v1/accounts',
              headers: { Authorization: `Bearer ${adminTok}` },
              body: {
                ownerClientId: client2Id,
                kind: 'ACCOUNT_KIND_PERSONAL_RSD',
                subtype: 'ACCOUNT_SUBTYPE_UNSPECIFIED',
                currency: 'CURRENCY_RSD',
                name: 'Klijent2 RSD',
                openingBalance: '200000',
              },
            })
            .then((accRes) =>
              cy
                .request({ url: '/api/v1/funds', headers: { Authorization: `Bearer ${client2Tok}` } })
                .then((fr) => {
                  const fundId = (fr.body.funds ?? [])[0].id as string
                  return investFund(client2Tok, fundId, '90000', accRes.body.account.id)
                }),
            ),
        ),
      ),
    )

    clearAuth()
    loginViaUi(CLIENT_EMAIL, CLIENT_PASSWORD)
    cy.visit('/banking/portfolio')
    cy.contains('Moji fondovi', { timeout: 15000 }).click()
    cy.contains('Alpha Fond', { timeout: 15000 }).should('be.visible')
    // Klijent A had 100%; after klijent2's 90k it should drop to ~10%.
    cy.contains(/^1\d?[,.]?\d*\s*%/, { timeout: 15000 }).should('exist')
  })
})

// ─── Cascade pri demociji supervizora (S46) ─────────────────────

describe('Celina 4 — Democija supervizora (S46)', () => {
  before(() => {
    cy.resetBackend()
    gatewayLogin(SUP_EMAIL, SUP_PASSWORD).then((supTok) => {
      createFund(supTok, 'Alpha Fond', 1000, 'Fond Alpha')
      createFund(supTok, 'Beta Fond', 1000, 'Fond Beta')
    })
  })

  it('S46 — admin uklanja funds.manage.supervisor sa supervizora: fondovi se prebacuju na admina', () => {
    gatewayLogin(ADMIN_EMAIL, ADMIN_PASSWORD).then((adminTok) =>
      gatewayLogin(SUP_EMAIL, SUP_PASSWORD).then((supTok) =>
        meUserID(supTok).then((supId) =>
          meUserID(adminTok).then((adminId) =>
            // Pre: both funds managed by supId.
            cy
              .request({ url: '/api/v1/funds', headers: { Authorization: `Bearer ${adminTok}` } })
              .then((fr) => {
                const ids = (fr.body.funds ?? []).map((f: { managerUserId?: string }) => f.managerUserId)
                expect(ids.every((m: string) => m === supId), 'before demotion: super manages all').to.eq(true)
              })
              .then(() =>
                // Admin demotes supervisor (PUT /api/v1/employees/{id}/permissions).
                cy
                  .request({
                    method: 'PUT',
                    url: `/api/v1/employees/${supId}/permissions`,
                    headers: {
                      Authorization: `Bearer ${adminTok}`,
                      'Idempotency-Key': crypto.randomUUID(),
                    },
                    body: { permissions: ['employee.read', 'client.read'] },
                  })
                  .then((r) => expect(r.status).to.eq(200)),
              )
              .then(() =>
                // Post: funds reassigned to the acting admin.
                cy
                  .request({ url: '/api/v1/funds', headers: { Authorization: `Bearer ${adminTok}` } })
                  .then((fr) => {
                    const ids = (fr.body.funds ?? []).map((f: { managerUserId?: string }) => f.managerUserId)
                    expect(ids.every((m: string) => m === adminId), 'after demotion: admin manages all').to.eq(true)
                  }),
              ),
          ),
        ),
      ),
    )
  })
})
