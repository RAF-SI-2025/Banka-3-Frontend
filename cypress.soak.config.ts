import { defineConfig } from 'cypress'
import { execFileSync } from 'node:child_process'

// Soak config — runs cypress against ONE persistent backend, no
// `resetBackend` task wired in. Specs build on each other and on the
// state left behind by previous runs.  Used to surface state-leak
// bugs (idempotency collisions, leftover pending order_executions,
// usedLimit accumulation, tax double-charge) that the per-spec-reset
// suite under cypress/e2e/ can't see.

const POSTGRES_CONTAINER = process.env.CYPRESS_POSTGRES_CONTAINER ?? 'banka-postgres-1'
const PG_USER = process.env.CYPRESS_PG_USER ?? 'banka'
const PG_DB = process.env.CYPRESS_PG_DB ?? 'banka'

// psql runs a query against the dev postgres container and parses the
// `--csv` output into an array of row objects.  Cheap enough to call
// inline from a spec; the alternative (a postgres pool in cypress's
// node side) would have to manage connection lifecycle across spec
// runs which isn't worth the complexity for an integration harness.
function psql({ sql, args = [] }: { sql: string; args?: string[] }): unknown[] {
  const params = args.flatMap((a, i) => ['-v', `p${i + 1}=${a}`])
  const csv = execFileSync(
    'docker',
    [
      'exec',
      POSTGRES_CONTAINER,
      'psql',
      '-U',
      PG_USER,
      '-d',
      PG_DB,
      '--csv',
      '--quiet',
      '--no-align',
      ...params,
      '-c',
      sql,
    ],
    { encoding: 'utf8' },
  )
  const lines = csv.split('\n').filter((l) => l.length > 0)
  if (lines.length === 0) return []
  const header = parseCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    const row: Record<string, string> = {}
    header.forEach((h, i) => {
      row[h] = cells[i] ?? ''
    })
    return row
  })
}

// Minimal CSV parser — handles psql's quoting (double-quoted strings,
// escaped quotes via "").  Postgres won't emit newlines inside values
// for our use case (we never SELECT json blobs), so line-at-a-time is
// safe.
function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') {
        inQ = false
      } else {
        cur += c
      }
    } else if (c === ',') {
      cells.push(cur)
      cur = ''
    } else if (c === '"' && cur === '') {
      inQ = true
    } else {
      cur += c
    }
  }
  cells.push(cur)
  return cells
}

export default defineConfig({
  e2e: {
    // Point at the gateway directly — the soak is fully API-driven
    // via cy.request(), no UI work, so vite-dev doesn't need to be
    // running.  Override via CYPRESS_BASE_URL if you want to hit the
    // vite proxy (e.g. to record traffic through devtools).
    baseUrl: process.env.CYPRESS_BASE_URL ?? 'http://localhost:8080',
    specPattern: 'cypress/soak/**/*.cy.ts',
    supportFile: 'cypress/soak/support/e2e.ts',
    viewportWidth: 1440,
    viewportHeight: 900,
    // testIsolation:false keeps browser state (cookies, storage)
    // across `it` blocks within the same spec so a journey built
    // out of sequential its sees a coherent SPA.  Specs that need
    // a clean slate clear state manually.
    testIsolation: false,
    // No auto-retry — flake in a soak run is signal.
    retries: 0,
    setupNodeEvents(on) {
      on('task', {
        psql,
      })
    },
  },
  video: false,
})
