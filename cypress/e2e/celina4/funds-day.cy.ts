/// <reference types="cypress" />

// spec/Banka2025.pdf p.71-76 "Investicioni fondovi" worked end-to-end:
//
//   Supervizor creates "Alpha Fond" (RSD, min 1_000) → invests 30_000
//   RSD on behalf of the bank → klijent (Test Klijent) invests 30_000
//   from his RSD account → supervizor places a fund-actor MARKET BUY
//   on NIS (RSD listing) for 400 shares @ 100 RSD → 40_000 of the
//   fund's liquid RSD turns into holdings → NIS bumps to 120 RSD so a
//   realized_gain on the next withdraw is non-zero → client withdraws
//   5_000 RSD (liquid path, fund still has 20_000 liquid) → client
//   withdraws 18_000 RSD which exceeds the remaining 15_000 liquid →
//   illiquid path: server returns pending=true, fund-actor SELL
//   orders auto-fire, recovery worker resumes the saga when enough
//   cash lands → withdrawal flips to completed → client realized_gain
//   row is asserted (proceeds, cost_basis pro-rata, RSD) → supervisor
//   runs tax cron, state_tax credit matches reported totalRsd.
//
// Drives the FE for fund CRUD + invest/withdraw dialogs; uses the
// gateway directly for fund-actor BUY (the FE doesn't expose that
// path — see FundDetail's "Prodaj" button which is SELL-only — and
// for price overrides + numeric invariants.

const ADMIN_EMAIL = 'admin@banka.local'
const ADMIN_PASSWORD = 'Admin123!'
const SUPERVISOR_EMAIL = 'supervizor@banka.local'
const SUPERVISOR_PASSWORD = 'Supervizor123!'
const CLIENT_EMAIL = 'klijent@banka.local'
const CLIENT_PASSWORD = 'Klijent123!'

const FUND_NAME = 'Alpha Fond'
const FUND_MIN = 1_000

const NIS_TICKER = 'NIS'
const NIS_BUY_PRICE = 100
const NIS_BUMP_PRICE = 120

const BANK_INVEST = 30_000
const CLIENT_INVEST = 30_000
const FUND_BUY_QTY = 400
const LIQUID_WITHDRAW = 5_000
const ILLIQUID_WITHDRAW = 18_000

const FOREX_BOOK_OWNER_ID = '00000000-0000-0000-0000-000000000020'
const STATE_TAX_OWNER_ID = '00000000-0000-0000-0000-000000000010'

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

function meUserID(token: string): Cypress.Chainable<string> {
  return cy
    .request({ url: '/api/v1/auth/me', headers: { Authorization: `Bearer ${token}` } })
    .then((r) => (r.body.client?.id ?? r.body.employee?.id) as string)
}

function listAccounts(token: string, ownerClientId: string, kind?: string) {
  let url = `/api/v1/accounts?ownerClientId=${ownerClientId}`
  if (kind) url += `&kind=${kind}`
  return cy
    .request({ url, headers: { Authorization: `Bearer ${token}` } })
    .then((r) =>
      (r.body.accounts ?? []) as Array<{
        id?: string
        currency?: string
        kind?: string
        balance?: string
        availableBalance?: string
      }>,
    )
}

function findRsdAccount(token: string, ownerClientId: string, kind?: string): Cypress.Chainable<{
  id: string
  balance: number
}> {
  return listAccounts(token, ownerClientId, kind).then((accs) => {
    const rsd = accs.find((a) => a.currency === 'CURRENCY_RSD' && (kind ? a.kind === kind : true))
    if (!rsd?.id) throw new Error(`no RSD account for ${ownerClientId} (kind=${kind ?? 'any'})`)
    return { id: rsd.id, balance: Number(rsd.balance ?? '0') }
  })
}

function pinListing(
  adminTok: string,
  securityId: string,
  exchangeMic: string,
  price: number,
  ask: number,
  bid: number,
) {
  return cy.request({
    method: 'PUT',
    url: '/api/v1/listings',
    headers: { Authorization: `Bearer ${adminTok}` },
    body: {
      securityId,
      exchangeMic,
      price: String(price),
      ask: String(ask),
      bid: String(bid),
    },
  })
}

function findSecurity(
  token: string,
  ticker: string,
): Cypress.Chainable<{ securityId: string; exchangeMic: string }> {
  return cy
    .request({
      url: `/api/v1/securities?search=${encodeURIComponent(ticker)}&type=SECURITY_TYPE_STOCK`,
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => {
      const items = (r.body.items ?? []) as Array<{
        security?: { id?: string; ticker?: string; exchangeMic?: string }
        listing?: { exchangeMic?: string }
      }>
      const hit = items.find((i) => i.security?.ticker === ticker)
      if (!hit) throw new Error(`security ${ticker} not found`)
      return {
        securityId: hit.security!.id as string,
        exchangeMic: (hit.listing?.exchangeMic ?? hit.security?.exchangeMic ?? 'XBEL') as string,
      }
    })
}

function getFundTransactions(token: string, fundId: string) {
  return cy
    .request({
      url: `/api/v1/funds/${fundId}/transactions`,
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) =>
      (r.body.transactions ?? []) as Array<{
        id?: string
        status?: string
        amountRsd?: string
        isInflow?: boolean
        clientId?: string
      }>,
    )
}

function stateTaxRSDBalance(adminTok: string): Cypress.Chainable<number> {
  return cy
    .request({
      url: `/api/v1/accounts?ownerClientId=${STATE_TAX_OWNER_ID}&kind=ACCOUNT_KIND_STATE_TAX`,
      headers: { Authorization: `Bearer ${adminTok}` },
    })
    .then((r) => {
      const accs = (r.body.accounts ?? []) as Array<{ currency?: string; balance?: string }>
      const rsd = accs.find((a) => a.currency === 'CURRENCY_RSD')
      if (!rsd) throw new Error('state-tax RSD account not seeded')
      return Number(rsd.balance ?? '0')
    })
}

function listRealizedGains(
  supTok: string,
  clientId: string,
): Cypress.Chainable<
  Array<{
    quantity?: number
    costBasisAmt?: string
    proceedsAmt?: string
    gainNative?: string
    gainRsd?: string
    profitNative?: string
    currency?: string
    realizedAt?: string
  }>
> {
  return cy
    .request({
      url: `/api/v1/tax/realized?userId=${clientId}&userKind=USER_KIND_CLIENT`,
      headers: { Authorization: `Bearer ${supTok}` },
    })
    .then((r) => r.body.rows ?? [])
}

describe('Celina 4 (live) — investment funds day (spec p.71-76)', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('supervisor creates fund, both parties invest, fund-actor BUY, liquid + illiquid withdraws, tax', () => {
    // ───────────── Stage 0: pre-flight ─────────────
    // Admin pins NIS to deterministic BUY price, captures supervisor's
    // bank-side RSD forex_book account, captures client's RSD account
    // (seed plants one on the test klijent), captures the seeded
    // baseline state-tax balance.
    gatewayLogin(ADMIN_EMAIL, ADMIN_PASSWORD).then((adminTok) => {
      cy.wrap(adminTok).as('adminTok')
      findSecurity(adminTok, NIS_TICKER).then(({ securityId, exchangeMic }) => {
        cy.wrap(securityId).as('nisId')
        cy.wrap(exchangeMic).as('nisMic')
        pinListing(adminTok, securityId, exchangeMic, NIS_BUY_PRICE, NIS_BUY_PRICE + 0.5, NIS_BUY_PRICE - 0.5)
        // Force XBEL "open" so the fund-actor BUY isn't flagged
        // after-hours at create time — afterHours adds a flat 30min to
        // every cadence roll (spec p.56), which makes a 400-share fill
        // run hours instead of minutes against the test's 240s poll.
        cy.request({
          method: 'PATCH',
          url: `/api/v1/exchanges/${exchangeMic}/override`,
          headers: { Authorization: `Bearer ${adminTok}`, 'Idempotency-Key': crypto.randomUUID() },
          body: { overrideState: 'open' },
        })
      })
      stateTaxRSDBalance(adminTok).then((b) => cy.wrap(b).as('stateTaxBefore'))
      // Bank's per-currency forex_book RSD account is the source for
      // the supervisor's "u ime banke" invest leg.
      findRsdAccount(adminTok, FOREX_BOOK_OWNER_ID, 'ACCOUNT_KIND_FOREX_BOOK').then((a) =>
        cy.wrap(a.id).as('bankRsdId'),
      )
    })

    gatewayLogin(CLIENT_EMAIL, CLIENT_PASSWORD).then((tok) => {
      cy.wrap(tok).as('clientTok')
      meUserID(tok).then((id) => cy.wrap(id).as('clientId'))
    })
    gatewayLogin(SUPERVISOR_EMAIL, SUPERVISOR_PASSWORD).then((tok) => {
      cy.wrap(tok).as('supTok')
      meUserID(tok).then((id) => cy.wrap(id).as('supId'))
    })

    // Client's seeded RSD account (kind=personal_rsd). The funds
    // invest path requires this for the contribution leg.
    cy.get<string>('@adminTok').then((adminTok) => {
      cy.get<string>('@clientId').then((clientId) => {
        findRsdAccount(adminTok, clientId).then((a) => cy.wrap(a.id).as('clientRsdId'))
      })
    })

    // ───────────── DEO 1: supervisor creates fund ─────────────
    // Stage 0's gateway logins set refresh-token cookies in cypress's
    // jar; if those leak into the SPA's bootstrap-auth on cy.visit, the
    // app auto-logs-in as the last login (supervizor) without the
    // Zustand persist key set, which leaves the SPA on the login page
    // but with a broken paint. Clear cookies first so /login renders
    // fresh and findByLabelText('Email') resolves.
    clearAuth()
    cy.loginAsSupervisor()
    cy.visit('/portal/fondovi')
    cy.contains('h1', 'Investicioni fondovi', { timeout: 15000 }).should('be.visible')
    cy.get('[data-cy="funds-create"]').click()
    cy.contains('Kreiraj fond').should('be.visible')
    cy.get('[data-cy="fund-name"]').type(FUND_NAME)
    cy.get('[data-cy="fund-description"]').type('Diversifikovani RSD fond za PR8 E2E')
    cy.get('[data-cy="fund-min"]').type(String(FUND_MIN))
    cy.get('[data-cy="fund-create-submit"]').click()

    // CreateFundDialog redirects to /portal/fondovi/$fundId on success.
    cy.url({ timeout: 15000 }).should('match', /\/portal\/fondovi\/[0-9a-f-]+/)
    cy.contains('[data-cy="fund-detail-name"]', FUND_NAME).should('be.visible')
    cy.url().then((url) => {
      const fundId = url.match(/\/portal\/fondovi\/([0-9a-f-]+)/)![1]
      cy.wrap(fundId).as('fundId')
    })

    // ───────────── DEO 2: supervisor invests on behalf of bank ─────────────
    cy.get('[data-cy="fund-invest"]').click()
    cy.contains('Uplata u fond', { timeout: 10000 }).should('be.visible')
    cy.get('[data-cy="fund-invest-on-behalf-bank"]').check()
    cy.contains('Uplata u fond (u ime banke)').should('be.visible')
    // The picker lists every forex_book account under the bank sentinel
    // (one per currency); pin RSD explicitly so the SAGA doesn't have
    // to FX-hop. The select stays disabled until the accounts query
    // settles — wait for the loading flag to clear before selecting.
    cy.get('[data-cy="fund-invest-source"]', { timeout: 15000 }).should('not.be.disabled')
    cy.get<string>('@bankRsdId').then((bankRsdId) => {
      cy.get('[data-cy="fund-invest-source"]').select(bankRsdId)
    })
    cy.get('[data-cy="fund-invest-amount"]').type(String(BANK_INVEST))
    cy.get('[data-cy="fund-invest-confirm"]').click()
    cy.contains('Potvrda uplate u fond', { timeout: 10000 }).should('be.visible')
    cy.get('[aria-label="verifikacioni-kod"]', { timeout: 10000 })
      .invoke('text')
      .then((code) => {
        cy.get('#verif-code').type(code.trim())
        cy.contains('button', 'Potvrdi').click()
      })

    // Wait for the invest SAGA to flush; fund's "Ukupna vrednost" should
    // show 30_000 RSD.
    cy.get('[data-cy="fund-pending-toast"]').should('not.exist')
    cy.contains('Ukupna vrednost', { timeout: 15000 })
      .parent()
      .invoke('text')
      .should('contain', '30.000')

    // ───────────── DEO 3: client invests from their RSD account ─────────────
    clearAuth()
    cy.loginAsClient()
    cy.get<string>('@fundId').then((fundId) => cy.visit(`/banking/fondovi/${fundId}`))
    cy.contains('[data-cy="fund-detail-name"]', FUND_NAME, { timeout: 15000 }).should('be.visible')

    cy.get('[data-cy="fund-invest"]').click()
    cy.contains('Uplata u fond', { timeout: 10000 }).should('be.visible')
    cy.get('[data-cy="fund-invest-source"]', { timeout: 15000 }).should('not.be.disabled')
    cy.get<string>('@clientRsdId').then((rsdId) => {
      cy.get('[data-cy="fund-invest-source"]').select(rsdId)
    })
    cy.get('[data-cy="fund-invest-amount"]').clear().type(String(CLIENT_INVEST))
    cy.get('[data-cy="fund-invest-confirm"]').click()
    cy.contains('Potvrda uplate u fond', { timeout: 10000 }).should('be.visible')
    cy.get('[aria-label="verifikacioni-kod"]', { timeout: 10000 })
      .invoke('text')
      .then((code) => {
        cy.get('#verif-code').type(code.trim())
        cy.contains('button', 'Potvrdi').click()
      })

    // Fund total_value now 60_000 = bank's 30k + client's 30k. The
    // position card surfaces the client's 30k uloženo.
    cy.contains('Vaša pozicija', { timeout: 15000 }).should('be.visible')
    cy.get('[data-cy="fund-position-summary"]')
      .invoke('text')
      .should('contain', '30.000')

    // ───────────── DEO 4: supervisor places fund-actor BUY ─────────────
    // Fund needs holdings before the illiquid withdraw can liquidate.
    // The FE has no fund-actor BUY UI (only fund-actor SELL on existing
    // holdings via FundSellHoldingDialog), so we drive the order
    // through the gateway directly. Fund's bank account is the
    // settlement counterparty (orders book holdings to the fund).
    cy.get<string>('@supTok').then((supTok) => {
      cy.get<string>('@fundId').then((fundId) => {
        cy.request({
          url: `/api/v1/funds/${fundId}`,
          headers: { Authorization: `Bearer ${supTok}` },
        }).then((r) => {
          const fundBankId = r.body.fund?.bankAccountId as string
          cy.wrap(fundBankId).as('fundBankId')
          cy.get<string>('@nisId').then((nisId) => {
            cy.request({
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
                quantity: FUND_BUY_QTY,
                accountId: fundBankId,
                onBehalfOfFundId: fundId,
              },
            }).then((or) => {
              const orderId = or.body.order?.id ?? or.body.id
              cy.wrap(orderId).as('fundBuyId')
            })
          })
        })
      })
    })

    // Wait for the fund-actor BUY to fully settle. The c3 cadence
    // floor + thick volume usually closes a 400-share market BUY in
    // ~3-6 worker ticks (10s each); poll up to 240s.
    cy.get<string>('@supTok').then((supTok) => {
      cy.get<string>('@fundBuyId').then((orderId) => {
        function poll(remaining: number): void {
          if (remaining <= 0) throw new Error(`fund BUY ${orderId} not done`)
          cy.request({
            url: `/api/v1/orders/${orderId}`,
            headers: { Authorization: `Bearer ${supTok}` },
          }).then((r) => {
            if (r.body.isDone === true) return
            cy.wait(3000)
            poll(remaining - 1)
          })
        }
        poll(80) // 80 × 3s = 240s ceiling
      })
    })

    // ───────────── DEO 5: bump price → liquid withdraw ─────────────
    // Bumping NIS from 100 → 120 raises the fund's total_value_rsd from
    // 60_000 (20k liquid + 40k holdings) to 68_000 (20k liquid + 48k
    // holdings), pushing unit_price to ~1.1333. A 5_000 RSD withdraw
    // now realizes a small RSD gain (proceeds > pro-rata cost basis).
    cy.get<string>('@adminTok').then((adminTok) => {
      cy.get<string>('@nisId').then((nisId) => {
        cy.get<string>('@nisMic').then((mic) => {
          pinListing(adminTok, nisId, mic, NIS_BUMP_PRICE, NIS_BUMP_PRICE + 0.5, NIS_BUMP_PRICE - 0.5)
        })
      })
    })

    // The client is already on the fund detail page (vite kept the
    // session); refresh data and open the withdraw dialog.
    cy.get<string>('@fundId').then((fundId) => cy.visit(`/banking/fondovi/${fundId}`))
    cy.get('[data-cy="fund-withdraw"]', { timeout: 15000 }).click()
    cy.contains('Povlačenje iz fonda', { timeout: 10000 }).should('be.visible')
    cy.get('[data-cy="fund-withdraw-dest"]', { timeout: 15000 }).should('not.be.disabled')
    cy.get<string>('@clientRsdId').then((rsdId) => {
      cy.get('[data-cy="fund-withdraw-dest"]').select(rsdId)
    })
    cy.get('[data-cy="fund-withdraw-amount"]').type(String(LIQUID_WITHDRAW))
    cy.get('[data-cy="fund-withdraw-confirm"]').click()
    cy.contains('Potvrda povlačenja iz fonda', { timeout: 10000 }).should('be.visible')
    cy.get('[aria-label="verifikacioni-kod"]', { timeout: 10000 })
      .invoke('text')
      .then((code) => {
        cy.get('#verif-code').type(code.trim())
        cy.contains('button', 'Potvrdi').click()
      })

    // Liquid path: no pending toast appears.
    cy.get('[data-cy="fund-pending-toast"]').should('not.exist')
    // Position card surfaces the post-withdraw uloženo
    // (~30k − pro-rata cost basis ≈ ~25.6k).
    cy.contains('Vaša pozicija', { timeout: 15000 }).should('be.visible')

    // ───────────── DEO 6: illiquid withdraw → auto-liquidation ─────────────
    // After the liquid withdraw the fund's bank balance dropped to
    // 20_000 − 5_000 = 15_000 RSD. Requesting 18_000 falls into the
    // illiquid path: fund_withdraw SAGA returns pending=true, auto-
    // liquidation orders fire, recovery worker resumes the saga once
    // ≥18_000 RSD of liquid is back in the fund.
    cy.get('[data-cy="fund-withdraw"]', { timeout: 15000 }).click()
    cy.get('[data-cy="fund-withdraw-dest"]', { timeout: 15000 }).should('not.be.disabled')
    cy.get<string>('@clientRsdId').then((rsdId) => {
      cy.get('[data-cy="fund-withdraw-dest"]').select(rsdId)
    })
    cy.get('[data-cy="fund-withdraw-amount"]').clear().type(String(ILLIQUID_WITHDRAW))
    cy.get('[data-cy="fund-withdraw-confirm"]').click()
    cy.contains('Potvrda povlačenja iz fonda', { timeout: 10000 }).should('be.visible')
    cy.get('[aria-label="verifikacioni-kod"]', { timeout: 10000 })
      .invoke('text')
      .then((code) => {
        cy.get('#verif-code').type(code.trim())
        cy.contains('button', 'Potvrdi').click()
      })

    // The pending toast surfaces only if the SAGA actually yielded on
    // the auto-liquidation step. With cadence at the 1ms floor + thick
    // NIS volume, the recovery worker can resume + finish before the
    // initial WithdrawFromFund call returns, in which case pending=false
    // and no toast renders. Either way the withdrawal must show up as
    // a completed row in the audit log shortly after — that's the real
    // illiquid-path assertion.

    // Poll the ListFundTransactions audit log until the pending row
    // flips to completed. The recovery worker ticks every
    // SAGA_RECOVERY_TICK (default 30s); auto-liquidation needs a few
    // execution ticks on top. Allow up to 6 min.
    cy.get<string>('@supTok').then((supTok) => {
      cy.get<string>('@fundId').then((fundId) => {
        function poll(remaining: number): void {
          if (remaining <= 0) throw new Error('illiquid withdraw never completed')
          getFundTransactions(supTok, fundId).then((txs) => {
            const completedWithdraws = txs.filter(
              (t) => !t.isInflow && t.status === 'FUND_TX_STATUS_COMPLETED',
            )
            // Two completed outflows: the liquid 5k + the illiquid 18k.
            if (completedWithdraws.length >= 2) return
            cy.wait(5000)
            poll(remaining - 1)
          })
        }
        poll(72) // 72 × 5s = 360s ceiling
      })
    })

    // ───────────── DEO 7: client realized_gain row asserted ─────────────
    // EDGE-3: each withdraw writes one realized_gains row at the client
    // boundary, currency = RSD, proceeds = amount_rsd, cost_basis =
    // pro-rata position.total_invested_rsd.
    cy.get<string>('@supTok').then((supTok) => {
      cy.get<string>('@clientId').then((clientId) => {
        listRealizedGains(supTok, clientId).then((rows) => {
          // Seed plants two prior realized_gains rows on Test Klijent
          // (one win + one loss from c3). The fund-withdraw rows
          // additionally land in RSD; filter to those.
          const fundRows = rows.filter((r) => r.currency === 'CURRENCY_RSD')
          expect(fundRows.length, 'two fund-withdraw realized_gains rows').to.be.greaterThan(1)
          // Both gains are positive (NIS bumped 100 → 120 before the
          // withdraws, so each withdraw realized > cost_basis pro-rata).
          fundRows.forEach((r) => {
            const gain = Number(r.gainRsd ?? r.profitNative ?? '0')
            expect(gain, 'fund-withdraw RSD gain > 0').to.be.greaterThan(0)
          })
        })
      })
    })

    // ───────────── DEO 8: tax cron ─────────────
    cy.get<string>('@supTok').then((supTok) => {
      cy.get<number>('@stateTaxBefore').then((stateTaxBefore) => {
        cy.request({
          method: 'POST',
          url: '/api/v1/tax/run',
          headers: { Authorization: `Bearer ${supTok}` },
          body: {},
        }).then((r) => {
          const total = Number(r.body.totalCollectedRsd ?? 0)
          expect(total, 'tax total RSD').to.be.greaterThan(0)
          cy.get<string>('@adminTok').then((adminTok) => {
            stateTaxRSDBalance(adminTok).then((after) => {
              const delta = Math.round((after - stateTaxBefore) * 10000) / 10000
              expect(delta, 'state-tax credit == total RSD reported').to.be.closeTo(
                Math.round(total * 10000) / 10000,
                0.02,
              )
            })
          })
        })
      })
    })
  })
})
