import { defineConfig } from 'cypress'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

// Live-backend specs need to reset Postgres + Redis between specs and
// dig the most recent activation/reset link out of the user service's
// stdout. Both run as Cypress tasks so the spec stays declarative.

const POSTGRES_CONTAINER = process.env.CYPRESS_POSTGRES_CONTAINER ?? 'banka-postgres-1'
const USER_CONTAINER = process.env.CYPRESS_USER_CONTAINER ?? 'banka-user-1'
const NOTIFICATION_CONTAINER = process.env.CYPRESS_NOTIFICATION_CONTAINER ?? 'banka-notification-1'
const PG_USER = process.env.CYPRESS_PG_USER ?? 'banka'
const PG_DB = process.env.CYPRESS_PG_DB ?? 'banka'
const BACKEND_REPO = process.env.CYPRESS_BACKEND_REPO ?? path.resolve(__dirname, '../Banka-3-Backend')

function findNixGoBin(): string | null {
  if (!existsSync('/nix/store')) return null
  const entries = readdirSync('/nix/store').filter(
    (e) => /^[^/]+-go-1\.\d+/.test(e) && existsSync(`/nix/store/${e}/bin/go`),
  )
  return entries.length > 0 ? `/nix/store/${entries[0]}/bin` : null
}

function dockerExec(container: string, args: string[]): string {
  return execFileSync('docker', ['exec', container, ...args], {
    encoding: 'utf8',
  })
}

function resetBackend(): { ok: true } {
  // Wipe user + bank + trading schemas in one shot. The bank container
  // re-seeds its house accounts (KindSystem + KindForexBook + KindStateTax)
  // on boot; the trading container's in-memory price-tick / order-fill
  // workers self-recover on next iteration but bouncing it gets us a
  // clean slate quickly.
  dockerExec(POSTGRES_CONTAINER, [
    'psql',
    '-U',
    PG_USER,
    '-d',
    PG_DB,
    '-c',
    `truncate "user".employees, "user".clients, "user".refresh_tokens,
              "user".activation_tokens, "user".password_reset_tokens,
              "bank".loan_installments, "bank".loans, "bank".loan_requests,
              "bank".cards, "bank".authorized_persons, "bank".payment_recipients,
              "bank".reservations,
              "bank".transactions, "bank".accounts, "bank".companies,
              "trading".fund_performance_snapshots,
              "trading".client_fund_transactions,
              "trading".client_fund_positions,
              "trading".investment_funds,
              "trading".otc_contracts, "trading".otc_offers,
              "trading".realized_gains, "trading".saga_executions,
              "trading".order_executions, "trading".orders,
              "trading".portfolio_holdings, "trading".listing_daily_price_info,
              "trading".listings, "trading".securities,
              "trading".exchanges, "trading".actuary_info
     restart identity cascade`,
  ])
  execFileSync('docker', ['restart', 'banka-bank-1', 'banka-trading-1'], { encoding: 'utf8' })
  waitForHealthy('banka-bank-1', 15)
  waitForHealthy('banka-trading-1', 15)
  // Container "running" isn't the same as "serving" — poll the
  // services' readiness probes so the gateway has a real backend
  // to call when the test starts.
  waitForReady('http://localhost:8082/readyz', 30)
  waitForReady('http://localhost:8083/readyz', 30)
  // Re-seed the bootstrap admin via the existing seed program. The go
  // toolchain may live in a nix path that cypress didn't inherit;
  // augment PATH from CYPRESS_GO_BIN if provided, otherwise scan
  // /nix/store for a go-1.* directory.
  const goBin = process.env.CYPRESS_GO_BIN ?? findNixGoBin()
  const augmentedPath = goBin
    ? `${goBin}:${process.env.PATH ?? ''}`
    : (process.env.PATH ?? '')
  execFileSync('bash', ['-c', 'cd ' + BACKEND_REPO + ' && bash scripts/db/seed.sh'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: augmentedPath,
      DATABASE_URL: `postgres://${PG_USER}:banka@localhost:5432/${PG_DB}?sslmode=disable`,
      // The c4 fund specs self-fixture their own funds and assume a
      // pristine klijent. The seed's demo investment-fund mock data
      // (klijent invests, fund holdings, perf history) would pollute
      // that baseline, so opt out of it for the cypress reseed.
      SEED_FUNDS: '0',
      // Order specs self-fixture their own orders and several read
      // /api/v1/orders?status=pending expecting only their own row;
      // skip the historical done-order (Profit Banke) fixture.
      SEED_ORDERS: '0',
      // The c4 profit spec asserts the minimal known leaderboard
      // fixture (agent/supervisor totals + reconciling counts); the
      // spread-out "Kretanje profita" demo series would skew both.
      SEED_PROFIT_DEMO: '0',
    },
  })
  return { ok: true }
}

function waitForHealthy(container: string, maxSeconds: number): void {
  for (let i = 0; i < maxSeconds; i++) {
    try {
      const out = execFileSync('docker', ['inspect', '-f', '{{.State.Status}}', container], {
        encoding: 'utf8',
      }).trim()
      if (out === 'running') return
    } catch {
      // ignore — container may not exist yet
    }
    execFileSync('sleep', ['1'])
  }
}

function waitForReady(url: string, maxSeconds: number): void {
  for (let i = 0; i < maxSeconds; i++) {
    try {
      const code = execFileSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', url], {
        encoding: 'utf8',
      }).trim()
      if (code === '200') return
    } catch {
      // not up yet
    }
    execFileSync('sleep', ['1'])
  }
}

// pgSql runs an arbitrary SQL statement against the test Postgres so
// specs can plant fixtures the FE/gateway can't (e.g. backdating an
// otc_contracts.settlement_date so the c4-tests S22 / S27 expired-
// contract scenarios become reproducible). Returns the rows as a JSON
// blob when the statement is a SELECT, otherwise an empty array.
// Spec-only: never call this against a real environment.
function pgSql({ sql }: { sql: string }): unknown {
  const out = dockerExec(POSTGRES_CONTAINER, [
    'psql',
    '-U',
    PG_USER,
    '-d',
    PG_DB,
    '-A',
    '-t',
    '-c',
    sql,
  ])
  // psql -A -t emits one row per line, columns joined by '|'. For
  // assertions we just hand back the raw text; specs that need
  // structured data can split themselves. Trim trailing newlines so
  // an empty result is "".
  return out.replace(/\n+$/, '')
}

// latestLink scrapes service stdout for the most recent email body
// addressed to `to` containing `marker` (e.g. "/activate?token="),
// returns the rest of the URL up to the first whitespace or backslash-n.
// When NOTIFICATION_GRPC_ADDR is wired (c4 PR4) emails route through
// notification-svc and its LogSender is the source of truth; the
// older user-svc path is kept as a fallback for slice-1 dev.
function latestLink({ to, marker }: { to: string; marker: string }): string {
  for (const container of [NOTIFICATION_CONTAINER, USER_CONTAINER]) {
    const logs = execFileSync('docker', ['logs', '--tail', '500', container], {
      encoding: 'utf8',
    })
    const lines = logs.split('\n').filter((l) => l.includes('"email') && l.includes(`"${to}"`))
    for (let i = lines.length - 1; i >= 0; i--) {
      const idx = lines[i].indexOf(marker)
      if (idx < 0) continue
      const rest = lines[i].slice(idx + marker.length)
      // Email body is JSON-escaped, so the URL ends at the first \n
      // sequence (literal backslash + n) or quote.
      const end = rest.search(/\\n|"/)
      return end < 0 ? rest : rest.slice(0, end)
    }
  }
  return ''
}

export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL ?? 'http://localhost:5173',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1440,
    viewportHeight: 900,
    // Vite-dev compiles route bundles lazily; the first cy.visit on a
    // new route after a docker restart can paint 4-8 s late, and in
    // sustained headless runs the containerised dev server takes
    // 20-30 s to repaint cold routes (login form, profit-banke heading).
    // 30 s absorbs that without being chatty on real failures.
    defaultCommandTimeout: 30000,
    setupNodeEvents(on) {
      on('task', {
        resetBackend,
        latestLink,
        pgSql,
      })
    },
    // One auto-retry in headless mode absorbs the vite cold-start
    // flake on the first cy.visit of multi-spec runs (vite-dev
    // lazy-bundles deps + the resetBackend container bounce can push
    // first paint past timeouts). Interactive (`cypress open`) keeps
    // zero retries so failures are visible while iterating.
    retries: { runMode: 1, openMode: 0 },
  },
  video: false,
})
