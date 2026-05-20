import { defineConfig } from 'cypress'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

// Soak-E2E config — runs the existing per-spec-reset celina3 suite
// against ONE persistent backend, no reset between specs. Every
// spec's call to `cy.resetBackend()` after the first becomes a no-op,
// so subsequent specs run on top of whatever state the previous spec
// left behind: orders, executions, holdings, realized gains, agent
// usedLimit, idempotency-key history, sagas, the lot.
//
// Goal: surface state-leak / idempotency / cumulative-counter bugs
// that the per-spec-reset suite under `cypress/e2e/` can't see and
// that the single-spec soak under `cypress/soak/` only stresses
// inside one journey. The trade-off is that absolute assertions
// (`should('have.length', 1)`, "no orders" empty-states) in the
// existing specs will fail under accumulated state — those failures
// are the punch list.

const POSTGRES_CONTAINER = process.env.CYPRESS_POSTGRES_CONTAINER ?? 'banka-postgres-1'
const USER_CONTAINER = process.env.CYPRESS_USER_CONTAINER ?? 'banka-user-1'
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
  return execFileSync('docker', ['exec', container, ...args], { encoding: 'utf8' })
}

function waitForHealthy(container: string, maxSeconds: number): void {
  for (let i = 0; i < maxSeconds; i++) {
    try {
      const out = execFileSync('docker', ['inspect', '-f', '{{.State.Status}}', container], {
        encoding: 'utf8',
      }).trim()
      if (out === 'running') return
    } catch {
      // ignore
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

function fullReset(): void {
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
              "bank".transactions, "bank".accounts, "bank".companies,
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
  waitForReady('http://localhost:8082/readyz', 30)
  waitForReady('http://localhost:8083/readyz', 30)
  const goBin = process.env.CYPRESS_GO_BIN ?? findNixGoBin()
  const augmentedPath = goBin ? `${goBin}:${process.env.PATH ?? ''}` : (process.env.PATH ?? '')
  execFileSync('bash', ['-c', 'cd ' + BACKEND_REPO + ' && bash scripts/db/seed.sh'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: augmentedPath,
      DATABASE_URL: `postgres://${PG_USER}:banka@localhost:5432/${PG_DB}?sslmode=disable`,
    },
  })
}

// One-shot reset: first call wipes + reseeds so spec #1 starts on a
// known clean slate; every subsequent call (including all later specs)
// no-ops. State accumulates across specs from there on.
let didReset = false
function oneShotReset(): { ok: true; reset: boolean } {
  if (didReset) {
    return { ok: true, reset: false }
  }
  fullReset()
  didReset = true
  return { ok: true, reset: true }
}

// pgSql mirrors cypress.config.ts's task so specs that use
// cy.resetAgentLimit / cy.clearExchangeOverride / etc. work in the
// soak-e2e harness too. Returns rows as raw psql -A -t text
// (pipe-separated columns, newline-separated rows).
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
  return out.replace(/\n+$/, '')
}

function latestLink({ to, marker }: { to: string; marker: string }): string {
  const logs = execFileSync('docker', ['logs', '--tail', '500', USER_CONTAINER], {
    encoding: 'utf8',
  })
  const lines = logs.split('\n').filter((l) => l.includes('"email') && l.includes(`"${to}"`))
  for (let i = lines.length - 1; i >= 0; i--) {
    const idx = lines[i].indexOf(marker)
    if (idx < 0) continue
    const rest = lines[i].slice(idx + marker.length)
    const end = rest.search(/\\n|"/)
    return end < 0 ? rest : rest.slice(0, end)
  }
  return ''
}

export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL ?? 'http://localhost:5173',
    specPattern: 'cypress/e2e/celina3/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1440,
    viewportHeight: 900,
    setupNodeEvents(on) {
      on('task', {
        resetBackend: oneShotReset,
        latestLink,
        pgSql,
      })
    },
    // One retry in headless mode absorbs vite's cold-start lazy-bundling
    // flake on the very first cy.visit (same as cypress.config.ts). The
    // first spec runs against a fresh wipe+seed, so a retry there is safe;
    // later specs run on accumulated state, and any state-leak failure
    // will reproduce on retry too (the failed attempt's side effects are
    // additive, not corrective).
    retries: { runMode: 1, openMode: 0 },
  },
  video: false,
})
