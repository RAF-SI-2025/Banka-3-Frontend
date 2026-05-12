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
  orderType?: 'MARKET' | 'LIMIT' // default MARKET
}

// Two distinct securities so rounds 1 and 2 don't fight over the
// same listing's last_price.  Round 3 deliberately re-uses MSFT to
// stress shared-listing state.  Round 4 exercises the LIMIT fill-
// price code path (spec p.51 — buy fills at min(limit,ask), sell at
// max(limit,bid)) which MARKET rounds don't reach.  bumpFactor is
// relative — prior soak runs leave the listing at arbitrary
// last_price values so absolute targets would silently flip from
// "gain" to "loss" between runs.
const ROUNDS: RoundContext[] = [
  { ticker: 'MSFT', buyQty: 10, sellQty: 5, bumpFactor: 1.07 },
  { ticker: 'AAPL', buyQty: 12, sellQty: 6, bumpFactor: 1.08 },
  { ticker: 'MSFT', buyQty: 8, sellQty: 4, bumpFactor: 1.06 },
  { ticker: 'MSFT', buyQty: 6, sellQty: 3, bumpFactor: 1.05, orderType: 'LIMIT' },
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
  // Baselines captured before round 0. The soak suite runs against
  // a persistent backend that survives between invocations, so the
  // final invariants assert *deltas* against these baselines (not
  // absolutes — those would couple to all-time soak history).
  realizedBaseline: number
  holdingBaseline: Map<string, number>
}
const ctx: SoakCtx = {
  supervisorToken: '',
  adminToken: '',
  agentToken: '',
  agentEmployeeId: '',
  agentUsdAccountId: '',
  stateTaxBefore: [],
  stateTaxAfter: [],
  realizedBaseline: 0,
  holdingBaseline: new Map(),
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
      // Baseline realized_gains row count for the agent. Each round
      // SELL contributes ≥ 1 row (one per fill), so the final
      // invariant only asserts (final - baseline) >= ROUNDS.length.
      cy.realizedGainsCount(c.agentEmployeeId).then((n) => {
        ctx.realizedBaseline = n
      })
      // Baseline per-ticker holdings. The soak runs against a backend
      // that survives across invocations, so the final invariant
      // tests (final - baseline) per ticker rather than an absolute.
      const tickers = new Set(ROUNDS.map((r) => r.ticker))
      tickers.forEach((ticker) => {
        cy.holdingQty(c.agentEmployeeId, ticker).then((q) => {
          ctx.holdingBaseline.set(ticker, q)
        })
      })
    })
  })

  ROUNDS.forEach((round, idx) => {
    const roundNo = idx + 1

    it(`round ${roundNo}: ${round.ticker} ${round.orderType ?? 'MARKET'} BUY ${round.buyQty} → bump → SELL ${round.sellQty} → tax → reset`, () => {
      withCtx((c) => {
        cy.stateTaxBalance().then((bal) => {
          ctx.stateTaxBefore[idx] = bal
        })
        // Capture the bank's USD trading-book balance before the
        // round.  Net flow per round is BUY out − SELL in − fees;
        // since buyQty > sellQty in every round (and prices stay in
        // the same order of magnitude), the post-round balance
        // must be strictly less than this baseline.  Drift in the
        // wrong direction here would point to a SELL crediting more
        // than the BUY debited, or a missed commission charge.
        let forexBookBefore = 0
        cy.forexBookBalance('USD').then((bal) => {
          forexBookBefore = bal
        })

        // Resolve the round's security+listing once.  Aliases set
        // inside an it don't survive into subsequent its (cypress
        // resets them regardless of testIsolation), so stash on a
        // local rather than @listing.
        cy.findListingByTicker(c.supervisorToken, round.ticker).then((lst) => {
          // For LIMIT orders we need the current touch to set a
          // marketable limit price.  Read once before BUY; if not
          // LIMIT we just pass the field as undefined and skip.
          let buyLimit = ''
          let sellLimit = ''
          if (round.orderType === 'LIMIT') {
            cy.request({
              url: `${'/api/v1/listings'}/${lst.listingId}`,
              headers: { Authorization: `Bearer ${c.supervisorToken}` },
            }).then((lresp) => {
              const ask = Number(lresp.body.ask ?? lresp.body.price ?? '0')
              if (!Number.isFinite(ask) || ask <= 0) {
                throw new Error(`listing ${lst.listingId} ask not numeric: ${lresp.body.ask}`)
              }
              // Buy-limit set well above touch — fills at ask per
              // spec p.51 min(limit, ask).
              buyLimit = String(round4(ask + 5))
            })
          }

          // BUY
          withCtx(() => {
            const body: Record<string, unknown> = {
              securityId: lst.securityId,
              orderType: round.orderType === 'LIMIT' ? 'ORDER_TYPE_LIMIT' : 'ORDER_TYPE_MARKET',
              direction: 'DIRECTION_BUY',
              quantity: round.buyQty,
              accountId: c.agentUsdAccountId,
            }
            if (round.orderType === 'LIMIT') body.limitPrice = buyLimit
            cy.placeOrder(c.agentToken, body).then((buyId) => {
              cy.approveOrder(c.supervisorToken, buyId)
              cy.waitOrderDone(c.supervisorToken, buyId, 240)
            })
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
            if (round.orderType === 'LIMIT') {
              // Sell-limit set well below touch — fills at bid per
              // spec p.51 max(limit, bid).
              sellLimit = String(round4(target - 0.5 - 5))
            }
          })

          // Capture realized_gains row count for the agent right
          // before SELL.  After SELL completes we read the new
          // (final − before) rows and assert sum(quantity) ==
          // round.sellQty: catches the chunker dropping a fill or
          // double-counting one (per [[feedback-partial-fills]]).
          let rgBeforeSell = 0
          cy.realizedGainsCount(c.agentEmployeeId).then((n) => {
            rgBeforeSell = n
          })

          // SELL
          withCtx(() => {
            const body: Record<string, unknown> = {
              securityId: lst.securityId,
              orderType: round.orderType === 'LIMIT' ? 'ORDER_TYPE_LIMIT' : 'ORDER_TYPE_MARKET',
              direction: 'DIRECTION_SELL',
              quantity: round.sellQty,
              accountId: c.agentUsdAccountId,
            }
            if (round.orderType === 'LIMIT') body.limitPrice = sellLimit
            cy.placeOrder(c.agentToken, body).then((sellId) => {
              cy.approveOrder(c.supervisorToken, sellId)
              cy.waitOrderDone(c.supervisorToken, sellId, 240)
            })
          })

          cy.pendingExecutionCount().should('eq', 0)
          cy.duplicateOpLegCount().should('eq', 0)

          // Per-round SELL aggregate: all newly-added realized_gains
          // rows for this agent must sum back to round.sellQty.
          cy.realizedGainsCount(c.agentEmployeeId).then((rgAfter) => {
            const newRows = rgAfter - rgBeforeSell
            expect(newRows, `round ${roundNo} new realized_gains rows`).to.be.greaterThan(0)
            cy.realizedGainsAggregateLastN(c.agentEmployeeId, newRows).then((agg) => {
              expect(agg.sumQty, `round ${roundNo} Σ realized.qty == sellQty`).to.eq(round.sellQty)
              // bumpFactor > 1 + we bumped before SELL, so every new
              // row should be a positive realized gain.  Drift here
              // points to either inverted price math or a stale
              // cost-basis lookup at fill time.
              expect(
                agg.sumGainNative,
                `round ${roundNo} Σ realized.gain_native > 0`,
              ).to.be.greaterThan(0)
              expect(
                agg.sumGainRsd,
                `round ${roundNo} Σ realized.gain_rsd > 0`,
              ).to.be.greaterThan(0)
            })
          })
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

        // Bank's USD trading-book strict-decrease invariant.  Every
        // round buys more shares than it sells (buyQty > sellQty)
        // and prices stay in the same order of magnitude across the
        // bump, so the bank's net dollar outflow on this round must
        // be positive.  A flat or rising balance would point to a
        // SELL leg crediting more than the BUY debited, or a missed
        // commission charge on the BUY.
        cy.forexBookBalance('USD').then((after) => {
          expect(
            after,
            `round ${roundNo} bank USD forex_book strictly decreased`,
          ).to.be.lessThan(forexBookBefore)
        })
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

      // Holdings reconciliation: per-ticker delta from the baseline
      // = Σ (buyQty − sellQty) across rounds for that ticker. Drift
      // here means a fill silently wrote a phantom share or skipped
      // one. Absolutes would couple to all-time soak history, so
      // assert deltas only.
      const tickerNet = new Map<string, number>()
      ROUNDS.forEach((r) => {
        tickerNet.set(r.ticker, (tickerNet.get(r.ticker) ?? 0) + r.buyQty - r.sellQty)
      })
      tickerNet.forEach((expectedDelta, ticker) => {
        const baseline = ctx.holdingBaseline.get(ticker) ?? 0
        cy.holdingQty(c.agentEmployeeId, ticker).then((got) => {
          expect(
            got - baseline,
            `agent ${ticker} holding delta = Σ(buy − sell)`,
          ).to.eq(expectedDelta)
        })
      })

      // Realized-gains rows: at least one row per round's SELL — the
      // partial-fill chunker may split a single SELL into 1..n rows
      // so the lower bound is ROUNDS.length, not an exact count.
      cy.realizedGainsCount(c.agentEmployeeId).then((finalCount) => {
        expect(
          finalCount - ctx.realizedBaseline,
          `realized_gains rows added across ${ROUNDS.length} rounds`,
        ).to.be.greaterThan(ROUNDS.length - 1)
      })

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

      // Tax idempotency: every realized gain accumulated across the
      // soak was settled by its round's runTax.  Running the cron
      // one more time must be a no-op — totalRsd == 0, state_tax
      // unchanged, no fresh pending exec.  This catches a
      // regression in the "already taxed" tracking where the cron
      // would re-charge the same gains on a follow-up sweep.
      cy.stateTaxBalance().then((preIdempBal) => {
        cy.runTax(c.supervisorToken).then((res) => {
          expect(res.totalRsd, 'tax idempotent: nothing left to charge').to.eq(0)
          expect(res.usersTaxed, 'tax idempotent: zero users').to.eq(0)
          cy.stateTaxBalance().then((postIdempBal) => {
            expect(
              round4(postIdempBal - preIdempBal),
              'tax idempotent: state_tax unchanged',
            ).to.eq(0)
          })
        })
        cy.pendingExecutionCount().should('eq', 0)
        cy.duplicateOpLegCount().should('eq', 0)
        cy.unfinishedSagaCount().should('eq', 0)
      })
    })
  })
})
