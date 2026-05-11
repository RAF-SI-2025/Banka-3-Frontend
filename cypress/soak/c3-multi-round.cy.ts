/// <reference types="cypress" />

// c3 multi-round soak — runs three trading rounds back-to-back against
// a persistent backend.  The point isn't to re-verify each individual
// step (the per-spec-reset suite covers that); it's to exercise the
// *cross-round* invariants:
//
//   - state_tax / RSD balance is monotonically non-decreasing and
//     each `runTax` only debits realized profit it hasn't already
//     taxed (no double-charge across rounds).
//   - `order_executions` left pending after a `waitOrderDone` is
//     always 0 — a stranded pending row means the recovery sweep
//     in BE-3 left work behind, which would steal money on the
//     next tick.
//   - `saga_executions` not in {completed,failed,compensated} after
//     a round is always 0.
//   - Identical (op_id, leg_index) rows in `bank.transactions` is
//     0 — BE-2 added a unique constraint; if it ever regresses this
//     fires.
//   - Agent's usedLimit only resets on the `reset-job` cron; between
//     rounds it accumulates (BUY+SELL both charge under spec p.55).
//
// The suite seeds-once via the regular `task seed` before the run
// (handled by the wrapper script).  It does NOT call resetBackend at
// any point.

const SUPERVISOR_EMAIL = 'supervizor@banka.local'
const SUPERVISOR_PASSWORD = 'Supervizor123!'
const ADMIN_EMAIL = 'admin@banka.local'
const ADMIN_PASSWORD = 'Admin123!'
const AGENT_EMAIL = 'aktuar@banka.local'
const AGENT_PASSWORD = 'Aktuar123!'

interface RoundContext {
  ticker: string
  buyQty: number
  sellQty: number
  bumpFactor: number // multiplied against the *current* listing price
}

// Two distinct securities so rounds 1 and 2 don't fight over the
// same listing's last_price.  Round 3 deliberately re-uses MSFT to
// stress shared-listing state.  bumpFactor is relative — prior soak
// runs leave the listing at arbitrary last_price values so absolute
// targets would silently flip from "gain" to "loss" between runs.
const ROUNDS: RoundContext[] = [
  { ticker: 'MSFT', buyQty: 10, sellQty: 5, bumpFactor: 1.07 },
  { ticker: 'AAPL', buyQty: 12, sellQty: 6, bumpFactor: 1.08 },
  { ticker: 'MSFT', buyQty: 8, sellQty: 4, bumpFactor: 1.06 },
]

// Module-scoped state.  Cypress queues commands synchronously, so
// reading these in an `it()` body or as a literal argument captures
// `undefined` (the populating `.then()` hasn't run yet).  All reads
// must therefore be deferred — see withCtx() below.
interface SoakCtx {
  supervisorToken: string
  adminToken: string
  agentToken: string
  agentEmployeeId: string
  agentUsdAccountId: string
  stateTaxBefore: number[]
  stateTaxAfter: number[]
}
const ctx: SoakCtx = {
  supervisorToken: '',
  adminToken: '',
  agentToken: '',
  agentEmployeeId: '',
  agentUsdAccountId: '',
  stateTaxBefore: [],
  stateTaxAfter: [],
}

// withCtx runs `fn` inside a cy.then so the parent before() has
// settled by the time `fn` reads ctx.  Without this, `cy.placeOrder(
// ctx.agentToken, …)` would capture an empty string at queue-build
// time.
function withCtx(fn: (c: SoakCtx) => void): void {
  cy.then(() => fn(ctx))
}

// round4 clamps a Number to 4 decimal places so JS-side arithmetic
// matches the bank ledger's numeric(20,4) precision.
function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

describe('c3 soak — three rounds, one persistent backend', () => {
  before(() => {
    cy.gwLogin(SUPERVISOR_EMAIL, SUPERVISOR_PASSWORD).then((tok) => {
      ctx.supervisorToken = tok
    })
    cy.gwLogin(ADMIN_EMAIL, ADMIN_PASSWORD).then((tok) => {
      ctx.adminToken = tok
    })
    cy.gwLogin(AGENT_EMAIL, AGENT_PASSWORD).then((tok) => {
      ctx.agentToken = tok
    })
    withCtx((c) => {
      cy.findAgentEmployeeId(c.supervisorToken, AGENT_EMAIL).then((id) => {
        ctx.agentEmployeeId = id
        cy.log(`agent employeeId = ${id}`)
      })
    })
    // Source account for an actuary BUY must be a `forex_book`
    // (trading-book) account; bank.SettleTrade rejects `system`
    // here ("aktuari moraju izabrati trading-book račun, ne
    // menjačnicu").  The seeded sentinel owner for the bank's
    // per-currency trading book is `…000020`.
    cy.psql(
      `select id from "bank".accounts where kind='forex_book' and currency='USD' limit 1`,
    ).then((rows) => {
      if (!rows[0]?.id) throw new Error('no bank USD forex_book account')
      ctx.agentUsdAccountId = rows[0].id
      cy.log(`agent USD forex_book = ${rows[0].id}`)
    })
    // Sanity: agent has trading.agent.
    withCtx((c) => {
      cy.request({
        url: '/api/v1/auth/me',
        headers: { Authorization: `Bearer ${c.agentToken}` },
      })
        .its('body.employee.permissions')
        .should('include', 'actuary.agent')
    })
    // Pre-flight: zero out leftover state from a previous soak run
    // before we record baselines.  usedLimit shouldn't be pre-loaded
    // going into round 1; tax/state_tax we leave alone (the
    // assertions are deltas, not absolutes).
    withCtx((c) => {
      cy.runResetJob(c.supervisorToken)
    })
  })

  ROUNDS.forEach((round, idx) => {
    const roundNo = idx + 1

    it(`round ${roundNo}: ${round.ticker} BUY ${round.buyQty} → bump → SELL ${round.sellQty} → tax → reset`, () => {
      withCtx((c) => {
        cy.stateTaxBalance().then((bal) => {
          ctx.stateTaxBefore[idx] = bal
        })

        // Resolve the round's security+listing once.  Aliases set
        // inside an it don't survive into subsequent its (cypress
        // resets them regardless of testIsolation), so stash on a
        // local rather than @listing.
        cy.findListingByTicker(c.supervisorToken, round.ticker).then((lst) => {
          // BUY
          cy.placeOrder(c.agentToken, {
            securityId: lst.securityId,
            orderType: 'ORDER_TYPE_MARKET',
            direction: 'DIRECTION_BUY',
            quantity: round.buyQty,
            accountId: c.agentUsdAccountId,
          }).then((buyId) => {
            cy.approveOrder(c.supervisorToken, buyId)
            cy.waitOrderDone(c.supervisorToken, buyId, 240)
          })

          cy.pendingExecutionCount().should('eq', 0)
          cy.duplicateOpLegCount().should('eq', 0)
          cy.unfinishedSagaCount().should('eq', 0)

          // Bump the listing's price to create a realized gain on
          // the SELL leg.  Read current price (set by the BUY's
          // fills or the prior soak run) and bump RELATIVE to it,
          // so the round generates a positive realized gain
          // regardless of where the listing started.  PUT /listings
          // is upsert-keyed by (securityId, exchangeMic).
          cy.request({
            url: `${'/api/v1/listings'}/${lst.listingId}`,
            headers: { Authorization: `Bearer ${c.supervisorToken}` },
          }).then((lresp) => {
            const current = Number(lresp.body.price ?? lresp.body.ask ?? '0')
            if (!Number.isFinite(current) || current <= 0) {
              throw new Error(`listing ${lst.listingId} price not numeric: ${lresp.body.price}`)
            }
            const target = round4(current * round.bumpFactor)
            cy.overrideListingPrice(c.adminToken, {
              securityId: lst.securityId,
              exchangeMic: lst.exchangeMic,
              price: target,
              ask: round4(target + 0.5),
              bid: round4(target - 0.5),
            })
          })

          // SELL
          cy.placeOrder(c.agentToken, {
            securityId: lst.securityId,
            orderType: 'ORDER_TYPE_MARKET',
            direction: 'DIRECTION_SELL',
            quantity: round.sellQty,
            accountId: c.agentUsdAccountId,
          }).then((sellId) => {
            cy.approveOrder(c.supervisorToken, sellId)
            cy.waitOrderDone(c.supervisorToken, sellId, 240)
          })

          cy.pendingExecutionCount().should('eq', 0)
          cy.duplicateOpLegCount().should('eq', 0)
        })

        // usedLimit accumulates across BUY+SELL inside a round.
        cy.agentUsedLimit(c.supervisorToken, c.agentEmployeeId).then((used) => {
          expect(used, `round ${roundNo} usedLimit pre-reset`).to.be.greaterThan(0)
        })

        // Tax.  Cron's totalRsd must match the state_tax balance
        // delta exactly — a divergence flags either a double-debit
        // or a debit that bypassed the bank ledger.
        cy.runTax(c.supervisorToken).then((res) => {
          expect(res.usersTaxed, `round ${roundNo} tax users`).to.be.greaterThan(0)
          expect(res.totalRsd, `round ${roundNo} tax totalRsd`).to.be.greaterThan(0)
          cy.stateTaxBalance().then((bal) => {
            ctx.stateTaxAfter[idx] = bal
            // Round the JS-side subtraction to 4 decimals before
            // comparing — the bank ledger stores numeric(20,4) so
            // `bal - stateTaxBefore[idx]` drifts at the 1e-13 level
            // off `res.totalRsd` even when the ledger is exact.
            const delta = round4(bal - ctx.stateTaxBefore[idx])
            expect(delta, `round ${roundNo} state_tax delta`).to.eq(
              round4(res.totalRsd),
            )
          })
        })

        cy.pendingExecutionCount().should('eq', 0)
        cy.duplicateOpLegCount().should('eq', 0)
        cy.unfinishedSagaCount().should('eq', 0)

        // Reset usedLimit so each round starts from a clean slate.
        cy.runResetJob(c.supervisorToken).then((r) => {
          expect(r.affected, `round ${roundNo} reset affected`).to.be.greaterThan(0)
        })
        cy.agentUsedLimit(c.supervisorToken, c.agentEmployeeId).should('eq', 0)
      })
    })
  })

  it('final invariants across all rounds', () => {
    withCtx((c) => {
      for (let i = 0; i < ROUNDS.length; i++) {
        expect(
          ctx.stateTaxAfter[i],
          `round ${i + 1} state_tax monotonic`,
        ).to.be.greaterThan(ctx.stateTaxBefore[i])
        if (i + 1 < ROUNDS.length) {
          // Round i's after-balance is round (i+1)'s before-balance —
          // proves no money vanished or appeared between rounds.
          expect(
            ctx.stateTaxAfter[i],
            `round ${i + 1}/${i + 2} state_tax continuity`,
          ).to.eq(ctx.stateTaxBefore[i + 1])
        }
      }

      cy.pendingExecutionCount().should('eq', 0)
      cy.unfinishedSagaCount().should('eq', 0)
      cy.duplicateOpLegCount().should('eq', 0)

      // Final reset before the dailyLimit/usedLimit assertion.  If
      // an earlier round failed before its in-round reset fired,
      // usedLimit would still carry that round's accumulator —
      // which isn't what the final invariant is trying to assert.
      cy.runResetJob(c.supervisorToken)
      cy.request({
        url: `/api/v1/actuaries/${c.agentEmployeeId}`,
        headers: { Authorization: `Bearer ${c.supervisorToken}` },
      }).then((r) => {
        expect(Number(r.body.dailyLimit ?? '0')).to.eq(200000)
        expect(Number(r.body.usedLimit ?? '0')).to.eq(0)
      })
    })
  })
})
