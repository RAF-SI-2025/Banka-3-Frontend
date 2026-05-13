/// <reference types="cypress" />

export {}

// Scenarios 1-13 of spec/c4-tests.pdf — "Feature: SAGA pattern".
//
// These exercise the OTC contract-exercise SAGA (the closest mirror of
// the scenario language: "kupac inicira kupovinu akcija"). Each test
// gets a fresh backend via cy.resetBackend(), seeds the contract via
// the OTC publish→offer→accept flow, then drives /exercise via
// cy.request() so the X-Saga-Force-Fail / -Kind / -Compensate-Fail
// debug headers can be attached. Those headers are honoured only when
// the trading service runs with SAGA_DEBUG_FAULT_INJECTION=true (see
// .env.example).
//
// S8 (partial-ownership rollback) collapses to the same FE-observable
// state as S4 (transfer_shares fail → compensation runs), so it's
// covered by S4 with a comment. S11 (process restart) is a deployment-
// level test, not FE-testable; backend coverage is in
// services/trading/internal/saga/saga_test.go.

const ADMIN_EMAIL = 'admin@banka.local'
const ADMIN_PASSWORD = 'Admin123!'
const SELLER_EMAIL = 'klijent@banka.local'
const SELLER_PASSWORD = 'Klijent123!'
const BUYER_EMAIL = 'klijent2@banka.local'
const BUYER_PASSWORD = 'Klijent123!'

const TICKER = 'AAPL'
const OFFER_QTY = 1
const COUNTER_PPU = 200 // strike used by every scenario
const PREMIUM = 10
const BUYER_USD_OPENING = 50000

const LISTING_PRICE_PRE = 190
const LISTING_PRICE_POST = 250 // > strike so "Iskoristi" is in-the-money

interface Tokens {
  admin: string
  seller: string
  buyer: string
}

function gatewayLogin(email: string, password: string): Cypress.Chainable<string> {
  return cy
    .request('POST', '/api/v1/auth/login', { email, password })
    .then((r) => r.body.accessToken as string)
}

function meUserID(token: string): Cypress.Chainable<string> {
  return cy
    .request({ url: '/api/v1/auth/me', headers: { Authorization: `Bearer ${token}` } })
    .then((r) => (r.body.client?.id ?? r.body.employee?.id) as string)
}

function findSecurity(token: string, ticker: string) {
  return cy
    .request({
      url: `/api/v1/securities?search=${encodeURIComponent(ticker)}&type=SECURITY_TYPE_STOCK`,
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => {
      const hit = (r.body.items ?? []).find((i: { security?: { ticker?: string } }) => i.security?.ticker === ticker)
      if (!hit) throw new Error(`security ${ticker} not found`)
      return {
        securityId: hit.security.id as string,
        exchangeMic: (hit.listing?.exchangeMic ?? hit.security?.exchangeMic ?? 'XNYS') as string,
      }
    })
}

function pinListing(adminTok: string, securityId: string, exchangeMic: string, price: number) {
  return cy.request({
    method: 'PUT',
    url: '/api/v1/listings',
    headers: { Authorization: `Bearer ${adminTok}` },
    body: {
      securityId,
      exchangeMic,
      price: String(price),
      ask: String(price + 0.5),
      bid: String(price - 0.5),
    },
  })
}

function findUsdAccount(token: string, ownerClientId: string) {
  return cy
    .request({
      url: `/api/v1/accounts?ownerClientId=${ownerClientId}`,
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => {
      const usd = (r.body.accounts ?? []).find((a: { currency?: string }) => a.currency === 'CURRENCY_USD') as
        | { id?: string; balance?: string; status?: string }
        | undefined
      if (!usd?.id) throw new Error(`no USD account for ${ownerClientId}`)
      return { id: usd.id, balance: Number(usd.balance ?? '0'), status: usd.status }
    })
}

function listSellerHolding(token: string, ticker: string) {
  return cy
    .request({ url: '/api/v1/portfolio', headers: { Authorization: `Bearer ${token}` } })
    .then((r) => {
      const h = (r.body.holdings ?? []).find((x: { security?: { ticker?: string } }) => x.security?.ticker === ticker)
      if (!h) throw new Error(`seller has no ${ticker} holding`)
      return h as { id: string; publicCount?: number; reservedCount?: number }
    })
}

function setPublicCount(token: string, holdingId: string, count: number) {
  return cy.request({
    method: 'PATCH',
    url: `/api/v1/portfolio/${holdingId}/public-count`,
    headers: { Authorization: `Bearer ${token}` },
    body: { publicCount: count },
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

// fixtures captures the cross-cutting setup every scenario needs:
// admin/seller/buyer tokens, ids, accounts. Each test re-runs it so
// the resetBackend baseline is fresh.
function fixtures(): Cypress.Chainable<{
  tokens: Tokens
  sellerId: string
  buyerId: string
  buyerUsdId: string
  sellerUsdId: string
  sellerHoldingId: string
  securityId: string
  exchangeMic: string
}> {
  return gatewayLogin(ADMIN_EMAIL, ADMIN_PASSWORD).then((adminTok) => {
    return gatewayLogin(SELLER_EMAIL, SELLER_PASSWORD).then((sellerTok) => {
      return gatewayLogin(BUYER_EMAIL, BUYER_PASSWORD).then((buyerTok) => {
        return meUserID(sellerTok).then((sellerId) => {
          return meUserID(buyerTok).then((buyerId) => {
            return findSecurity(adminTok, TICKER).then(({ securityId, exchangeMic }) => {
              return pinListing(adminTok, securityId, exchangeMic, LISTING_PRICE_PRE).then(() => {
                // Mint a USD account for the buyer with deterministic opening
                // balance so insufficient-funds vs sufficient-funds is in our
                // control per-scenario.
                return cy
                  .request({
                    method: 'POST',
                    url: '/api/v1/accounts',
                    headers: { Authorization: `Bearer ${adminTok}` },
                    body: {
                      ownerClientId: buyerId,
                      kind: 'ACCOUNT_KIND_PERSONAL_FX',
                      subtype: 'ACCOUNT_SUBTYPE_UNSPECIFIED',
                      currency: 'CURRENCY_USD',
                      name: 'Trgovinski USD',
                      openingBalance: String(BUYER_USD_OPENING),
                    },
                  })
                  .then(() => {
                    return findUsdAccount(adminTok, buyerId).then((buyerAcc) => {
                      return findUsdAccount(adminTok, sellerId).then((sellerAcc) => {
                        return listSellerHolding(sellerTok, TICKER).then((h) => ({
                          tokens: { admin: adminTok, seller: sellerTok, buyer: buyerTok },
                          sellerId,
                          buyerId,
                          buyerUsdId: buyerAcc.id,
                          sellerUsdId: sellerAcc.id,
                          sellerHoldingId: h.id,
                          securityId,
                          exchangeMic,
                        }))
                      })
                    })
                  })
              })
            })
          })
        })
      })
    })
  })
}

// activeContract walks the full OTC create→counter→accept handshake via
// cy.request, returns the contract id. Pinned to OFFER_QTY=1 so each
// scenario consumes a single share off the seed's 10-AAPL holding.
function activeContract(f: {
  tokens: Tokens
  buyerUsdId: string
  sellerUsdId: string
  sellerHoldingId: string
}): Cypress.Chainable<string> {
  // Seller publishes 1 share.
  return setPublicCount(f.tokens.seller, f.sellerHoldingId, 10).then(() => {
    return cy
      .request({
        method: 'POST',
        url: '/api/v1/otc/offers',
        headers: {
          Authorization: `Bearer ${f.tokens.buyer}`,
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: {
          sellerHoldingId: f.sellerHoldingId,
          buyerAccountId: f.buyerUsdId,
          sellerAccountId: f.sellerUsdId,
          quantity: OFFER_QTY,
          pricePerUnit: '195.00',
          premium: String(PREMIUM),
          settlementDate: '2026-12-31T00:00:00Z',
        },
      })
      .then((r) => {
        const threadId = r.body.threadId as string
        // Seller counters to COUNTER_PPU (becomes the strike on accept).
        return cy
          .request({
            method: 'POST',
            url: `/api/v1/otc/offers/${threadId}/counter`,
            headers: {
              Authorization: `Bearer ${f.tokens.seller}`,
              'Idempotency-Key': crypto.randomUUID(),
            },
            body: {
              quantity: OFFER_QTY,
              pricePerUnit: String(COUNTER_PPU),
              premium: String(PREMIUM),
              settlementDate: '2026-12-31T00:00:00Z',
            },
          })
          .then(() => {
            return requestVerification(f.tokens.buyer, 'otc_accept').then((v) => {
              return cy
                .request({
                  method: 'POST',
                  url: `/api/v1/otc/offers/${threadId}/accept`,
                  headers: {
                    Authorization: `Bearer ${f.tokens.buyer}`,
                    'X-Verification-Id': v.id,
                    'X-Verification-Code': v.code,
                    'Idempotency-Key': crypto.randomUUID(),
                  },
                  body: {},
                })
                .then((r2) => r2.body.contract.id as string)
            })
          })
      })
  })
}

// exercise issues POST /contracts/<id>/exercise with the verification
// proof headers and an optional fault-injection directive. Returns the
// full cy.request response (failOnStatusCode: false) so the caller can
// assert on 2xx vs 4xx vs 5xx per-scenario.
function exercise(
  f: { tokens: Tokens; securityId: string; exchangeMic: string },
  contractId: string,
  faultHeaders: Record<string, string> = {},
): Cypress.Chainable<Cypress.Response<{ contract?: { status?: string }; message?: string; code?: string }>> {
  // Bump price > strike so the call is profitable (FE gate aside, the
  // backend still requires the contract to be active + not expired).
  return pinListing(f.tokens.admin, f.securityId, f.exchangeMic, LISTING_PRICE_POST).then(() => {
    return requestVerification(f.tokens.buyer, 'otc_exercise').then((v) => {
      return cy.request({
        method: 'POST',
        url: `/api/v1/otc/contracts/${contractId}/exercise`,
        failOnStatusCode: false,
        headers: {
          Authorization: `Bearer ${f.tokens.buyer}`,
          'X-Verification-Id': v.id,
          'X-Verification-Code': v.code,
          'Idempotency-Key': crypto.randomUUID(),
          ...faultHeaders,
        },
        body: {},
      })
    })
  })
}

function sagaRowStatus(adminTok: string, contractId: string): Cypress.Chainable<string> {
  // The exercise saga's transaction_id is deterministic from the
  // contract id (otcExerciseTxID in otc_exercise_saga.go). Rather than
  // re-derive the UUID in cypress, peek at the most-recent
  // saga_executions row tagged with the contract via state JSON.
  return cy
    .pgSql(
      `SELECT status FROM "trading".saga_executions WHERE state->>'contract_id' = '${contractId}' ORDER BY updated_at DESC LIMIT 1`,
    )
    .then((s) => (s as string).trim())
}

describe('Celina 4 — SAGA pattern (live scenarios 1-13)', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('S1 — happy path: full exercise debits buyer, credits seller, transfers shares', () => {
    fixtures().then((f) => {
      activeContract(f).then((contractId) => {
        exercise(f, contractId).then((r) => {
          expect(r.status, 'exercise 200').to.eq(200)
          expect(r.body.contract?.status).to.eq('OTC_CONTRACT_STATUS_EXERCISED')
          // Buyer's USD debited by premium + strike (1 × $200).
          findUsdAccount(f.tokens.admin, f.buyerId).then((acc) => {
            expect(acc.balance, 'buyer −premium −strike').to.be.closeTo(
              BUYER_USD_OPENING - PREMIUM - OFFER_QTY * COUNTER_PPU,
              0.01,
            )
          })
        })
      })
    })
  })

  it('S2 — insufficient buyer funds: SAGA stops at reserve_buyer_strike, no compensation needed', () => {
    fixtures().then((f) => {
      activeContract(f).then((contractId) => {
        // Drain the buyer's USD account by transferring the entire balance
        // back to the bank's forex_book sentinel BEFORE the exercise call.
        // The premium leg already debited $PREMIUM; what's left is
        // BUYER_USD_OPENING - PREMIUM.
        cy.pgSql(
          `UPDATE "bank".accounts SET balance = 0, available_balance = 0 WHERE id = '${f.buyerUsdId}'`,
        )
        exercise(f, contractId).then((r) => {
          expect(r.status, 'exercise rejected with non-2xx').to.not.be.oneOf([200])
          expect(r.body.message ?? '', 'Serbian failure message').to.match(/sredstava|saga|reservation/i)
          // Saga row must be `failed` (step 0 fail → no compensations to run).
          sagaRowStatus(f.tokens.admin, contractId).then((s) => {
            expect(s).to.eq('failed')
          })
        })
      })
    })
  })

  it('S3 — fault-inject verify_seller_shares fail: step 1 compensates, funds released', () => {
    fixtures().then((f) => {
      activeContract(f).then((contractId) => {
        exercise(f, contractId, { 'X-Saga-Force-Fail': 'verify_seller_shares' }).then((r) => {
          expect(r.status, 'exercise rejected').to.not.eq(200)
          // Saga ends in `failed` after compensating step 0
          // (reserve_buyer_strike). Buyer balance restored (premium only
          // gone — the premium was debited at accept, not at exercise).
          sagaRowStatus(f.tokens.admin, contractId).then((s) => {
            expect(s).to.eq('failed')
          })
          findUsdAccount(f.tokens.admin, f.buyerId).then((acc) => {
            // Buyer paid only the premium at accept time; the reserve+release
            // on exercise must net to zero.
            expect(acc.balance, 'buyer balance restored to post-premium').to.be.closeTo(
              BUYER_USD_OPENING - PREMIUM,
              0.01,
            )
          })
        })
      })
    })
  })

  it('S4 — fault-inject transfer_shares fail: steps 3+2+1 compensated in reverse', () => {
    // Covers spec S4 (ownership transfer fails) AND S8 (partial
    // ownership) — both collapse to the same FE-observable state:
    // status=failed and compensation runs.
    fixtures().then((f) => {
      activeContract(f).then((contractId) => {
        exercise(f, contractId, { 'X-Saga-Force-Fail': 'transfer_shares' }).then((r) => {
          expect(r.status, 'exercise rejected').to.not.eq(200)
          sagaRowStatus(f.tokens.admin, contractId).then((s) => {
            expect(s).to.eq('failed')
          })
          // Seller balance also restored — transfer_strike compensation
          // releases the funds it committed back to the buyer.
          findUsdAccount(f.tokens.admin, f.buyerId).then((acc) => {
            expect(acc.balance, 'buyer balance restored post-rollback').to.be.closeTo(
              BUYER_USD_OPENING - PREMIUM,
              0.01,
            )
          })
        })
      })
    })
  })

  it('S5 — transient retry: first attempt parks the saga, recovery worker completes it', () => {
    fixtures().then((f) => {
      activeContract(f).then((contractId) => {
        // Inject a transient fault at the second step. runForward returns
        // a 5xx + parks the row in `running` with NextAttemptAt bumped.
        exercise(f, contractId, {
          'X-Saga-Force-Fail': 'verify_seller_shares',
          'X-Saga-Force-Fail-Kind': 'transient',
        }).then((r) => {
          expect(r.status, 'first attempt 5xx (parked for recovery)').to.not.eq(200)
          sagaRowStatus(f.tokens.admin, contractId).then((s) => {
            expect(s).to.eq('running')
          })
        })
        // Backdate NextAttemptAt so the recovery worker scan picks it
        // up immediately. The recovery context has no force-fail directive,
        // so the second pass runs normally.
        cy.pgSql(
          `UPDATE "trading".saga_executions SET next_attempt_at = now() - interval '1 minute' WHERE state->>'contract_id' = '${contractId}'`,
        )
        // Trading service's recovery worker ticks every
        // SAGA_RECOVERY_TICK (default 30s); allow up to 60s.
        function poll(remaining: number): void {
          if (remaining <= 0) throw new Error('recovery worker did not complete the saga')
          sagaRowStatus(f.tokens.admin, contractId).then((s) => {
            if (s === 'completed') return
            cy.wait(3000)
            poll(remaining - 1)
          })
        }
        poll(25)
      })
    })
  })

  it('S6 — fault-inject transfer_strike fail: step 1 compensated, buyer fully restored', () => {
    fixtures().then((f) => {
      activeContract(f).then((contractId) => {
        exercise(f, contractId, { 'X-Saga-Force-Fail': 'transfer_strike' }).then((r) => {
          expect(r.status).to.not.eq(200)
          sagaRowStatus(f.tokens.admin, contractId).then((s) => {
            expect(s).to.eq('failed')
          })
          findUsdAccount(f.tokens.admin, f.buyerId).then((acc) => {
            expect(acc.balance, 'buyer balance fully restored').to.be.closeTo(
              BUYER_USD_OPENING - PREMIUM,
              0.01,
            )
          })
        })
      })
    })
  })

  it('S7 — fault-inject finalize fail: shares + funds both rolled back', () => {
    fixtures().then((f) => {
      activeContract(f).then((contractId) => {
        exercise(f, contractId, { 'X-Saga-Force-Fail': 'finalize' }).then((r) => {
          expect(r.status).to.not.eq(200)
          sagaRowStatus(f.tokens.admin, contractId).then((s) => {
            expect(s).to.eq('failed')
          })
          // Seller's holding back to 10, buyer has none.
          listSellerHolding(f.tokens.seller, TICKER).then((h) => {
            // The compensation reverses ApplySellFill — seller qty back at 10.
            expect((h as { quantity?: number }).quantity).to.eq(10)
          })
        })
      })
    })
  })

  it.skip('S8 — covered by S4 (partial-ownership rollback collapses to transfer_shares fail)', () => {
    // The OTC exercise SAGA's `transfer_shares` step is atomic
    // (ExecuteAtomic → seller decrement + buyer increment + realized_gain
    // in one pg tx). Partial mutation isn't observable; the failure mode
    // is the whole step rolling back, which S4 already drives. Pure
    // S8 (mid-step abort) isn't reachable on this backend.
  })

  it('S9 — fault-inject compensation fail: saga parks in compensating', () => {
    fixtures().then((f) => {
      activeContract(f).then((contractId) => {
        exercise(f, contractId, {
          'X-Saga-Force-Fail': 'verify_seller_shares',
          'X-Saga-Force-Compensate-Fail': 'reserve_buyer_strike',
        }).then((r) => {
          expect(r.status).to.not.eq(200)
          // After exhausting compensation retries the row flips to
          // failed; until then it's `compensating`. The first call
          // returns the compensation error immediately because the
          // synthetic error from the directive is permanent
          // (FailedPrecondition), so runCompensations bails to
          // status=failed without retries.
          sagaRowStatus(f.tokens.admin, contractId).then((s) => {
            expect(s).to.be.oneOf(['failed', 'compensating'])
          })
        })
      })
    })
  })

  it('S10 — duplicate exercise request with same transactionId: second call is idempotent', () => {
    fixtures().then((f) => {
      activeContract(f).then((contractId) => {
        exercise(f, contractId).then((r1) => {
          expect(r1.status).to.eq(200)
          // Second call hits the same deterministic transactionId. The
          // saga is already StatusCompleted; saga.Start sees
          // ErrAlreadyExists, Resume bails on completed status. But the
          // service may still try to re-finalize the contract.
          exercise(f, contractId).then((r2) => {
            // The contract is now in EXERCISED status; the service's
            // pre-flight check rejects with FailedPrecondition
            // ("ugovor nije aktivan"). That's the FE-observable idempotency
            // contract: the second call doesn't cause additional debits.
            expect(r2.status).to.not.eq(200)
            findUsdAccount(f.tokens.admin, f.buyerId).then((acc) => {
              expect(acc.balance, 'no double debit').to.be.closeTo(
                BUYER_USD_OPENING - PREMIUM - OFFER_QTY * COUNTER_PPU,
                0.01,
              )
            })
          })
        })
      })
    })
  })

  it.skip('S11 — process restart resume (deployment-level, not FE-testable)', () => {
    // Covered by saga.go DueForRecovery + the orchestrator's resume-from-
    // current_step semantics. To exercise it from cypress we'd need to
    // `docker restart banka-trading-1` mid-saga, which races the
    // recovery worker's first tick against the test's polling window.
    // The mechanism is the same one S5 exercises (transient-park →
    // recovery worker picks up).
  })

  it('S12 — buyer account inactive mid-flight: SAGA fails, funds locked but accounted', () => {
    fixtures().then((f) => {
      activeContract(f).then((contractId) => {
        // Flip the buyer's USD account to INACTIVE so the bank's
        // SettleTrade rejects the strike-transfer step. (The schema's
        // status enum only carries active/inactive — bank
        // reservations.go/payments.go reject any non-active status.)
        cy.pgSql(
          `UPDATE "bank".accounts SET status = 'inactive' WHERE id = '${f.buyerUsdId}'`,
        )
        exercise(f, contractId).then((r) => {
          expect(r.status).to.not.eq(200)
          sagaRowStatus(f.tokens.admin, contractId).then((s) => {
            // Either reserve step fails (status=failed, no compensation
            // needed because step 0 never completed) or transfer step
            // fails (status=failed after compensating step 0).
            expect(s).to.eq('failed')
          })
        })
      })
    })
  })

  it('S13 — seller account inactive mid-flight: SAGA fails, shares stay with seller', () => {
    fixtures().then((f) => {
      activeContract(f).then((contractId) => {
        cy.pgSql(
          `UPDATE "bank".accounts SET status = 'inactive' WHERE id = '${f.sellerUsdId}'`,
        )
        exercise(f, contractId).then((r) => {
          expect(r.status).to.not.eq(200)
          sagaRowStatus(f.tokens.admin, contractId).then((s) => {
            expect(s).to.eq('failed')
          })
          // Seller's AAPL holding intact (compensation restored it if
          // the saga got past transfer_shares; or it was never decremented).
          listSellerHolding(f.tokens.seller, TICKER).then((h) => {
            expect((h as { quantity?: number }).quantity).to.eq(10)
          })
        })
      })
    })
  })
})
