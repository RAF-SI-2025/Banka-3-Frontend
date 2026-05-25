// Cypress config dedicated to celina-5 inter-bank communication tests.
// Talks to TWO running Banka 3 stacks:
//   * Bank 1 (default `banka` compose project) — gateway at :8080
//   * Bank 2 (partner `banka-partner` compose project) — gateway at :8090
// Bring them up with `make interbank-up` in Banka-3-Backend before
// running this suite.
//
// Specs live in `cypress/interbank/` and drive both gateways via
// cy.request (no FE UI navigation — what we're testing is cross-bank
// REST roundtrips, not screen rendering).

import { defineConfig } from 'cypress'
import { execFileSync } from 'node:child_process'

const BANK1_BASE = process.env.CYPRESS_BANK1_BASE ?? 'http://localhost:8080'
const BANK2_BASE = process.env.CYPRESS_BANK2_BASE ?? 'http://localhost:8090'
const INTERBANK_API_KEY = process.env.CYPRESS_INTERBANK_API_KEY ?? 'dev-outbound-banka3'

const BANK1_POSTGRES = process.env.CYPRESS_BANK1_POSTGRES_CONTAINER ?? 'banka-postgres-1'
const BANK2_POSTGRES = process.env.CYPRESS_BANK2_POSTGRES_CONTAINER ?? 'banka-partner-postgres-1'

function dockerExec(container: string, args: string[]): string {
  return execFileSync('docker', ['exec', container, ...args], {
    encoding: 'utf8',
  })
}

// resetInterbankSchemas wipes only the c5 tables on both banks so a
// spec can replay from a known-empty state without disturbing the
// rest of the seeded fixtures (clients, holdings, etc).
function resetInterbankSchemas(): { ok: true } {
  const truncate =
    'truncate "trading".external_otc_contracts, "trading".external_otc_iterations, ' +
    '"trading".external_otc_threads, "bank".interbank_protocol_messages, ' +
    '"bank".interbank_protocol_transactions cascade'
  for (const container of [BANK1_POSTGRES, BANK2_POSTGRES]) {
    dockerExec(container, ['psql', '-U', 'banka', '-d', 'banka', '-c', truncate])
  }
  return { ok: true }
}

function pgSql(container: string, sql: string): unknown {
  const out = dockerExec(container, [
    'psql',
    '-U',
    'banka',
    '-d',
    'banka',
    '--csv',
    '-c',
    sql,
  ])
  // strip the header row + drop any blank tail.
  const lines = out.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length <= 1) return []
  return lines.slice(1).map((row) => row.split(','))
}

export default defineConfig({
  e2e: {
    specPattern: 'cypress/interbank/**/*.cy.ts',
    supportFile: 'cypress/interbank/support.ts',
    chromeWebSecurity: false,
    video: false,
    retries: { runMode: 0, openMode: 0 },
    env: {
      BANK1_BASE,
      BANK2_BASE,
      INTERBANK_API_KEY,
    },
    setupNodeEvents(on) {
      on('task', {
        resetInterbank: () => resetInterbankSchemas(),
        bank1Sql: (sql: string) => pgSql(BANK1_POSTGRES, sql),
        bank2Sql: (sql: string) => pgSql(BANK2_POSTGRES, sql),
      })
    },
  },
})
