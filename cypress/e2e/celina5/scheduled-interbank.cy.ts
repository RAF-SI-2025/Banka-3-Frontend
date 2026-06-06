/// <reference types="cypress" />

export {}

// Celina 5 (todoSpec "Scheduled/periodic inter-bank payments") — the
// client surface at /banking/placanja/inostrane-zakazane. A client
// schedules a cross-bank payment (dest bank code + 18-digit dest account,
// amount, cadence, optional start date), the row appears as Aktivna, and
// can be paused / resumed / cancelled.
//
// Single-stack coverage: this tests the LOCAL side only — create / list /
// pause / resume / cancel + validation. The actual periodic execution
// (the trading-scheduled-interbank daily sweep) drives the cross-bank 2PC
// path against a PARTNER bank and is therefore cron + second-stack
// driven; cypress/interbank/* covers the round-trip with a dual stack.
// SKIP (cron/partner): periodic execution + partner round-trip — see note
// at the end.
//
// Account-number checksum is the spec p.checksum algorithm sum(digits)%11;
// the FE only gates length===18, the backend enforces the checksum + the
// "account belongs to bank" prefix + future-date rules, surfacing a
// Serbian ErrorBanner on reject.

const DEST_BANK = '222'

// validAcct builds an 18-digit account number that starts with `prefix`
// and whose digit sum is divisible by 11 (the cross-bank checksum). We
// fill the middle with zeros and tune the final digits so sum % 11 == 0.
function validAcct(prefix: string): string {
  const head = (prefix + '0'.repeat(18)).slice(0, 16) // 16 digits, rest zero
  const headSum = head.split('').reduce((a, c) => a + Number(c), 0)
  // Two trailing digits chosen so (headSum + tail) % 11 == 0.
  const need = (11 - (headSum % 11)) % 11 // 0..10
  const tail = String(need).padStart(2, '0') // <= 10 → "00".."10"
  const num = head + tail
  // Sanity: 18 digits, divisible by 11.
  const sum = num.split('').reduce((a, c) => a + Number(c), 0)
  if (num.length !== 18 || sum % 11 !== 0) {
    throw new Error(`validAcct produced bad number ${num} (sum ${sum})`)
  }
  return num
}

// invalidAcct: 18 digits, right prefix, but digit sum NOT divisible by 11.
function invalidAcct(prefix: string): string {
  const base = validAcct(prefix)
  // Bump the last digit by 1 (mod 10) so the checksum breaks while length
  // + prefix stay valid. If that lands back on a multiple of 11, bump
  // again.
  let n = base
  for (let i = 0; i < 11; i++) {
    const last = Number(n[17])
    n = n.slice(0, 17) + String((last + 1) % 10)
    const sum = n.split('').reduce((a, c) => a + Number(c), 0)
    if (sum % 11 !== 0) return n
  }
  throw new Error('could not derive invalid checksum number')
}

function futureDate(daysAhead: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return d.toISOString().slice(0, 10)
}

function pastDate(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

describe('Celina 5 — scheduled cross-bank payments (local side)', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('kreira mesečnu zakazanu uplatu, pa pauza / nastavi / otkaži', () => {
    const dest = validAcct(DEST_BANK)

    cy.loginAsClient()
    cy.visit('/banking/placanja/inostrane-zakazane')
    cy.contains('h1', 'Zakazane inostrane uplate', { timeout: 15000 }).should('be.visible')
    // Starts empty (SEED has no scheduled rows).
    cy.get('[data-cy="scheduled-interbank-empty"]', { timeout: 15000 }).should('be.visible')

    // The source-account select auto-populates from the client's active
    // accounts; pick the first non-placeholder option.
    cy.get('[data-cy="scheduled-interbank-account"]', { timeout: 15000 })
      .find('option')
      .eq(1)
      .then(($opt) => {
        cy.get('[data-cy="scheduled-interbank-account"]').select($opt.val() as string)
      })
    cy.get('[data-cy="scheduled-interbank-bank"]').clear().type(DEST_BANK)
    cy.get('[data-cy="scheduled-interbank-dest"]').clear().type(dest)
    cy.get('[data-cy="scheduled-interbank-amount"]').clear().type('400')
    cy.get('[data-cy="scheduled-interbank-cadence"]').select('MONTHLY')
    cy.get('[data-cy="scheduled-interbank-date"]').type(futureDate(7))
    cy.get('[data-cy="scheduled-interbank-submit"]').should('not.be.disabled').click()

    // The new row lands as Aktivna in "Moje zakazane uplate".
    cy.get('[data-cy="scheduled-interbank-list"]', { timeout: 15000 }).should('exist')
    cy.get('[data-cy="scheduled-interbank-item"]').should('have.length', 1)
    cy.get('[data-cy="scheduled-interbank-item-dest"]').should('contain', dest)
    cy.get('[data-cy="scheduled-interbank-item-status"]').should('contain', 'Aktivna')

    // Pause → "Pauzirana"; resume → "Aktivna".
    cy.get('[data-cy="scheduled-interbank-pause"]').click()
    cy.get('[data-cy="scheduled-interbank-item-status"]', { timeout: 15000 }).should(
      'contain',
      'Pauzirana',
    )
    cy.get('[data-cy="scheduled-interbank-resume"]').click()
    cy.get('[data-cy="scheduled-interbank-item-status"]', { timeout: 15000 }).should(
      'contain',
      'Aktivna',
    )

    // Cancel → the row drops out of the list (cancel deactivates +
    // ListScheduledInterbankPaymentsByUser excludes cancelled rows).
    cy.get('[data-cy="scheduled-interbank-cancel"]').click()
    cy.get('[data-cy="scheduled-interbank-empty"]', { timeout: 15000 }).should('be.visible')
  })

  it('odbija nevažeći checksum destinacijskog računa', () => {
    const badAcct = invalidAcct(DEST_BANK)

    cy.loginAsClient()
    cy.visit('/banking/placanja/inostrane-zakazane')
    cy.contains('h1', 'Zakazane inostrane uplate', { timeout: 15000 }).should('be.visible')

    cy.get('[data-cy="scheduled-interbank-account"]', { timeout: 15000 })
      .find('option')
      .eq(1)
      .then(($opt) => {
        cy.get('[data-cy="scheduled-interbank-account"]').select($opt.val() as string)
      })
    cy.get('[data-cy="scheduled-interbank-bank"]').clear().type(DEST_BANK)
    // 18 digits so the FE submit gate opens, but a broken checksum.
    cy.get('[data-cy="scheduled-interbank-dest"]').clear().type(badAcct)
    cy.get('[data-cy="scheduled-interbank-amount"]').clear().type('400')
    cy.get('[data-cy="scheduled-interbank-cadence"]').select('MONTHLY')
    cy.get('[data-cy="scheduled-interbank-date"]').type(futureDate(7))
    cy.get('[data-cy="scheduled-interbank-submit"]').should('not.be.disabled').click()

    // Backend rejects on the checksum; the Serbian error surfaces and no
    // row is created.
    cy.contains(/checksum/i, { timeout: 15000 }).should('be.visible')
    cy.get('[data-cy="scheduled-interbank-empty"]').should('be.visible')
  })

  it('odbija datum početka u prošlosti', () => {
    const dest = validAcct(DEST_BANK)

    cy.loginAsClient()
    cy.visit('/banking/placanja/inostrane-zakazane')
    cy.contains('h1', 'Zakazane inostrane uplate', { timeout: 15000 }).should('be.visible')

    cy.get('[data-cy="scheduled-interbank-account"]', { timeout: 15000 })
      .find('option')
      .eq(1)
      .then(($opt) => {
        cy.get('[data-cy="scheduled-interbank-account"]').select($opt.val() as string)
      })
    cy.get('[data-cy="scheduled-interbank-bank"]').clear().type(DEST_BANK)
    cy.get('[data-cy="scheduled-interbank-dest"]').clear().type(dest)
    cy.get('[data-cy="scheduled-interbank-amount"]').clear().type('400')
    cy.get('[data-cy="scheduled-interbank-cadence"]').select('ONCE')
    cy.get('[data-cy="scheduled-interbank-date"]').type(pastDate(5))
    cy.get('[data-cy="scheduled-interbank-submit"]').should('not.be.disabled').click()

    // Backend rejects: "datum početka mora biti u budućnosti".
    cy.contains(/budućnosti/i, { timeout: 15000 }).should('be.visible')
    cy.get('[data-cy="scheduled-interbank-empty"]').should('be.visible')
  })

  // SKIP (cron/partner): the periodic execution of a scheduled payment is
  // run by the trading-scheduled-interbank daily sweep, which drives the
  // cross-bank 2PC SubmitCrossBankPayment against a partner bank. That
  // requires a second bank stack + a cron tick neither of which a single
  // Cypress stack exposes. The dual-stack round-trip is covered by
  // cypress/interbank/cross-bank-payments.cy.ts.
})
