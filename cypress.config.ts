import { defineConfig } from 'cypress'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

// Live-backend specs need to reset Postgres + Redis between specs and
// dig the most recent activation/reset link out of the user service's
// stdout. Both run as Cypress tasks so the spec stays declarative.

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
  return execFileSync('docker', ['exec', container, ...args], {
    encoding: 'utf8',
  })
}

function resetBackend(opts: { c2?: boolean } | null): { ok: true } {
  // Truncate every c1 user-schema table.
  dockerExec(POSTGRES_CONTAINER, [
    'psql',
    '-U',
    PG_USER,
    '-d',
    PG_DB,
    '-c',
    `truncate "user".employees, "user".clients, "user".refresh_tokens,
              "user".activation_tokens, "user".password_reset_tokens
     restart identity cascade`,
  ])
  // For c2 specs, also truncate bank schema (everything except system
  // accounts which the bank service re-seeds at boot, but here we let
  // EnsureSystemAccounts re-create them on next boot — easier to just
  // wipe everything and rely on the live container to re-seed).
  if (opts?.c2) {
    dockerExec(POSTGRES_CONTAINER, [
      'psql',
      '-U',
      PG_USER,
      '-d',
      PG_DB,
      '-c',
      `truncate
         "bank".loan_installments, "bank".loans, "bank".loan_requests,
         "bank".cards, "bank".authorized_persons, "bank".payment_recipients,
         "bank".transactions, "bank".accounts, "bank".companies
       restart identity cascade`,
    ])
    // Bank's house accounts are seeded at boot — bounce the container so
    // EnsureSystemAccounts runs again.
    execFileSync('docker', ['restart', 'banka-bank-1'], { encoding: 'utf8' })
    // Wait for bank to be healthy again (~3-4s typically).
    waitForHealthy('banka-bank-1', 15)
  }
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

// latestLink scrapes user-service stdout for the most recent email body
// addressed to `to` containing `marker` (e.g. "/activate?token="),
// returns the rest of the URL up to the first whitespace or backslash-n.
function latestLink({ to, marker }: { to: string; marker: string }): string {
  const logs = execFileSync('docker', ['logs', '--tail', '500', USER_CONTAINER], {
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
  return ''
}

export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL ?? 'http://localhost:5173',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1440,
    viewportHeight: 900,
    setupNodeEvents(on) {
      on('task', {
        resetBackend,
        latestLink,
      })
    },
  },
  video: false,
})
