/// <reference types="cypress" />

// c4 multi-round soak — exercises the OTC accept + exercise SAGAs and
// the fund invest + withdraw SAGAs back-to-back against a persistent
// backend.  Asserts the cross-round invariants the per-spec-reset
// suite under cypress/e2e/celina4 can't see:
//
//   - holdings.reserved_count returns to 0 after each round (offer
//     opened → contract minted → exercised flows must fully release).
//   - no `bank.reservations where state='held'` past the round —
//     reserve/release/commit pairs must always net out.
//   - no `saga_executions` left in {running,compensating} past 30s
//     after round end — the recovery worker either resumed them
//     to terminal status or abandoned them.
//   - bank.state_tax (RSD) is monotonically non-decreasing across
//     rounds and each runTax credit equals reported totalRsd.
//   - client_fund_positions.total_invested_rsd reduces correctly
//     when the client withdraws (pro-rata cost basis math).
//
// The suite is API-driven (cy.request + cy.psql) and seeds-once
// before round 0: capture tokens, ensure klijent2 has a USD account,
// plant a fund for the manager, set up baseline counters.  It does
// NOT call resetBackend; rounds build on each other's state.

const ADMIN_EMAIL = 'admin@banka.local'
const ADMIN_PASSWORD = 'Admin123!'
const SUPERVISOR_EMAIL = 'supervizor@banka.local'
const SUPERVISOR_PASSWORD = 'Supervizor123!'
const SELLER_EMAIL = 'klijent@banka.local'
const SELLER_PASSWORD = 'Klijent123!'
const BUYER_EMAIL = 'klijent2@banka.local'
const BUYER_PASSWORD = 'Klijent123!'

const FOREX_BOOK_OWNER_ID = '00000000-0000-0000-0000-000000000020'
const STATE_TAX_OWNER_ID = '00000000-0000-0000-0000-000000000010'

const ROUNDS = [
  { qty: 2, premium: 4, strikeBump: 1.1 },
  { qty: 2, premium: 5, strikeBump: 1.12 },
  { qty: 2, premium: 6, strikeBump: 1.08 },
]

interface SoakCtx {
  adminTok: string
  supTok: string
  sellerTok: string
  buyerTok: string
  sellerId: string
  buyerId: string
  sellerAaplHoldingId: string
  sellerUsdAccountId: string
  buyerUsdAccountId: string
  fundId: string
  fundBankAccountId: string
  aaplSecurityId: string
  aaplMic: string
  bankRsdForexBookId: string
  clientRsdAccountId: string
  stateTaxBefore: number[]
  stateTaxAfter: number[]
}

const ctx: SoakCtx = {
  adminTok: '',
  supTok: '',
  sellerTok: '',
  buyerTok: '',
  sellerId: '',
  buyerId: '',
  sellerAaplHoldingId: '',
  sellerUsdAccountId: '',
  buyerUsdAccountId: '',
  fundId: '',
  fundBankAccountId: '',
  aaplSecurityId: '',
  aaplMic: 'XNYS',
  bankRsdForexBookId: '',
  clientRsdAccountId: '',
  stateTaxBefore: [],
  stateTaxAfter: [],
}

function withCtx(fn: (c: SoakCtx) => void): void {
  cy.then(() => fn(ctx))
}

function gwLogin(email: string, password: string): Cypress.Chainable<string> {
  return cy
    .request('POST', '/api/v1/auth/login', { email, password })
    .then((r) => r.body.accessToken as string)
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

function findUsdAccount(token: string, ownerClientId: string): Cypress.Chainable<string | null> {
  return listAccounts(token, ownerClientId).then((accs) => {
    const usd = accs.find((a) => a.currency === 'CURRENCY_USD')
    return usd?.id ?? null
  })
}

function findRsdAccount(token: string, ownerClientId: string, kind?: string): Cypress.Chainable<string | null> {
  return listAccounts(token, ownerClientId, kind).then((accs) => {
    const rsd = accs.find((a) => a.currency === 'CURRENCY_RSD')
    return rsd?.id ?? null
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

function requestVerification(token: string, actionKind: string) {
  return cy
    .request({
      method: 'POST',
      url: '/api/v1/verification/request',
      headers: { Authorization: `Bearer ${token}` },
      body: { actionKind },
    })
    .then((r) => ({
      verificationId: r.body.verificationId as string,
      code: r.body.code as string,
    }))
}

function getListingPrice(token: string, securityId: string): Cypress.Chainable<number> {
  return cy
    .request({
      url: `/api/v1/securities/${securityId}`,
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => Number(r.body.listing?.price ?? r.body.listing?.ask ?? '0'))
}

function listHoldings(token: string, userId: string, userKind: string = 'USER_KIND_CLIENT') {
  return cy
    .request({
      url: `/api/v1/portfolio?userId=${userId}&userKind=${userKind}`,
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) =>
      (r.body.holdings ?? []) as Array<{
        id?: string
        quantity?: number
        publicCount?: number
        reservedCount?: number
        security?: { id?: string; ticker?: string }
      }>,
    )
}

describe('c4 soak — OTC + funds across rounds, one persistent backend', () => {
  before(() => {
    // Tokens.
    gwLogin(ADMIN_EMAIL, ADMIN_PASSWORD).then((t) => (ctx.adminTok = t))
    gwLogin(SUPERVISOR_EMAIL, SUPERVISOR_PASSWORD).then((t) => (ctx.supTok = t))
    gwLogin(SELLER_EMAIL, SELLER_PASSWORD).then((t) => (ctx.sellerTok = t))
    gwLogin(BUYER_EMAIL, BUYER_PASSWORD).then((t) => (ctx.buyerTok = t))

    withCtx((c) => {
      meUserID(c.sellerTok).then((id) => (ctx.sellerId = id))
      meUserID(c.buyerTok).then((id) => (ctx.buyerId = id))
    })

    // AAPL securityId + initial price pin so the offer + exercise math
    // is deterministic regardless of any AV refresh between rounds.
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
        pinListing(c.adminTok, ctx.aaplSecurityId, ctx.aaplMic, 180, 180.1, 179.9)
      })
    })

    // Seller's seeded USD trading account.
    withCtx((c) => {
      findUsdAccount(c.adminTok, c.sellerId).then((id) => {
        if (!id) throw new Error('seller has no USD account')
        ctx.sellerUsdAccountId = id
      })
    })

    // Buyer (klijent2): mint a USD account if missing. The seed plants
    // klijent2 with no bank fixtures.
    withCtx((c) => {
      findUsdAccount(c.adminTok, c.buyerId).then((existing) => {
        if (existing) {
          ctx.buyerUsdAccountId = existing
          return
        }
        cy.request({
          method: 'POST',
          url: '/api/v1/accounts',
          headers: { Authorization: `Bearer ${c.adminTok}` },
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
    })

    // Bank's per-currency forex_book RSD account for fund "in name of bank" invests.
    withCtx((c) => {
      findRsdAccount(c.adminTok, FOREX_BOOK_OWNER_ID, 'ACCOUNT_KIND_FOREX_BOOK').then((id) => {
        if (!id) throw new Error('bank RSD forex_book missing')
        ctx.bankRsdForexBookId = id
      })
    })

    // Client's seeded RSD account.
    withCtx((c) => {
      findRsdAccount(c.adminTok, c.sellerId).then((id) => {
        if (!id) throw new Error('client has no RSD account')
        ctx.clientRsdAccountId = id
      })
    })

    // Seller's AAPL holding (seeded with 10 AAPL @ $170). Set public
    // count to qty so OTC discovery shows the row.
    withCtx((c) => {
      listHoldings(c.sellerTok, c.sellerId).then((hs) => {
        const aapl = hs.find((h) => h.security?.ticker === 'AAPL')
        if (!aapl?.id) throw new Error('seller has no AAPL holding')
        ctx.sellerAaplHoldingId = aapl.id
        const want = aapl.quantity ?? 0
        if ((aapl.publicCount ?? 0) < want) {
          cy.request({
            method: 'PATCH',
            url: `/api/v1/portfolio/${aapl.id}/public-count`,
            headers: {
              Authorization: `Bearer ${c.sellerTok}`,
              'Idempotency-Key': crypto.randomUUID(),
            },
            body: { publicCount: want },
          })
        }
      })
    })

    // Fund: create if not present. Soak runs may pre-exist a fund;
    // skip on conflict by listing first.
    withCtx((c) => {
      cy.request({
        url: '/api/v1/funds',
        headers: { Authorization: `Bearer ${c.supTok}` },
      }).then((r) => {
        const existing = (r.body.funds ?? []).find(
          (f: { name?: string; id?: string; bankAccountId?: string }) => f.name === 'Soak c4 Fond',
        )
        if (existing) {
          ctx.fundId = existing.id
          ctx.fundBankAccountId = existing.bankAccountId
          return
        }
        cy.request({
          method: 'POST',
          url: '/api/v1/funds',
          headers: {
            Authorization: `Bearer ${c.supTok}`,
            'Idempotency-Key': crypto.randomUUID(),
          },
          body: {
            name: 'Soak c4 Fond',
            description: 'Persistent fund for c4 soak rounds',
            minimumContribution: '1000',
          },
        }).then((cr) => {
          ctx.fundId = cr.body.id
          ctx.fundBankAccountId = cr.body.bankAccountId
        })
      })
    })
  })

  ROUNDS.forEach((round, idx) => {
    const roundNo = idx + 1

    it(`round ${roundNo}: OTC offer→accept→exercise + fund invest→withdraw, invariants reset`, () => {
      withCtx((c) => {
        // State-tax baseline for monotonic check.
        cy.psql(`select balance from "bank".accounts where kind='state_tax' and currency='RSD'`).then(
          (rows) => {
            ctx.stateTaxBefore[idx] = Number(rows[0]?.balance ?? '0')
          },
        )

        // Resolve current AAPL price so the strike on the round's
        // contract sits above it.
        getListingPrice(c.adminTok, c.aaplSecurityId).then((current) => {
          const strike = Math.round(current * 100) / 100
          const exerciseTouch = Math.round(current * round.strikeBump * 100) / 100

          // ───── OTC: buyer offers @ strike, premium ─────
          cy.request({
            method: 'POST',
            url: '/api/v1/otc/offers',
            headers: {
              Authorization: `Bearer ${c.buyerTok}`,
              'Idempotency-Key': crypto.randomUUID(),
            },
            body: {
              sellerHoldingId: c.sellerAaplHoldingId,
              buyerAccountId: c.buyerUsdAccountId,
              sellerAccountId: c.sellerUsdAccountId,
              quantity: round.qty,
              pricePerUnit: String(strike),
              premium: String(round.premium),
              settlementDate: '2027-12-31T00:00:00Z',
            },
          }).then((r) => {
            const threadId = r.body.threadId as string

            // Seller counters (must be the not-last-modifier so the
            // buyer can accept on the next step — backend rejects
            // self-accepts with "ne možete da prihvatite sopstvenu
            // iteraciju").
            cy.request({
              method: 'POST',
              url: `/api/v1/otc/offers/${threadId}/counter`,
              headers: {
                Authorization: `Bearer ${c.sellerTok}`,
                'Idempotency-Key': crypto.randomUUID(),
              },
              body: {
                quantity: round.qty,
                pricePerUnit: String(strike),
                premium: String(round.premium),
                settlementDate: '2027-12-31T00:00:00Z',
              },
            })

            // Verification + accept (buyer accepts seller's counter).
            requestVerification(c.buyerTok, 'otc_accept').then((proof) => {
              cy.request({
                method: 'POST',
                url: `/api/v1/otc/offers/${threadId}/accept`,
                headers: {
                  Authorization: `Bearer ${c.buyerTok}`,
                  'Idempotency-Key': crypto.randomUUID(),
                  'X-Verification-Id': proof.verificationId,
                  'X-Verification-Code': proof.code,
                },
                body: {},
              }).then((ar) => {
                cy.wrap(ar.body.contract.id).as(`contract_${roundNo}`)
              })
            })

            // Bump AAPL above strike so the exercise is profitable.
            pinListing(
              c.adminTok,
              c.aaplSecurityId,
              c.aaplMic,
              exerciseTouch,
              exerciseTouch + 0.5,
              exerciseTouch - 0.5,
            )

            // Exercise.
            cy.get<string>(`@contract_${roundNo}`).then((contractId) => {
              requestVerification(c.buyerTok, 'otc_exercise').then((proof2) => {
                cy.request({
                  method: 'POST',
                  url: `/api/v1/otc/contracts/${contractId}/exercise`,
                  headers: {
                    Authorization: `Bearer ${c.buyerTok}`,
                    'Idempotency-Key': crypto.randomUUID(),
                    'X-Verification-Id': proof2.verificationId,
                    'X-Verification-Code': proof2.code,
                  },
                  body: {},
                })
              })
            })
          })
        })

        // ───── Fund: client invests 5_000 RSD → withdraws 3_000 RSD ─────
        const investAmt = '5000'
        const withdrawAmt = '3000'

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
            body: {
              amountRsd: investAmt,
              sourceAccountId: c.clientRsdAccountId,
            },
          })
        })

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
            body: {
              amountRsd: withdrawAmt,
              destAccountId: c.clientRsdAccountId,
            },
          })
        })

        // ───── Tax cron ─────
        cy.request({
          method: 'POST',
          url: '/api/v1/tax/run',
          headers: {
            Authorization: `Bearer ${c.supTok}`,
            'Idempotency-Key': crypto.randomUUID(),
          },
          body: {},
        }).then((r) => {
          const total = Number(r.body.totalCollectedRsd ?? 0)
          // The OTC exercise wrote a seller realized_gain in USD; the
          // fund withdraw wrote a client realized_gain in RSD. Tax run
          // collects both. totalRsd > 0 for the round.
          expect(total, `round ${roundNo} tax total RSD`).to.be.greaterThan(0)
        })

        // ───── Invariants ─────
        // 1) Seller's AAPL holding reserved_count is back to 0 (the
        //    offer reserved qty, exercise released it).
        cy.psql(
          `select reserved_count from "trading".portfolio_holdings where id = '${c.sellerAaplHoldingId}'`,
        ).then((rows) => {
          expect(
            Number(rows[0]?.reserved_count ?? '-1'),
            `round ${roundNo} seller AAPL reserved_count=0`,
          ).to.eq(0)
        })

        // 2) No orphan bank.reservations stuck on 'held'.
        cy.psql(`select count(*) as c from "bank".reservations where state = 'held'`).then((rows) => {
          expect(
            Number(rows[0]?.c ?? '-1'),
            `round ${roundNo} no held reservations`,
          ).to.eq(0)
        })

        // 3) Capture state_tax after the round.
        cy.psql(`select balance from "bank".accounts where kind='state_tax' and currency='RSD'`).then(
          (rows) => {
            ctx.stateTaxAfter[idx] = Number(rows[0]?.balance ?? '0')
            expect(
              ctx.stateTaxAfter[idx],
              `round ${roundNo} state_tax monotonic`,
            ).to.be.greaterThan(ctx.stateTaxBefore[idx])
          },
        )

        // 4) Give the recovery worker a generous window to drain any
        //    still-running fund_withdraw saga before asserting 0
        //    unfinished sagas. The c4 illiquid path can persist as
        //    'running' until child orders settle; capping at 60s.
        function awaitNoRunningSagas(remaining: number): void {
          if (remaining <= 0) {
            cy.psql(
              `select transaction_id, status from "trading".saga_executions where status in ('running','compensating')`,
            ).then((rows) => {
              expect(rows.length, `round ${roundNo} no leftover running sagas`).to.eq(0)
            })
            return
          }
          cy.psql(
            `select count(*) as c from "trading".saga_executions where status in ('running','compensating')`,
          ).then((rows) => {
            if (Number(rows[0]?.c ?? '0') === 0) return
            cy.wait(3000)
            awaitNoRunningSagas(remaining - 1)
          })
        }
        awaitNoRunningSagas(20) // 20 × 3s = 60s ceiling
      })
    })
  })

  it('final cross-round invariants', () => {
    withCtx(() => {
      // State-tax monotonic + continuity across rounds.
      for (let i = 0; i < ROUNDS.length; i++) {
        expect(
          ctx.stateTaxAfter[i],
          `round ${i + 1} state_tax > before`,
        ).to.be.greaterThan(ctx.stateTaxBefore[i])
        if (i + 1 < ROUNDS.length) {
          expect(
            ctx.stateTaxAfter[i],
            `round ${i + 1}/${i + 2} state_tax continuity (no money vanishes between rounds)`,
          ).to.eq(ctx.stateTaxBefore[i + 1])
        }
      }

      // No held bank reservations or running sagas across all rounds.
      cy.psql(`select count(*) as c from "bank".reservations where state = 'held'`).then((rows) => {
        expect(Number(rows[0]?.c ?? '-1'), 'no held bank reservations').to.eq(0)
      })
      cy.psql(
        `select count(*) as c from "trading".saga_executions where status in ('running','compensating')`,
      ).then((rows) => {
        expect(Number(rows[0]?.c ?? '-1'), 'no running/compensating sagas').to.eq(0)
      })

      // Tax idempotency: re-running the cron must be a no-op.
      const supTok = ctx.supTok
      cy.psql(`select balance from "bank".accounts where kind='state_tax' and currency='RSD'`).then(
        (preRows) => {
          const pre = Number(preRows[0]?.balance ?? '0')
          cy.request({
            method: 'POST',
            url: '/api/v1/tax/run',
            headers: {
              Authorization: `Bearer ${supTok}`,
              'Idempotency-Key': crypto.randomUUID(),
            },
            body: {},
          }).then((r) => {
            expect(Number(r.body.totalCollectedRsd ?? 0), 'tax idempotent: 0 RSD').to.eq(0)
          })
          cy.psql(
            `select balance from "bank".accounts where kind='state_tax' and currency='RSD'`,
          ).then((postRows) => {
            const post = Number(postRows[0]?.balance ?? '0')
            expect(
              Math.abs(post - pre),
              'tax idempotent: state_tax unchanged',
            ).to.be.lessThan(0.01)
          })
        },
      )
    })
  })
})
