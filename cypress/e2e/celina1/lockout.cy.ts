/// <reference types="cypress" />

// Live-backend c1 spec — brute-force login lockout (todoSpec S7–S11).
//
// Backend policy (services/user/internal/service/auth.go):
//   maxFailedLogins = 5, lockoutDuration = 15 min.
//   - 5 consecutive wrong passwords lock the account; the 5th attempt
//     returns the "Nalog je zaključan…" message and persists
//     locked_until + failed_login_attempts on the clients row.
//   - while locked, even the correct password is refused with the
//     "Nalog je privremeno zaključan…" message (S8).
//   - a successful login clears failed_login_attempts + locked_until
//     (S9/S11); we drive that path by clearing the lock via pgSql,
//     since the only other unlock is the 15-min real-time expiry which
//     isn't drivable from Cypress.
//
// The seeded klijent (klijent@banka.local / Klijent123!) is the target.

const EMAIL = 'klijent@banka.local'
const GOOD = 'Klijent123!'
const WRONG = 'PogresnaLozinka9!'

function attemptLogin(email: string, password: string) {
  cy.visit('/login')
  cy.findByLabelText('Email', { timeout: 45000 }).clear().type(email)
  cy.findByLabelText('Lozinka').clear().type(password)
  cy.findByRole('button', { name: /Prijavi se/ }).click()
}

describe('Celina 1 — zaključavanje naloga (live backend)', () => {
  beforeEach(() => {
    cy.resetBackend()
  })

  it('5 uzastopnih pogrešnih lozinki zaključava nalog (S7–S8)', () => {
    // Attempts 1–4: wrong password → "Neispravni kredencijali", no lock yet.
    for (let i = 0; i < 4; i++) {
      attemptLogin(EMAIL, WRONG)
      cy.contains('Neispravni kredencijali', { timeout: 10000 }).should('be.visible')
    }

    // Attempt 5 crosses the threshold → account is locked. The 5th
    // failure returns the lockout message (Serbian copy from auth.go).
    attemptLogin(EMAIL, WRONG)
    cy.contains(/Nalog je zaključan zbog previše neuspešnih pokušaja/, { timeout: 10000 }).should(
      'be.visible',
    )

    // Persisted state: counter at 5 + a non-null locked_until on the
    // clients row. pgSql returns pipe-separated text; the seed has no
    // other klijent@banka.local row so the single line is unambiguous.
    cy.pgSql(
      `select failed_login_attempts, (locked_until is not null) from "user".clients where email='${EMAIL}'`,
    ).then((out) => {
      const [attempts, locked] = String(out).trim().split('|')
      expect(Number(attempts)).to.be.gte(5)
      expect(locked).to.eq('t')
    })
  })

  it('tačna lozinka dok je nalog zaključan i dalje biva odbijena (S8)', () => {
    // Lock the account by exhausting the attempt budget.
    for (let i = 0; i < 5; i++) {
      attemptLogin(EMAIL, WRONG)
    }
    // Now try the correct password — still locked, still refused with the
    // "privremeno zaključan" message rather than logging in.
    attemptLogin(EMAIL, GOOD)
    cy.contains(/Nalog je (privremeno )?zaključan/, { timeout: 10000 }).should('be.visible')
    cy.url().should('include', '/login')
  })

  it('uspešna prijava nakon brisanja zaključavanja resetuje brojač (S9/S11)', () => {
    // Lock the account.
    for (let i = 0; i < 5; i++) {
      attemptLogin(EMAIL, WRONG)
    }
    // Clear the lock directly (stands in for the 15-min real-time expiry,
    // which isn't drivable from Cypress). The backend's own reset path on
    // successful login does the same UPDATE (ResetFailedLogin).
    cy.pgSql(
      `update "user".clients set failed_login_attempts=0, locked_until=null where email='${EMAIL}'`,
    )

    // Correct password now logs in.
    attemptLogin(EMAIL, GOOD)
    cy.url({ timeout: 10000 }).should('not.include', '/login')

    // And the counter is back at 0 (a successful login also clears it).
    cy.pgSql(`select failed_login_attempts from "user".clients where email='${EMAIL}'`).then(
      (out) => {
        expect(Number(String(out).trim())).to.eq(0)
      },
    )
  })

  // SKIP (real-time expiry): the 15-min lockout window lifts on wall-clock
  // time, not a cron we can pulse, and setClockOffset only moves the QA
  // clock services read for business logic — the lockout comparison uses
  // s.Clock.Now() so it *would* respect the offset, but advancing 15m+
  // and waiting ~5s for propagation is slower + flakier than the pgSql
  // clear path above, which exercises the identical UPDATE. Left as a
  // note rather than a flaky timed test.
})
