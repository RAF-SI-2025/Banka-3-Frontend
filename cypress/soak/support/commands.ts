/// <reference types="cypress" />

// Soak-suite helpers.  Everything is API-driven via cy.request() so a
// journey can run end-to-end without UI flake; the UI gets exercised
// separately by the cypress/e2e/ suite.  These helpers favor delta
// assertions over absolutes — a soak run inherits the state left by
// every previous run.

const GW = '/api/v1'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Programmatic login via the gateway; returns the bearer token. */
      gwLogin(email: string, password: string): Chainable<string>
      /** Run a SQL query against the dev postgres container.  Returns rows. */
      psql(sql: string, args?: string[]): Chainable<Array<Record<string, string>>>
      /** Read the balance of the `state_tax` / `RSD` account (whole RSD as number). */
      stateTaxBalance(): Chainable<number>
      /** Read an actuary's usedLimit (whole RSD as number). */
      agentUsedLimit(token: string, employeeId: string): Chainable<number>
      /** Place an order via POST /orders.  Returns the order id. */
      placeOrder(token: string, body: Record<string, unknown>): Chainable<string>
      /** Approve a pending order. */
      approveOrder(token: string, orderId: string): Chainable<void>
      /** Poll an order until isDone=true or fail. */
      waitOrderDone(token: string, orderId: string, maxSeconds?: number): Chainable<void>
      /** Patch an exchange's market-state override. */
      overrideMarket(token: string, mic: string, state: string): Chainable<void>
      /** Upsert a listing price (PUT /listings) — same shape PriceOverrideDialog uses. */
      overrideListingPrice(
        token: string,
        args: { securityId: string; exchangeMic: string; price: number; ask: number; bid: number },
      ): Chainable<void>
      /** Run the supervisor tax cron via POST /tax/run. */
      runTax(token: string): Chainable<{ usersTaxed: number; totalRsd: number }>
      /** Run the daily-reset cron via POST /actuaries/reset-job. */
      runResetJob(token: string): Chainable<{ affected: number }>
      /** Fetch the agent's seeded employeeId via the actuaries list. */
      findAgentEmployeeId(token: string, email: string): Chainable<string>
      /** Lookup a listing by security ticker via GET /securities. */
      findListingByTicker(
        token: string,
        ticker: string,
      ): Chainable<{ listingId: string; securityId: string; currency: string; exchangeMic: string }>
      /** Count pending order_executions (state-leak canary). */
      pendingExecutionCount(): Chainable<number>
      /** Count unfinished SAGA executions (state-leak canary). */
      unfinishedSagaCount(): Chainable<number>
      /** Count transactions sharing the same (op_id, leg_index) — should be 0 always. */
      duplicateOpLegCount(): Chainable<number>
      /** Count realized_gains rows for this user (employee unless overridden). */
      realizedGainsCount(userId: string, userKind?: string): Chainable<number>
      /** Sum of portfolio_holdings.quantity for this user × ticker. */
      holdingQty(userId: string, ticker: string, userKind?: string): Chainable<number>
      /** Read the bank's per-currency forex_book account balance. */
      forexBookBalance(currency: string): Chainable<number>
      /** Aggregate the most recent N realized_gains rows for a user. */
      realizedGainsAggregateLastN(
        userId: string,
        n: number,
        userKind?: string,
      ): Chainable<{ sumQty: number; sumGainNative: number; sumGainRsd: number }>
    }
  }
}

Cypress.Commands.add('gwLogin', (email: string, password: string) => {
  return cy
    .request('POST', `${GW}/auth/login`, { email, password })
    .then((r) => r.body.accessToken as string)
})

Cypress.Commands.add('psql', (sql: string, args: string[] = []) => {
  return cy.task<Array<Record<string, string>>>('psql', { sql, args })
})

Cypress.Commands.add('stateTaxBalance', () => {
  return cy
    .psql(`select balance from "bank".accounts where kind='state_tax' and currency='RSD'`)
    .then((rows) => Number(rows[0]?.balance ?? '0'))
})

Cypress.Commands.add('agentUsedLimit', (token: string, employeeId: string) => {
  return cy
    .request({
      url: `${GW}/actuaries/${employeeId}`,
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => Number(r.body.usedLimit ?? '0'))
})

Cypress.Commands.add('placeOrder', (token: string, body: Record<string, unknown>) => {
  // The gateway requires Idempotency-Key on every mutation (axios
  // interceptor adds it in the SPA; we have to mint one here).
  return cy
    .request({
      method: 'POST',
      url: `${GW}/orders`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': crypto.randomUUID(),
      },
      body,
    })
    .then((r) => r.body.order?.id ?? r.body.id)
})

Cypress.Commands.add('approveOrder', (token: string, orderId: string) => {
  cy.request({
    method: 'POST',
    url: `${GW}/orders/${orderId}/approve`,
    headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': crypto.randomUUID() },
    body: {},
  })
})

Cypress.Commands.add('waitOrderDone', (token: string, orderId: string, maxSeconds = 180) => {
  const intervalMs = 3000
  const maxAttempts = Math.ceil((maxSeconds * 1000) / intervalMs)
  function poll(remaining: number): void {
    if (remaining <= 0) {
      throw new Error(`waitOrderDone: order ${orderId} not done after ${maxSeconds}s`)
    }
    cy.request({
      url: `${GW}/orders/${orderId}`,
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => {
      if (r.body.isDone === true) return
      cy.wait(intervalMs)
      poll(remaining - 1)
    })
  }
  poll(maxAttempts)
})

Cypress.Commands.add('overrideMarket', (token: string, mic: string, state: string) => {
  cy.request({
    method: 'PATCH',
    url: `${GW}/exchanges/${mic}/override`,
    headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': crypto.randomUUID() },
    body: { overrideState: state },
  })
})

Cypress.Commands.add('overrideListingPrice', (token: string, args) => {
  // Mirrors PriceOverrideDialog: PUT /listings is an upsert keyed by
  // (securityId, exchangeMic); the listing id is *not* sent.
  cy.request({
    method: 'PUT',
    url: `${GW}/listings`,
    headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': crypto.randomUUID() },
    body: {
      securityId: args.securityId,
      exchangeMic: args.exchangeMic,
      price: String(args.price),
      ask: String(args.ask),
      bid: String(args.bid),
    },
  })
})

Cypress.Commands.add('runTax', (token: string) => {
  return cy
    .request({
      method: 'POST',
      url: `${GW}/tax/run`,
      headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': crypto.randomUUID() },
      body: {},
    })
    .then((r) => ({
      usersTaxed: Number(r.body.usersTaxed ?? 0),
      totalRsd: Number(r.body.totalCollectedRsd ?? r.body.totalCollectedRSD ?? 0),
    }))
})

Cypress.Commands.add('runResetJob', (token: string) => {
  return cy
    .request({
      method: 'POST',
      url: `${GW}/actuaries/reset-job`,
      headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': crypto.randomUUID() },
      body: {},
    })
    .then((r) => ({ affected: Number(r.body.affected ?? 0) }))
})

Cypress.Commands.add('findAgentEmployeeId', (token: string, email: string) => {
  // The actuaries endpoint doesn't carry the employee email so we
  // can't search by it.  The dev seed plants exactly one agent, so
  // taking the first row of a type-filtered list is unambiguous;
  // assert there's exactly one before returning it.
  // psql -v variable interpolation needs interactive mode or a
  // tags-aware reader; with -c the variable name is treated as
  // literal text.  Sidestep by string-escaping a known-safe email
  // (no quotes are present in seeded fixtures).
  const safe = email.replace(/'/g, "''")
  return cy
    .psql(`select id from "user".employees where email = '${safe}'`)
    .then((rows) => {
      if (!rows[0]?.id) throw new Error(`agent ${email} not in employees`)
      return rows[0].id
    })
})

Cypress.Commands.add('findListingByTicker', (token: string, ticker: string) => {
  return cy
    .request({
      url: `${GW}/securities?search=${encodeURIComponent(ticker)}`,
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => {
      // grpc-gateway shape: { items: [{ security: {...}, listing: {...} }] }
      const items = (r.body.items ?? []) as Array<{
        security: { id: string; ticker: string; currency?: string; exchangeMic?: string }
        listing: { id: string; exchangeMic?: string }
      }>
      const hit = items.find((it) => it.security?.ticker === ticker)
      if (!hit) throw new Error(`security ${ticker} not found`)
      return {
        listingId: hit.listing.id,
        securityId: hit.security.id,
        currency: hit.security.currency ?? 'CURRENCY_USD',
        exchangeMic: hit.listing.exchangeMic ?? hit.security.exchangeMic ?? '',
      }
    })
})

Cypress.Commands.add('pendingExecutionCount', () => {
  return cy
    .psql(`select count(*) as c from "trading".order_executions where status='pending'`)
    .then((rows) => Number(rows[0]?.c ?? '0'))
})

Cypress.Commands.add('unfinishedSagaCount', () => {
  return cy
    .psql(
      `select count(*) as c from "trading".saga_executions where status not in ('completed','failed','compensated')`,
    )
    .then((rows) => Number(rows[0]?.c ?? '0'))
})

Cypress.Commands.add('duplicateOpLegCount', () => {
  return cy
    .psql(
      `select count(*) as c from (
         select op_id, leg_index, count(*) as n
         from "bank".transactions
         where op_id is not null
         group by 1, 2
         having count(*) > 1
       ) dups`,
    )
    .then((rows) => Number(rows[0]?.c ?? '0'))
})

// Per-user realized-gains row count. Soak rounds each generate one
// SELL → exactly one new row should appear per round; an extra row
// (e.g. from a stranded retry) or a missing row (a fill that didn't
// commit the gain) both flag a regression.
Cypress.Commands.add('realizedGainsCount', (userId: string, userKind: string = 'employee') => {
  return cy
    .psql(
      `select count(*) as c from "trading".realized_gains where user_id = '${userId}' and user_kind = '${userKind}'`,
    )
    .then((rows) => Number(rows[0]?.c ?? '0'))
})

// Per-user × ticker holdings sum. After each round the agent's MSFT
// (or AAPL) holding should equal cumulative (buyQty − sellQty) across
// every round on that ticker; drift here means cost-basis or fill
// accounting wrote a phantom share.
Cypress.Commands.add('holdingQty', (userId: string, ticker: string, userKind: string = 'employee') => {
  return cy
    .psql(
      `select coalesce(sum(h.quantity),0) as q
         from "trading".portfolio_holdings h
         join "trading".securities s on s.id = h.security_id
        where h.user_id = '${userId}' and h.user_kind = '${userKind}' and s.ticker = '${ticker}'`,
    )
    .then((rows) => Number(rows[0]?.q ?? '0'))
})

// Bank's per-currency forex_book account ("trading-book"; spec p.42).
// Both BUY and SELL legs of an actuary order debit/credit this account
// (the agent uses it as their own owner). Soak asserts strict-decrease
// per round since buyQty > sellQty in every round.
Cypress.Commands.add('forexBookBalance', (currency: string) => {
  const safe = currency.replace(/'/g, "''")
  return cy
    .psql(`select balance from "bank".accounts where kind='forex_book' and currency='${safe}' limit 1`)
    .then((rows) => Number(rows[0]?.balance ?? '0'))
})

// Aggregate over the most recent N realized_gains rows for a user.
// Used per-round to assert sum(quantity) == sellQty across the partial-
// fill chunker's 1..n row split (see [[feedback-partial-fills]]).
Cypress.Commands.add(
  'realizedGainsAggregateLastN',
  (userId: string, n: number, userKind: string = 'employee') => {
    const lim = Math.max(0, Math.floor(n))
    return cy
      .psql(
        `select coalesce(sum(quantity),0) as q,
                coalesce(sum(gain_native),0) as pn,
                coalesce(sum(gain_rsd),0) as pr
           from (
             select quantity, gain_native, gain_rsd
               from "trading".realized_gains
              where user_id = '${userId}' and user_kind = '${userKind}'
              order by realized_at desc
              limit ${lim}
           ) t`,
      )
      .then((rows) => ({
        sumQty: Number(rows[0]?.q ?? '0'),
        sumGainNative: Number(rows[0]?.pn ?? '0'),
        sumGainRsd: Number(rows[0]?.pr ?? '0'),
      }))
  },
)

export {}
