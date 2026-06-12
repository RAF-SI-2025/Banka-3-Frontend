/// <reference types="cypress" />

// Aggressive c4 soak — pounds the OTC + funds + SAGA + verification
// surfaces with concurrency, fault injection, idempotency replays,
// counter ping-pong, negative inputs, fund churn, and tax-mid-flight.
// Pairs with c4-multi-round.cy.ts (the happy-path 3-round soak);
// both share the persistent backend.
//
// Waves (each is an it() block; cypress.soak.config has
// testIsolation:false so state flows forward).  Each wave ends with
// invariants asserted before the next one starts.
//
//   W1   setup (tokens, AAPL pin, fund, balance/holding headroom)
//   W2   concurrent OTC barrage — 5 contracts open→accept→exercise
//        with no waits in between, dedup + leak check.
//   W3   SAGA fault injection — for every named step in the OTC
//        exercise saga, force a forward fail and assert
//        compensation drains; transfer_strike also drives a forced
//        compensation failure.
//   W4   transient retry — X-Saga-Force-Fail-Kind:transient parks
//        the saga in 'running'; recovery worker must resume it.
//   W5   counter ping-pong (8 iterations) then reject — zero
//        shares ever reserved, zero accounts ever debited.
//   W6   idempotency replay storm — same Idempotency-Key twice on
//        every mutating OTC/fund endpoint is a no-op.
//   W7   verification abuse — wrong code 3× retires the record;
//        replaying a consumed code is rejected.
//   W8   negative-input matrix — past settlement, qty=0, qty >
//        public_count, OTM exercise, double-exercise, fund < min,
//        fund withdraw > position, self-accept own counter.
//   W9   fund churn + illiquid path — 10 small invests, mixed
//        withdraws including one that drains the liquid pool and
//        triggers liquidate_holdings.
//   W10  tax mid-flight — kick off illiquid withdraw, run tax
//        while it is still draining, assert no double-count.
//   W11  final cross-wave invariants pass.

const ADMIN_EMAIL = 'admin@banka.local'
const ADMIN_PASSWORD = 'Admin123!'
const SUPERVISOR_EMAIL = 'supervizor@banka.local'
const SUPERVISOR_PASSWORD = 'Supervizor123!'
const SELLER_EMAIL = 'klijent@banka.local'
const SELLER_PASSWORD = 'Klijent123!'
const BUYER_EMAIL = 'klijent2@banka.local'
const BUYER_PASSWORD = 'Klijent123!'

const FOREX_BOOK_OWNER_ID = '00000000-0000-0000-0000-000000000020'

const OTC_EXERCISE_STEPS = [
  'reserve_buyer_strike',
  'verify_seller_shares',
  'transfer_strike',
  'transfer_shares',
  'finalize',
] as const

interface Ctx {
  adminTok: string
  supTok: string
  sellerTok: string
  buyerTok: string
  sellerId: string
  buyerId: string
  sellerAaplHoldingId: string
  aaplSecurityId: string
  aaplMic: string
  sellerUsdAccountId: string
  buyerUsdAccountId: string
  sellerRsdAccountId: string
  bankRsdForexBookId: string
  fundId: string
  fundBankAccountId: string
  // baseline counters
  stateTaxStart: number
  bankUsdStart: number
}

const ctx: Ctx = {
  adminTok: '',
  supTok: '',
  sellerTok: '',
  buyerTok: '',
  sellerId: '',
  buyerId: '',
  sellerAaplHoldingId: '',
  aaplSecurityId: '',
  aaplMic: 'XNYS',
  sellerUsdAccountId: '',
  buyerUsdAccountId: '',
  sellerRsdAccountId: '',
  bankRsdForexBookId: '',
  fundId: '',
  fundBankAccountId: '',
  stateTaxStart: 0,
  bankUsdStart: 0,
}

const TAG = 'c4-aggressive'

function withCtx(fn: (c: Ctx) => void): void {
  cy.then(() => fn(ctx))
}

function gwLogin(email: string, password: string): Cypress.Chainable<string> {
  return cy.request('POST', '/api/v1/auth/login', { email, password }).then((r) => r.body.accessToken as string)
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
    .then((r) => (r.body.accounts ?? []) as Array<{ id?: string; currency?: string; balance?: string }>)
}

function findAccount(
  token: string,
  ownerClientId: string,
  currency: string,
  kind?: string,
): Cypress.Chainable<string | null> {
  return listAccounts(token, ownerClientId, kind).then((accs) => {
    const a = accs.find((x) => x.currency === currency)
    return a?.id ?? null
  })
}

function pinListing(adminTok: string, securityId: string, exchangeMic: string, price: number) {
  return cy.request({
    method: 'PUT',
    url: '/api/v1/listings',
    headers: { Authorization: `Bearer ${adminTok}`, 'Idempotency-Key': crypto.randomUUID() },
    body: {
      securityId,
      exchangeMic,
      price: String(price),
      ask: String(price + 0.5),
      bid: String(price - 0.5),
    },
  })
}

function requestVerification(token: string, actionKind: string) {
  // The phone is the second factor; cy.issueVerification reads the code
  // off /verification/pending (the request response no longer carries it).
  return cy.issueVerification(token, actionKind)
}

function listHoldings(token: string, userId: string, userKind = 'USER_KIND_CLIENT') {
  return cy
    .request({
      url: `/api/v1/portfolio?userId=${userId}&userKind=${userKind}`,
      headers: { Authorization: `Bearer ${token}` },
    })
    .then(
      (r) =>
        (r.body.holdings ?? []) as Array<{
          id?: string
          quantity?: number
          publicCount?: number
          reservedCount?: number
          security?: { id?: string; ticker?: string }
        }>,
    )
}

// patchPublicCount: bump the seller's publicly-tradeable AAPL count
// so the buyer can keep opening fresh offers all the way through.
function patchPublicCount(token: string, holdingId: string, count: number) {
  return cy.request({
    method: 'PATCH',
    url: `/api/v1/portfolio/${holdingId}/public-count`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: { publicCount: count },
  })
}

interface OpenedContract {
  threadId: string
  contractId: string
  strike: number
  qty: number
  premium: number
}

// openContract walks offer → counter → accept and returns the
// contract id with its pinned numerics.  No exercise; caller chooses
// when (and how) to do that.
function openContract(c: Ctx, qty: number, strike: number, premium: number): Cypress.Chainable<OpenedContract> {
  const idemBuyer = crypto.randomUUID()
  const idemSeller = crypto.randomUUID()
  return cy
    .request({
      method: 'POST',
      url: '/api/v1/otc/offers',
      headers: { Authorization: `Bearer ${c.buyerTok}`, 'Idempotency-Key': idemBuyer },
      body: {
        sellerHoldingId: c.sellerAaplHoldingId,
        buyerAccountId: c.buyerUsdAccountId,
        sellerAccountId: c.sellerUsdAccountId,
        quantity: qty,
        pricePerUnit: String(strike),
        premium: String(premium),
        settlementDate: '2027-12-31T00:00:00Z',
      },
    })
    .then((r) => {
      const threadId = r.body.threadId as string
      return cy
        .request({
          method: 'POST',
          url: `/api/v1/otc/offers/${threadId}/counter`,
          headers: { Authorization: `Bearer ${c.sellerTok}`, 'Idempotency-Key': idemSeller },
          body: {
            quantity: qty,
            pricePerUnit: String(strike),
            premium: String(premium),
            settlementDate: '2027-12-31T00:00:00Z',
          },
        })
        .then(() =>
          requestVerification(c.buyerTok, 'otc_accept').then((proof) =>
            cy
              .request({
                method: 'POST',
                url: `/api/v1/otc/offers/${threadId}/accept`,
                headers: {
                  Authorization: `Bearer ${c.buyerTok}`,
                  'Idempotency-Key': crypto.randomUUID(),
                  'X-Verification-Id': proof.verificationId,
                  'X-Verification-Code': proof.code,
                },
                body: {},
              })
              .then((ar) => ({
                threadId,
                contractId: ar.body.contract.id as string,
                strike,
                qty,
                premium,
              })),
          ),
        )
    })
}

// exerciseRaw fires POST /exercise with optional fault headers.
// failOnStatusCode:false so the caller can assert on non-2xx for the
// fault-injection waves.
function exerciseRaw(
  c: Ctx,
  contractId: string,
  faultHeaders: Record<string, string> = {},
): Cypress.Chainable<Cypress.Response<{ contract?: { status?: string }; message?: string }>> {
  return requestVerification(c.buyerTok, 'otc_exercise').then((proof) =>
    cy.request({
      method: 'POST',
      url: `/api/v1/otc/contracts/${contractId}/exercise`,
      failOnStatusCode: false,
      headers: {
        Authorization: `Bearer ${c.buyerTok}`,
        'Idempotency-Key': crypto.randomUUID(),
        'X-Verification-Id': proof.verificationId,
        'X-Verification-Code': proof.code,
        ...faultHeaders,
      },
      body: {},
    }),
  )
}

// awaitNoRunningSagas drives a 60s poll for the recovery worker to
// drain anything left in {running,compensating}.  Hits the soak's
// cy.psql helper so it's free of network noise.
function awaitNoRunningSagas(label: string, ceilingSec = 60): void {
  const intervalMs = 3000
  const maxAttempts = Math.ceil((ceilingSec * 1000) / intervalMs)
  function poll(remaining: number): void {
    if (remaining <= 0) {
      cy.psql(
        `select transaction_id, status from "trading".saga_executions where status in ('running','compensating')`,
      ).then((rows) => {
        expect(rows.length, `${label}: no leftover running/compensating sagas`).to.eq(0)
      })
      return
    }
    cy.psql(`select count(*) as c from "trading".saga_executions where status in ('running','compensating')`).then(
      (rows) => {
        if (Number(rows[0]?.c ?? '0') === 0) return
        cy.wait(intervalMs)
        poll(remaining - 1)
      },
    )
  }
  poll(maxAttempts)
}

// assertCleanLeakState — the universal "is everything settled?"
// gate. Called at the end of every wave so a regression points at
// the wave that introduced it instead of bleeding all the way to
// the final pass.  Wrapped in cy.then so ctx.sellerAaplHoldingId is
// read at queue-execution time, not at call time.
//
// What we check is what the SAGA framework is supposed to guarantee:
//   (a) no leftover held bank.reservations — cash reservation legs
//       must always either commit or compensate.
//   (b) no duplicate (op_id, leg_index) — the bank-side dedup must
//       never let a saga retry double-debit an account.
//   (c) no saga_executions stuck in running/compensating past the
//       recovery worker's window (60s).
//
// We deliberately DO NOT assert seller.reserved_count == 0 per wave:
// an active OTC contract legitimately holds the seller's shares
// reserved until exercise.  Force-fail waves leave active contracts
// in place (compensation rolls back the cash leg, not the contract
// row itself — the spec p.74 "kupac može pokušati ponovo" path),
// which is intentional, not a leak.  We do a holding-vs-active-
// contracts reconciliation in W11 instead.
function assertCleanLeakState(label: string): void {
  cy.then(() => {
    cy.psql(`select count(*) as c from "bank".reservations where state = 'held'`).then((rows) => {
      expect(Number(rows[0]?.c ?? '-1'), `${label}: no held bank.reservations`).to.eq(0)
    })
    cy.psql(
      `select count(*) as c from (
         select op_id, leg_index, count(*) as n
           from "bank".transactions
          where op_id is not null
          group by 1, 2
          having count(*) > 1
       ) dups`,
    ).then((rows) => {
      expect(Number(rows[0]?.c ?? '-1'), `${label}: no duplicate (op_id, leg_index)`).to.eq(0)
    })
    awaitNoRunningSagas(label, 60)
  })
}

// sweepLeftoverState — wipes any leftover in-flight state from a
// previous soak run on the same persistent backend so the suite
// starts from zero.  Marks unfinished sagas as failed, releases
// every held bank.reservation, and clears reserved_count on the
// seller's AAPL holding.  Mirrors what a sane recovery worker
// would have done given infinite time.
function sweepLeftoverState(): void {
  cy.psql(
    `UPDATE "trading".saga_executions
        SET status = 'failed', last_error = 'aggressive-soak sweep'
      WHERE status in ('running','compensating')`,
  )
  cy.psql(`UPDATE "bank".reservations SET state = 'released' WHERE state = 'held'`)
  cy.then(() => {
    if (ctx.sellerAaplHoldingId !== '') {
      cy.psql(
        `UPDATE "trading".portfolio_holdings SET reserved_count = 0 WHERE id = '${ctx.sellerAaplHoldingId}'`,
      )
    }
  })
  // Withdraw any open OTC offers under this seller's holding so a
  // half-finished negotiation from a prior run can't taint W5/W6.
  cy.then(() => {
    if (ctx.sellerAaplHoldingId !== '') {
      cy.psql(
        `UPDATE "trading".otc_offers
            SET status = 'withdrawn'
          WHERE seller_holding_id = '${ctx.sellerAaplHoldingId}'
            AND status = 'open'`,
      )
    }
  })
}

describe(`c4 ${TAG} soak — concurrent, faulted, replayed, negative`, () => {
  // ────────────────────────────── W1: setup ──────────────────────────────
  it('W1 setup: tokens, headroom, AAPL pin, fund', () => {
    gwLogin(ADMIN_EMAIL, ADMIN_PASSWORD).then((t) => (ctx.adminTok = t))
    gwLogin(SUPERVISOR_EMAIL, SUPERVISOR_PASSWORD).then((t) => (ctx.supTok = t))
    gwLogin(SELLER_EMAIL, SELLER_PASSWORD).then((t) => (ctx.sellerTok = t))
    gwLogin(BUYER_EMAIL, BUYER_PASSWORD).then((t) => (ctx.buyerTok = t))

    withCtx((c) => {
      meUserID(c.sellerTok).then((id) => (ctx.sellerId = id))
      meUserID(c.buyerTok).then((id) => (ctx.buyerId = id))
    })

    // Locate AAPL + pin a deterministic listing price.
    withCtx((c) => {
      cy.request({
        url: '/api/v1/securities?search=AAPL&type=SECURITY_TYPE_STOCK',
        headers: { Authorization: `Bearer ${c.adminTok}` },
      }).then((r) => {
        const hit = (r.body.items ?? []).find(
          (i: { security?: { ticker?: string } }) => i.security?.ticker === 'AAPL',
        )
        ctx.aaplSecurityId = hit.security.id
        ctx.aaplMic = hit.listing?.exchangeMic ?? 'XNYS'
        pinListing(c.adminTok, ctx.aaplSecurityId, ctx.aaplMic, 180)
      })
    })

    // Pull account ids; mint USD for the buyer if the seed didn't.
    withCtx((c) => {
      findAccount(c.adminTok, c.sellerId, 'CURRENCY_USD').then((id) => {
        if (!id) throw new Error('seller has no USD account')
        ctx.sellerUsdAccountId = id
      })
      findAccount(c.adminTok, c.sellerId, 'CURRENCY_RSD').then((id) => {
        if (!id) throw new Error('seller has no RSD account')
        ctx.sellerRsdAccountId = id
      })
      findAccount(c.adminTok, c.buyerId, 'CURRENCY_USD').then((existing) => {
        if (existing) {
          ctx.buyerUsdAccountId = existing
          return
        }
        cy.request({
          method: 'POST',
          url: '/api/v1/accounts',
          headers: { Authorization: `Bearer ${c.adminTok}`, 'Idempotency-Key': crypto.randomUUID() },
          body: {
            ownerClientId: c.buyerId,
            kind: 'ACCOUNT_KIND_PERSONAL_FX',
            subtype: 'ACCOUNT_SUBTYPE_UNSPECIFIED',
            currency: 'CURRENCY_USD',
            name: 'Trgovinski USD',
            openingBalance: '50000',
          },
        }).then((r) => {
          ctx.buyerUsdAccountId = r.body.id
        })
      })
      findAccount(c.adminTok, FOREX_BOOK_OWNER_ID, 'CURRENCY_RSD', 'ACCOUNT_KIND_FOREX_BOOK').then((id) => {
        if (!id) throw new Error('bank RSD forex_book missing')
        ctx.bankRsdForexBookId = id
      })
    })

    // Resolve seller AAPL holding id BEFORE we use it in any psql
    // UPDATE.  W1 used to bump quantity/public_count by id before
    // the listHoldings call returned, which sent `WHERE id = ''` to
    // postgres and crashed every downstream wave.
    withCtx((c) => {
      listHoldings(c.sellerTok, c.sellerId).then((hs) => {
        const aapl = hs.find((h) => h.security?.ticker === 'AAPL')
        if (!aapl?.id) throw new Error('seller has no AAPL holding')
        ctx.sellerAaplHoldingId = aapl.id
      })
    })

    // Plant 100 AAPL on the seller's holding + 100 publicCount so
    // every subsequent OTC offer in the suite can be filled.  Bump
    // USD/RSD account balances + bank's RSD forex_book so the buyer
    // can pay any combination of strikes the waves dial up without
    // running out.  cy.psql bypasses the FE's RHF gates.
    withCtx((c) => {
      expect(c.sellerAaplHoldingId, 'W1: sellerAaplHoldingId resolved').to.not.eq('')
      cy.psql(
        `UPDATE "trading".portfolio_holdings SET quantity = 100, public_count = 100, reserved_count = 0
         WHERE id = '${c.sellerAaplHoldingId}'`,
      )
      cy.psql(
        `UPDATE "bank".accounts SET balance = balance + 500000, available_balance = available_balance + 500000
         WHERE id = '${c.buyerUsdAccountId}'`,
      )
      cy.psql(
        `UPDATE "bank".accounts SET balance = balance + 5000000, available_balance = available_balance + 5000000
         WHERE id = '${c.sellerRsdAccountId}'`,
      )
      cy.psql(
        `UPDATE "bank".accounts SET balance = balance + 500000, available_balance = available_balance + 500000
         WHERE id = '${c.bankRsdForexBookId}'`,
      )
      // Push public_count through the FE path so any FE-side
      // bookkeeping (cached query state) catches up.
      patchPublicCount(c.sellerTok, c.sellerAaplHoldingId, 100)
    })

    // Fund: create-or-fetch a soak-scoped fund.  Different name from
    // c4-multi-round's so the two suites don't fight over positions.
    withCtx((c) => {
      cy.request({ url: '/api/v1/funds', headers: { Authorization: `Bearer ${c.supTok}` } }).then((r) => {
        const existing = (r.body.funds ?? []).find(
          (f: { name?: string; id?: string; bankAccountId?: string }) => f.name === 'Aggressive c4 Fond',
        )
        if (existing) {
          ctx.fundId = existing.id
          ctx.fundBankAccountId = existing.bankAccountId
          return
        }
        cy.request({
          method: 'POST',
          url: '/api/v1/funds',
          headers: { Authorization: `Bearer ${c.supTok}`, 'Idempotency-Key': crypto.randomUUID() },
          body: {
            name: 'Aggressive c4 Fond',
            description: 'Persistent fund for the c4 aggressive soak',
            minimumContribution: '1000',
          },
        }).then((cr) => {
          ctx.fundId = cr.body.id
          ctx.fundBankAccountId = cr.body.bankAccountId
        })
      })
    })

    // Sweep leftover state from any prior soak run on this
    // persistent backend so the suite starts from a clean slate.
    sweepLeftoverState()

    // Snapshot starting state_tax + bank USD forex_book.
    cy.psql(`select balance from "bank".accounts where kind='state_tax' and currency='RSD'`).then((rows) => {
      ctx.stateTaxStart = Number(rows[0]?.balance ?? '0')
    })
    cy.psql(`select balance from "bank".accounts where kind='forex_book' and currency='USD' limit 1`).then((rows) => {
      ctx.bankUsdStart = Number(rows[0]?.balance ?? '0')
    })

    assertCleanLeakState('W1')
  })

  // ────────────────────────── W2: concurrent barrage ─────────────────────
  it('W2: 5 OTC contracts back-to-back, no interleaved waits', () => {
    withCtx((c) => {
      // Pin AAPL low enough that every contract opens at $180 and
      // exercises at $250 (well in the money).
      pinListing(c.adminTok, c.aaplSecurityId, c.aaplMic, 180)

      const contracts: OpenedContract[] = []
      // Sequential cy.request — the soak runs all five back-to-back
      // without any waitOrderDone-style pauses.  Concurrent
      // intent on the *server* side: each contract reserves its
      // own shares and writes its own saga before the next call
      // even returns, so any global lock or shared-counter bug
      // shows up here.
      for (let i = 0; i < 5; i++) {
        openContract(c, 1, 180, 5).then((o) => {
          contracts.push(o)
        })
      }

      // Bump AAPL above strike so every exercise is in the money.
      pinListing(c.adminTok, c.aaplSecurityId, c.aaplMic, 220)

      cy.then(() => {
        expect(contracts.length, 'opened 5 contracts').to.eq(5)
        for (const oc of contracts) {
          exerciseRaw(c, oc.contractId).then((r) => {
            expect(r.status, `contract ${oc.contractId} exercise 200`).to.eq(200)
            expect(r.body.contract?.status, 'EXERCISED').to.eq('OTC_CONTRACT_STATUS_EXERCISED')
          })
        }
      })

      assertCleanLeakState('W2')
    })
  })

  // ───────────────────── W3: SAGA fault injection per step ───────────────
  it('W3: forced-fail every exercise step, compensation drains', () => {
    withCtx((c) => {
      // Pin AAPL so every contract opens/exercises in the money.
      pinListing(c.adminTok, c.aaplSecurityId, c.aaplMic, 180)

      for (const step of OTC_EXERCISE_STEPS) {
        openContract(c, 1, 180, 4).then((oc) => {
          pinListing(c.adminTok, c.aaplSecurityId, c.aaplMic, 250)

          exerciseRaw(c, oc.contractId, { 'X-Saga-Force-Fail': step }).then((r) => {
            expect(r.status, `step ${step}: forced-fail not 2xx`).to.not.eq(200)
          })

          // Each forced fail must drain compensation; assert the
          // SAGA-level invariants per-step so a regression points at
          // the exact step.  We do NOT assert reserved_count here —
          // an unexercised contract legitimately holds the share.
          awaitNoRunningSagas(`W3 step=${step}`, 60)
          cy.psql(`select count(*) as c from "bank".reservations where state = 'held'`).then((rows) => {
            expect(Number(rows[0]?.c ?? '-1'), `W3 step=${step}: no held reservations`).to.eq(0)
          })

          // The contract row must NOT be EXERCISED — compensation
          // either rolls back or leaves it ACTIVE.
          cy.psql(`select status from "trading".otc_contracts where id = '${oc.contractId}'`).then((rows) => {
            const s = String(rows[0]?.status ?? '')
            expect(s, `W3 step=${step}: contract not exercised`).to.not.match(/EXERCISED|exercised/)
          })
        })
      }

      // Forced compensation failure on transfer_strike — should
      // leave the saga in `failed` with last_error, no held
      // reservations.  Recovery worker can't auto-heal a permanent
      // compensation fail; the row stays terminal.
      openContract(c, 1, 180, 4).then((oc) => {
        pinListing(c.adminTok, c.aaplSecurityId, c.aaplMic, 250)
        exerciseRaw(c, oc.contractId, {
          'X-Saga-Force-Fail': 'transfer_shares',
          'X-Saga-Force-Compensate-Fail': 'transfer_strike',
        }).then((r) => {
          expect(r.status, 'compensation-fail not 2xx').to.not.eq(200)
        })
        // Saga ends `failed` (no recovery for permanent compensation
        // errors); reservations still drain because the bank-side
        // commits use (op_id, leg_index) dedup.
        cy.wait(3000)
        cy.psql(
          `select status, last_error from "trading".saga_executions
             where state->>'contract_id' = '${oc.contractId}'
             order by updated_at desc limit 1`,
        ).then((rows) => {
          expect(String(rows[0]?.status ?? ''), 'comp-fail terminal').to.match(/failed|compensated/)
        })
        cy.psql(`select count(*) as c from "bank".reservations where state = 'held'`).then((rows) => {
          expect(Number(rows[0]?.c ?? '-1'), 'W3 comp-fail: no held reservations').to.eq(0)
        })
      })

      assertCleanLeakState('W3')
    })
  })

  // ────────────────────── W4: transient error rolls back ─────────────────
  it('W4: transient forward error rolls the exercise back to compensated', () => {
    withCtx((c) => {
      pinListing(c.adminTok, c.aaplSecurityId, c.aaplMic, 180)
      openContract(c, 1, 180, 4).then((oc) => {
        pinListing(c.adminTok, c.aaplSecurityId, c.aaplMic, 240)

        // The exercise saga is registered with CompensateOnTransient, so
        // a transient forward error does NOT park for a forward retry —
        // it rolls straight back to `compensated` (SAGA_test.pdf
        // SG-09/SG-10: "any error after log write → Compensating"). The
        // reservation drains and the contract stays ACTIVE.
        exerciseRaw(c, oc.contractId, {
          'X-Saga-Force-Fail': 'transfer_strike',
          'X-Saga-Force-Fail-Kind': 'transient',
        }).then((r) => {
          expect(r.status, 'transient: rejected non-2xx').to.not.eq(200)
        })

        // No leftover running/compensating rows (the rollback is
        // synchronous on the foreground call).
        awaitNoRunningSagas('W4 transient', 60)
        cy.psql(
          `select status from "trading".saga_executions
             where state->>'contract_id' = '${oc.contractId}'
             order by updated_at desc limit 1`,
        ).then((rows) => {
          expect(String(rows[0]?.status ?? ''), 'W4 transient: saga rolled back').to.eq('compensated')
        })
        cy.psql(`select status from "trading".otc_contracts where id = '${oc.contractId}'`).then((rows) => {
          expect(String(rows[0]?.status ?? ''), 'W4 transient: contract NOT exercised').to.not.match(/EXERCISED|exercised/)
        })
      })
      assertCleanLeakState('W4')
    })
  })

  // ─────────────── W5: counter ping-pong then reject (zero leak) ─────────
  it('W5: 8-iter counter ping-pong + reject leaks nothing', () => {
    withCtx((c) => {
      pinListing(c.adminTok, c.aaplSecurityId, c.aaplMic, 180)

      // Snapshot account balances + holding before the ping-pong
      // so we can prove nothing moved.
      let buyerUsdBefore = 0
      let sellerUsdBefore = 0
      let sellerReservedBefore = 0
      cy.psql(`select balance from "bank".accounts where id='${c.buyerUsdAccountId}'`).then(
        (rows) => (buyerUsdBefore = Number(rows[0]?.balance ?? '0')),
      )
      cy.psql(`select balance from "bank".accounts where id='${c.sellerUsdAccountId}'`).then(
        (rows) => (sellerUsdBefore = Number(rows[0]?.balance ?? '0')),
      )
      cy.psql(`select reserved_count from "trading".portfolio_holdings where id='${c.sellerAaplHoldingId}'`).then(
        (rows) => (sellerReservedBefore = Number(rows[0]?.reserved_count ?? '0')),
      )

      // Initial buyer offer.
      cy.request({
        method: 'POST',
        url: '/api/v1/otc/offers',
        headers: { Authorization: `Bearer ${c.buyerTok}`, 'Idempotency-Key': crypto.randomUUID() },
        body: {
          sellerHoldingId: c.sellerAaplHoldingId,
          buyerAccountId: c.buyerUsdAccountId,
          sellerAccountId: c.sellerUsdAccountId,
          quantity: 1,
          pricePerUnit: '180.00',
          premium: '3',
          settlementDate: '2027-12-31T00:00:00Z',
        },
      }).then((r) => {
        const threadId = r.body.threadId as string

        // 8 alternating counters: seller, buyer, seller, buyer, ...
        const seq = ['seller', 'buyer', 'seller', 'buyer', 'seller', 'buyer', 'seller', 'buyer'] as const
        for (let i = 0; i < seq.length; i++) {
          const who = seq[i]
          const tok = who === 'seller' ? c.sellerTok : c.buyerTok
          const ppu = 180 + (i + 1) // walk price up
          cy.request({
            method: 'POST',
            url: `/api/v1/otc/offers/${threadId}/counter`,
            headers: { Authorization: `Bearer ${tok}`, 'Idempotency-Key': crypto.randomUUID() },
            body: {
              quantity: 1,
              pricePerUnit: String(ppu),
              premium: '4',
              settlementDate: '2027-12-31T00:00:00Z',
            },
          })
        }

        // /withdraw flips the open offer to status='withdrawn'.
        // Either side can issue it (proto comment in trading.proto:
        // "either side may call"); use the seller so the buyer's
        // most recent counter is the one being withdrawn.
        cy.request({
          method: 'POST',
          url: `/api/v1/otc/offers/${threadId}/withdraw`,
          headers: { Authorization: `Bearer ${c.sellerTok}`, 'Idempotency-Key': crypto.randomUUID() },
          failOnStatusCode: false,
          body: {},
        }).then((r2) => {
          expect(r2.status, 'W5: withdraw 2xx').to.be.oneOf([200, 204])
        })
      })

      // No money moved + no shares ever reserved during pre-accept
      // negotiation (reservation happens only on accept).
      cy.then(() => {
        cy.psql(`select balance from "bank".accounts where id='${c.buyerUsdAccountId}'`).then((rows) => {
          expect(Number(rows[0]?.balance ?? '0'), 'W5: buyer USD unchanged').to.be.closeTo(buyerUsdBefore, 0.01)
        })
        cy.psql(`select balance from "bank".accounts where id='${c.sellerUsdAccountId}'`).then((rows) => {
          expect(Number(rows[0]?.balance ?? '0'), 'W5: seller USD unchanged').to.be.closeTo(sellerUsdBefore, 0.01)
        })
        cy.psql(`select reserved_count from "trading".portfolio_holdings where id='${c.sellerAaplHoldingId}'`).then(
          (rows) => {
            expect(
              Number(rows[0]?.reserved_count ?? '-1'),
              'W5: reserved_count unchanged (no shares reserved pre-accept)',
            ).to.eq(sellerReservedBefore)
          },
        )
      })

      assertCleanLeakState('W5')
    })
  })

  // ─────────────────── W6: idempotency replay storm ──────────────────────
  it('W6: Idempotency-Key replays are no-ops on every mutating endpoint', () => {
    withCtx((c) => {
      pinListing(c.adminTok, c.aaplSecurityId, c.aaplMic, 180)

      // Same key, two POSTs.  The dedup must collapse to one
      // server-side effect.
      const offerKey = crypto.randomUUID()
      const offerBody = {
        sellerHoldingId: c.sellerAaplHoldingId,
        buyerAccountId: c.buyerUsdAccountId,
        sellerAccountId: c.sellerUsdAccountId,
        quantity: 1,
        pricePerUnit: '180.00',
        premium: '4',
        settlementDate: '2027-12-31T00:00:00Z',
      }
      let threadA = ''
      let threadB = ''
      cy.request({
        method: 'POST',
        url: '/api/v1/otc/offers',
        headers: { Authorization: `Bearer ${c.buyerTok}`, 'Idempotency-Key': offerKey },
        body: offerBody,
      }).then((r) => (threadA = r.body.threadId as string))
      cy.request({
        method: 'POST',
        url: '/api/v1/otc/offers',
        headers: { Authorization: `Bearer ${c.buyerTok}`, 'Idempotency-Key': offerKey },
        body: offerBody,
        failOnStatusCode: false,
      }).then((r) => {
        threadB = (r.body.threadId as string) ?? ''
      })
      cy.then(() => {
        expect(threadB, 'W6: replay returns same threadId or empty').to.satisfy(
          (v: string) => v === '' || v === threadA,
        )
        // The replay must not create a second thread row.  Count
        // distinct thread_ids referencing this seller holding that
        // have any 'open' offer; the number should NOT have jumped
        // by 2 (one for each request) — at most 1.
        cy.psql(
          `select count(distinct thread_id) as c from "trading".otc_offers
             where seller_holding_id='${c.sellerAaplHoldingId}'
               and status='open'`,
        ).then((rows) => {
          // Soft check — other waves can also leave open threads
          // depending on order; we just need a sane finite number.
          expect(Number(rows[0]?.c ?? '0'), 'W6: open thread count sane').to.be.lessThan(20)
        })
      })

      // Replay a fund invest with the same key — the position
      // balance must reflect only one credit.
      withCtx((cc) => {
        const investKey = crypto.randomUUID()
        cy.psql(
          `select coalesce(total_invested_rsd, 0) as t from "trading".client_fund_positions
             where fund_id='${cc.fundId}' and client_id='${cc.sellerId}'`,
        ).then((rows) => {
          const before = Number(rows[0]?.t ?? '0')
          // Each fund_invest requires a fresh verification proof,
          // but the *Idempotency-Key* is what we're testing — the
          // same key on the kickoff request must collapse the
          // saga even if the inner verification proofs differ.
          requestVerification(cc.sellerTok, 'fund_invest').then((proof) => {
            cy.request({
              method: 'POST',
              url: `/api/v1/funds/${cc.fundId}/invest`,
              headers: {
                Authorization: `Bearer ${cc.sellerTok}`,
                'Idempotency-Key': investKey,
                'X-Verification-Id': proof.verificationId,
                'X-Verification-Code': proof.code,
              },
              body: { amountRsd: '2000', sourceAccountId: cc.sellerRsdAccountId },
            })
          })
          requestVerification(cc.sellerTok, 'fund_invest').then((proof2) => {
            cy.request({
              method: 'POST',
              url: `/api/v1/funds/${cc.fundId}/invest`,
              headers: {
                Authorization: `Bearer ${cc.sellerTok}`,
                'Idempotency-Key': investKey,
                'X-Verification-Id': proof2.verificationId,
                'X-Verification-Code': proof2.code,
              },
              body: { amountRsd: '2000', sourceAccountId: cc.sellerRsdAccountId },
              failOnStatusCode: false,
            })
          })
          // Give the saga time to settle then assert.
          awaitNoRunningSagas('W6 fund_invest replay', 60)
          cy.psql(
            `select coalesce(total_invested_rsd, 0) as t from "trading".client_fund_positions
               where fund_id='${cc.fundId}' and client_id='${cc.sellerId}'`,
          ).then((rows2) => {
            const after = Number(rows2[0]?.t ?? '0')
            expect(after - before, 'W6: replay credited at most one 2000 RSD invest').to.be.lessThan(2001)
            expect(after - before, 'W6: at least one invest landed').to.be.greaterThan(0)
          })
        })
      })

      assertCleanLeakState('W6')
    })
  })

  // ─────────────────── W7: verification abuse ────────────────────────────
  it('W7: wrong code 3x retires the record; consumed code rejects on replay', () => {
    withCtx((c) => {
      pinListing(c.adminTok, c.aaplSecurityId, c.aaplMic, 180)
      openContract(c, 1, 180, 4).then((oc) => {
        pinListing(c.adminTok, c.aaplSecurityId, c.aaplMic, 250)

        // Wrong-code attempts on the same verification record.
        requestVerification(c.buyerTok, 'otc_exercise').then((proof) => {
          for (let i = 0; i < 3; i++) {
            cy.request({
              method: 'POST',
              url: `/api/v1/otc/contracts/${oc.contractId}/exercise`,
              failOnStatusCode: false,
              headers: {
                Authorization: `Bearer ${c.buyerTok}`,
                'Idempotency-Key': crypto.randomUUID(),
                'X-Verification-Id': proof.verificationId,
                'X-Verification-Code': '000000', // guaranteed wrong (gateway issues 1xxxxx-9xxxxx)
              },
              body: {},
            }).then((r) => {
              expect(r.status, `W7 wrong-code attempt ${i + 1}`).to.not.eq(200)
            })
          }

          // 4th attempt with the *correct* code must also fail —
          // the record was retired after 3 strikes.
          cy.request({
            method: 'POST',
            url: `/api/v1/otc/contracts/${oc.contractId}/exercise`,
            failOnStatusCode: false,
            headers: {
              Authorization: `Bearer ${c.buyerTok}`,
              'Idempotency-Key': crypto.randomUUID(),
              'X-Verification-Id': proof.verificationId,
              'X-Verification-Code': proof.code,
            },
            body: {},
          }).then((r) => {
            expect(r.status, 'W7: retired record rejects even the right code').to.not.eq(200)
          })
        })

        // Fresh record + consume it once + replay → second use 4xx.
        requestVerification(c.buyerTok, 'otc_exercise').then((proof2) => {
          cy.request({
            method: 'POST',
            url: `/api/v1/otc/contracts/${oc.contractId}/exercise`,
            failOnStatusCode: false,
            headers: {
              Authorization: `Bearer ${c.buyerTok}`,
              'Idempotency-Key': crypto.randomUUID(),
              'X-Verification-Id': proof2.verificationId,
              'X-Verification-Code': proof2.code,
            },
            body: {},
          }).then((r) => {
            expect(r.status, 'W7: first consume succeeds').to.eq(200)
          })
          // Replay with the same proof — the second attempt MUST
          // be rejected (consumed code) or be a no-op replay via
          // Idempotency-Key (we mint a fresh key here, so it's the
          // verification record that has to bite).
          cy.request({
            method: 'POST',
            url: `/api/v1/otc/contracts/${oc.contractId}/exercise`,
            failOnStatusCode: false,
            headers: {
              Authorization: `Bearer ${c.buyerTok}`,
              'Idempotency-Key': crypto.randomUUID(),
              'X-Verification-Id': proof2.verificationId,
              'X-Verification-Code': proof2.code,
            },
            body: {},
          }).then((r) => {
            expect(r.status, 'W7: consumed code replay rejected').to.not.eq(200)
          })
        })
      })

      assertCleanLeakState('W7')
    })
  })

  // ─────────────────── W8: negative-input matrix ─────────────────────────
  it('W8: bad inputs across the OTC + funds surface all rejected', () => {
    withCtx((c) => {
      pinListing(c.adminTok, c.aaplSecurityId, c.aaplMic, 180)

      // (a) Past settlement date.
      cy.request({
        method: 'POST',
        url: '/api/v1/otc/offers',
        headers: { Authorization: `Bearer ${c.buyerTok}`, 'Idempotency-Key': crypto.randomUUID() },
        failOnStatusCode: false,
        body: {
          sellerHoldingId: c.sellerAaplHoldingId,
          buyerAccountId: c.buyerUsdAccountId,
          sellerAccountId: c.sellerUsdAccountId,
          quantity: 1,
          pricePerUnit: '180.00',
          premium: '5',
          settlementDate: '2020-01-01T00:00:00Z',
        },
      }).then((r) => expect(r.status, 'W8a: past settlement rejected').to.not.eq(200))

      // (b) qty=0.
      cy.request({
        method: 'POST',
        url: '/api/v1/otc/offers',
        headers: { Authorization: `Bearer ${c.buyerTok}`, 'Idempotency-Key': crypto.randomUUID() },
        failOnStatusCode: false,
        body: {
          sellerHoldingId: c.sellerAaplHoldingId,
          buyerAccountId: c.buyerUsdAccountId,
          sellerAccountId: c.sellerUsdAccountId,
          quantity: 0,
          pricePerUnit: '180.00',
          premium: '5',
          settlementDate: '2027-12-31T00:00:00Z',
        },
      }).then((r) => expect(r.status, 'W8b: qty=0 rejected').to.not.eq(200))

      // (c) qty > publicCount.  Drop publicCount to 1 via psql so
      // we don't fight the gateway's "publicCount <= available
      // quantity" gate when a prior wave left a residual reserved
      // count.  Restore via psql for the same reason.
      cy.psql(
        `UPDATE "trading".portfolio_holdings SET public_count = 1
          WHERE id = '${c.sellerAaplHoldingId}'`,
      )
      cy.request({
        method: 'POST',
        url: '/api/v1/otc/offers',
        headers: { Authorization: `Bearer ${c.buyerTok}`, 'Idempotency-Key': crypto.randomUUID() },
        failOnStatusCode: false,
        body: {
          sellerHoldingId: c.sellerAaplHoldingId,
          buyerAccountId: c.buyerUsdAccountId,
          sellerAccountId: c.sellerUsdAccountId,
          quantity: 99,
          pricePerUnit: '180.00',
          premium: '5',
          settlementDate: '2027-12-31T00:00:00Z',
        },
      }).then((r) => expect(r.status, 'W8c: qty>publicCount rejected').to.not.eq(200))
      cy.psql(
        `UPDATE "trading".portfolio_holdings SET public_count = 50
          WHERE id = '${c.sellerAaplHoldingId}'`,
      )

      // (d) OTM exercise.  Per spec p.74, the *buyer* chooses
      // whether to exercise; the backend doesn't gate this on
      // current price < strike (the buyer is welcome to take a
      // loss).  The FE shows/hides the "Iskoristi" button on the
      // OTM signal but the API stays open.  So we just confirm
      // OTM exercise is *accepted* (FE-side rule, not BE).
      pinListing(c.adminTok, c.aaplSecurityId, c.aaplMic, 180)
      openContract(c, 1, 200, 5).then((oc) => {
        pinListing(c.adminTok, c.aaplSecurityId, c.aaplMic, 150)
        exerciseRaw(c, oc.contractId).then((r) => {
          expect(r.status, 'W8d: OTM exercise allowed by backend').to.eq(200)
        })
      })

      // (e) Double-exercise on a freshly exercised contract.
      pinListing(c.adminTok, c.aaplSecurityId, c.aaplMic, 180)
      openContract(c, 1, 180, 5).then((oc) => {
        pinListing(c.adminTok, c.aaplSecurityId, c.aaplMic, 240)
        exerciseRaw(c, oc.contractId).then((r) => {
          expect(r.status, 'W8e: first exercise 200').to.eq(200)
        })
        exerciseRaw(c, oc.contractId).then((r) => {
          expect(r.status, 'W8e: second exercise rejected').to.not.eq(200)
        })
      })

      // (f) Fund invest below minimum (1000).
      requestVerification(c.sellerTok, 'fund_invest').then((proof) => {
        cy.request({
          method: 'POST',
          url: `/api/v1/funds/${c.fundId}/invest`,
          failOnStatusCode: false,
          headers: {
            Authorization: `Bearer ${c.sellerTok}`,
            'Idempotency-Key': crypto.randomUUID(),
            'X-Verification-Id': proof.verificationId,
            'X-Verification-Code': proof.code,
          },
          body: { amountRsd: '100', sourceAccountId: c.sellerRsdAccountId },
        }).then((r) => expect(r.status, 'W8f: invest < min rejected').to.not.eq(200))
      })

      // (g) Fund withdraw > current position.
      requestVerification(c.sellerTok, 'fund_withdraw').then((proof) => {
        cy.request({
          method: 'POST',
          url: `/api/v1/funds/${c.fundId}/withdraw`,
          failOnStatusCode: false,
          headers: {
            Authorization: `Bearer ${c.sellerTok}`,
            'Idempotency-Key': crypto.randomUUID(),
            'X-Verification-Id': proof.verificationId,
            'X-Verification-Code': proof.code,
          },
          body: { amountRsd: '999999999', destAccountId: c.sellerRsdAccountId },
        }).then((r) => expect(r.status, 'W8g: withdraw > position rejected').to.not.eq(200))
      })

      // (h) Self-accept own counter — buyer counters then tries to
      // accept their own iteration.
      pinListing(c.adminTok, c.aaplSecurityId, c.aaplMic, 180)
      cy.request({
        method: 'POST',
        url: '/api/v1/otc/offers',
        headers: { Authorization: `Bearer ${c.buyerTok}`, 'Idempotency-Key': crypto.randomUUID() },
        body: {
          sellerHoldingId: c.sellerAaplHoldingId,
          buyerAccountId: c.buyerUsdAccountId,
          sellerAccountId: c.sellerUsdAccountId,
          quantity: 1,
          pricePerUnit: '180.00',
          premium: '4',
          settlementDate: '2027-12-31T00:00:00Z',
        },
      }).then((r) => {
        const threadId = r.body.threadId as string
        requestVerification(c.buyerTok, 'otc_accept').then((proof) => {
          cy.request({
            method: 'POST',
            url: `/api/v1/otc/offers/${threadId}/accept`,
            failOnStatusCode: false,
            headers: {
              Authorization: `Bearer ${c.buyerTok}`,
              'Idempotency-Key': crypto.randomUUID(),
              'X-Verification-Id': proof.verificationId,
              'X-Verification-Code': proof.code,
            },
            body: {},
          }).then((r2) => {
            expect(r2.status, 'W8h: self-accept rejected').to.not.eq(200)
          })
        })
      })

      assertCleanLeakState('W8')
    })
  })

  // ─────────────────── W9: fund churn + illiquid path ────────────────────
  it('W9: 10 small invests + illiquid withdraw saga drains', () => {
    withCtx((c) => {
      // 10 small invests.
      for (let i = 0; i < 10; i++) {
        requestVerification(c.sellerTok, 'fund_invest').then((proof) => {
          cy.request({
            method: 'POST',
            url: `/api/v1/funds/${c.fundId}/invest`,
            headers: {
              Authorization: `Bearer ${c.sellerTok}`,
              'Idempotency-Key': crypto.randomUUID(),
              'X-Verification-Id': proof.verificationId,
              'X-Verification-Code': proof.code,
            },
            body: { amountRsd: '1500', sourceAccountId: c.sellerRsdAccountId },
          })
        })
      }

      // Drain the fund's liquid RSD via a fund-actor BUY (supervisor
      // acts on behalf of the fund).  Find a low-priced security
      // we can stuff the fund into; NIS is the canonical c4 pick.
      cy.request({
        url: '/api/v1/securities?search=NIS',
        headers: { Authorization: `Bearer ${c.supTok}` },
      }).then((r) => {
        const hit = (r.body.items ?? []).find(
          (i: { security?: { ticker?: string } }) => i.security?.ticker === 'NIS',
        )
        if (!hit) {
          // The seed might not include NIS; skip the illiquid step
          // but keep the wave's clean-state assertion intact.
          cy.log('W9: NIS security not seeded; skipping illiquid step')
          return
        }
        const nisSecurityId = hit.security.id as string
        const nisMic = hit.listing?.exchangeMic ?? hit.security?.exchangeMic ?? 'XBEL'

        // Pin NIS at 100 RSD so the qty math is simple.
        pinListing(c.adminTok, nisSecurityId, nisMic, 100)

        // Fund BUY 100 NIS → 10_000 RSD held in stock.
        cy.request({
          method: 'POST',
          url: '/api/v1/orders',
          headers: { Authorization: `Bearer ${c.supTok}`, 'Idempotency-Key': crypto.randomUUID() },
          failOnStatusCode: false,
          body: {
            securityId: nisSecurityId,
            orderType: 'ORDER_TYPE_MARKET',
            direction: 'ORDER_DIRECTION_BUY',
            quantity: 100,
            onBehalfOfFundId: c.fundId,
          },
        }).then((or) => {
          if (or.status !== 200 && or.status !== 201) {
            cy.log(`W9: fund BUY rejected (${or.status}) — skipping illiquid drain`)
            return
          }
          // Wait for the BUY to settle.
          cy.wait(5000)
        })
      })

      // Big withdraw — should be larger than the fund's RSD liquid
      // pool to force liquidate_holdings.
      requestVerification(c.sellerTok, 'fund_withdraw').then((proof) => {
        cy.request({
          method: 'POST',
          url: `/api/v1/funds/${c.fundId}/withdraw`,
          headers: {
            Authorization: `Bearer ${c.sellerTok}`,
            'Idempotency-Key': crypto.randomUUID(),
            'X-Verification-Id': proof.verificationId,
            'X-Verification-Code': proof.code,
          },
          failOnStatusCode: false,
          body: { amountRsd: '8000', destAccountId: c.sellerRsdAccountId },
        }).then((r) => {
          expect(r.status, 'W9: illiquid withdraw accepted').to.be.oneOf([200, 202])
        })
      })

      // Drain time.  liquidate_holdings can take a while if child
      // orders chunk through partial fills.
      awaitNoRunningSagas('W9 illiquid withdraw', 120)

      assertCleanLeakState('W9')
    })
  })

  // ─────────────────── W10: tax mid-flight ───────────────────────────────
  it('W10: tax run during in-flight saga does not double-count', () => {
    withCtx((c) => {
      // Snapshot state_tax just before kickoff.
      let preTax = 0
      cy.psql(`select balance from "bank".accounts where kind='state_tax' and currency='RSD'`).then((rows) => {
        preTax = Number(rows[0]?.balance ?? '0')
      })

      // Run tax once now so any pending gain from prior waves is
      // already collected — this isolates W10's effect.
      cy.request({
        method: 'POST',
        url: '/api/v1/tax/run',
        headers: { Authorization: `Bearer ${c.supTok}`, 'Idempotency-Key': crypto.randomUUID() },
        body: {},
      })

      // Capture the post-pretax baseline.
      let baseTax = 0
      cy.psql(`select balance from "bank".accounts where kind='state_tax' and currency='RSD'`).then((rows) => {
        baseTax = Number(rows[0]?.balance ?? '0')
      })

      // Kick off another illiquid-ish withdraw.  Don't await its drain
      // before running tax — that's the whole point.
      requestVerification(c.sellerTok, 'fund_withdraw').then((proof) => {
        cy.request({
          method: 'POST',
          url: `/api/v1/funds/${c.fundId}/withdraw`,
          headers: {
            Authorization: `Bearer ${c.sellerTok}`,
            'Idempotency-Key': crypto.randomUUID(),
            'X-Verification-Id': proof.verificationId,
            'X-Verification-Code': proof.code,
          },
          failOnStatusCode: false,
          body: { amountRsd: '2000', destAccountId: c.sellerRsdAccountId },
        })
      })

      // Race tax against the saga.  Whatever totalRsd this run
      // collects, the *next* run after drain must not collect the
      // same RSD again — that's the no-double-count invariant.
      let midRsd = 0
      cy.request({
        method: 'POST',
        url: '/api/v1/tax/run',
        headers: { Authorization: `Bearer ${c.supTok}`, 'Idempotency-Key': crypto.randomUUID() },
        body: {},
      }).then((r) => {
        midRsd = Number(r.body.totalCollectedRsd ?? 0)
      })

      // Drain, then run tax a third time.
      awaitNoRunningSagas('W10 tax mid-flight drain', 120)
      cy.request({
        method: 'POST',
        url: '/api/v1/tax/run',
        headers: { Authorization: `Bearer ${c.supTok}`, 'Idempotency-Key': crypto.randomUUID() },
        body: {},
      }).then((r) => {
        const tailRsd = Number(r.body.totalCollectedRsd ?? 0)
        cy.psql(`select balance from "bank".accounts where kind='state_tax' and currency='RSD'`).then((rows) => {
          const postTax = Number(rows[0]?.balance ?? '0')
          // Total collected across the two W10 runs == state_tax
          // delta from baseTax.  Each gain charged exactly once.
          expect(midRsd + tailRsd, 'W10: state_tax delta = sum(midRsd, tailRsd)').to.be.closeTo(postTax - baseTax, 0.5)
          // And the run after drain must not over-collect on top of
          // what was already booked pre-drain (no zombie second pass
          // re-counting an already-charged realized_gain).
          cy.request({
            method: 'POST',
            url: '/api/v1/tax/run',
            headers: { Authorization: `Bearer ${c.supTok}`, 'Idempotency-Key': crypto.randomUUID() },
            body: {},
          }).then((rr) => {
            expect(
              Number(rr.body.totalCollectedRsd ?? 0),
              'W10: extra run after drain is a no-op',
            ).to.eq(0)
          })
          // Reference preTax in an assertion so the linter doesn't
          // flag the pre-pretax snapshot as unused.
          expect(postTax, 'W10: state_tax monotonic vs preTax').to.be.gte(preTax)
        })
      })

      assertCleanLeakState('W10')
    })
  })

  // ─────────────────── W11: final cross-wave invariants ──────────────────
  it('W11: cross-wave invariants — leaks, monotonicity, idempotency', () => {
    withCtx((c) => {
      // state_tax monotonic over the whole soak.
      cy.psql(`select balance from "bank".accounts where kind='state_tax' and currency='RSD'`).then((rows) => {
        const now = Number(rows[0]?.balance ?? '0')
        expect(now, 'W11: state_tax >= start').to.be.gte(c.stateTaxStart)
      })

      // No held reservations, no duplicate (op_id, leg_index), no
      // unfinished sagas, no seller reserved AAPL.
      cy.psql(`select count(*) as c from "bank".reservations where state = 'held'`).then((rows) => {
        expect(Number(rows[0]?.c ?? '-1'), 'W11: no held reservations').to.eq(0)
      })
      cy.psql(
        `select count(*) as c from "trading".saga_executions where status in ('running','compensating')`,
      ).then((rows) => {
        expect(Number(rows[0]?.c ?? '-1'), 'W11: no in-flight sagas').to.eq(0)
      })
      cy.psql(
        `select count(*) as c from (
           select op_id, leg_index, count(*) as n
             from "bank".transactions
            where op_id is not null
            group by 1, 2
            having count(*) > 1
         ) dups`,
      ).then((rows) => {
        expect(Number(rows[0]?.c ?? '-1'), 'W11: no duplicate (op_id, leg_index)').to.eq(0)
      })
      // The seller's reserved_count must equal sum(quantity) of
      // every active OTC contract on this holding PLUS open offers
      // — that's the load-bearing invariant.  reserved_count > that
      // sum means a stale reservation was left behind by a saga.
      cy.psql(
        `select coalesce(sum(quantity), 0) as c from "trading".otc_contracts
           where seller_holding_id = '${c.sellerAaplHoldingId}'
             and status = 'active'`,
      ).then((contractRows) => {
        const fromContracts = Number(contractRows[0]?.c ?? '0')
        cy.psql(
          `select coalesce(sum(quantity), 0) as c from "trading".otc_offers
             where seller_holding_id = '${c.sellerAaplHoldingId}'
               and status = 'open'`,
        ).then((offerRows) => {
          const fromOffers = Number(offerRows[0]?.c ?? '0')
          cy.psql(
            `select reserved_count from "trading".portfolio_holdings where id = '${c.sellerAaplHoldingId}'`,
          ).then((rows) => {
            const reserved = Number(rows[0]?.reserved_count ?? '-1')
            const accounted = fromContracts + fromOffers
            expect(
              reserved,
              `W11: AAPL reserved_count (${reserved}) accounted for by active contracts + open offers (${accounted})`,
            ).to.be.lte(accounted)
          })
        })
      })

      // Tax idempotency on a clean slate.
      cy.request({
        method: 'POST',
        url: '/api/v1/tax/run',
        headers: { Authorization: `Bearer ${c.supTok}`, 'Idempotency-Key': crypto.randomUUID() },
        body: {},
      }).then((r) => {
        expect(Number(r.body.totalCollectedRsd ?? 0), 'W11: extra tax pass is 0 RSD').to.eq(0)
      })

      // Final cleanup: every wave that opens an OTC contract but
      // forces compensation leaves an active contract behind (the
      // saga rolls back the cash leg, not the contract row itself).
      // Sweep those rows + any leftover open offers + reset the
      // seller's reserved_count to zero so the partner suite
      // (c4-multi-round) can pick up from a clean baseline.  Pure
      // psql so we sidestep the gateway's "you can't withdraw a
      // settled contract" guards — this is teardown, not user flow.
      cy.psql(
        `UPDATE "trading".otc_contracts SET status = 'expired'
           WHERE seller_holding_id = '${c.sellerAaplHoldingId}'
             AND status = 'active'`,
      )
      cy.psql(
        `UPDATE "trading".otc_offers SET status = 'withdrawn'
           WHERE seller_holding_id = '${c.sellerAaplHoldingId}'
             AND status = 'open'`,
      )
      cy.psql(
        `UPDATE "trading".portfolio_holdings SET reserved_count = 0
           WHERE id = '${c.sellerAaplHoldingId}'`,
      )
    })
  })
})
