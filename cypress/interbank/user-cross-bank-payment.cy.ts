// Celina 5 — user-initiated cross-bank cash payment.
//
// Drives POST /api/v1/payments/interbank as a logged-in client on
// bank 1; the saga's prepare/commit on the partner side lands on bank
// 2's gateway via the configured INTERBANK_ROUTES.
//
// Covers:
//   * happy path: balance moves on both banks + saga reaches commit_local
//   * verification-kind discrimination: a payment-kind code is REJECTED
//     for this route (only ActionInterbankPayment satisfies it)
//   * idempotency: same idempotency_key replays the same saga row
//
// Prereq: both stacks up + seeded.
//   make interbank-up   # in Banka-3-Backend

interface VerificationResp { verificationId: string; code: string }
interface SubmitResp { transactionId: string; status: string; lastError?: string }
interface GetResp { transactionId: string; status: string; currentStep: string }

const SOURCE_CURRENCY = 'CURRENCY_EUR'
const AMOUNT_HAPPY = '125.00'
const AMOUNT_IDEM = '37.50'

function pickClientEurAccount(): Cypress.Chainable<{ id: string; number: string; before: number }> {
  return cy
    .task<string[][]>(
      'bank1Sql',
      "select id, number, available_balance::text from \"bank\".accounts " +
        "where currency='EUR' and substring(number,1,3)='333' " +
        "and kind='personal_fx' and status='active' " +
        "order by available_balance desc limit 1",
    )
    .then((rows) => {
      if (rows.length === 0) throw new Error('no 333-prefixed EUR personal_fx account')
      const [id, number, balance] = rows[0]!
      return { id: id!, number: number!, before: Number(balance!) }
    })
}

function pickPartnerEurAccount(): Cypress.Chainable<string> {
  return cy
    .task<string[][]>(
      'bank2Sql',
      "select number from \"bank\".accounts " +
        "where currency='EUR' and substring(number,1,3)='334' " +
        "and status='active' order by available_balance desc limit 1",
    )
    .then((rows) => {
      if (rows.length === 0) throw new Error('no 334-prefixed EUR account on partner')
      return rows[0]![0]!
    })
}

function issueCode(token: string, kind: 'payment' | 'interbank_payment'): Cypress.Chainable<VerificationResp> {
  // The phone is the second factor: read the code off the pending list
  // (what the mobile app polls), not the request response.
  return cy
    .bankRequest(
      'bank1',
      {
        method: 'POST',
        url: '/api/v1/verification/request',
        body: { actionKind: kind },
      },
      token,
    )
    .then((r) => {
      expect(r.status, `issue ${kind}`).to.eq(200)
      const id = (r.body as VerificationResp).verificationId
      return cy
        .bankRequest('bank1', { method: 'GET', url: '/api/v1/verification/pending' }, token)
        .then((p) => {
          const pending = (p.body as { pending?: Array<{ id: string; code: string }> }).pending ?? []
          const item = pending.find((v) => v.id === id)
          if (!item) throw new Error(`pending verification ${id} not found`)
          return { verificationId: id, code: item.code }
        })
    })
}

function submit(
  token: string,
  ver: VerificationResp,
  body: Record<string, unknown>,
): Cypress.Chainable<Cypress.Response<unknown>> {
  return cy.bankRequest(
    'bank1',
    {
      method: 'POST',
      url: '/api/v1/payments/interbank',
      headers: {
        'X-Verification-Id': ver.verificationId,
        'X-Verification-Code': ver.code,
      },
      body,
    },
    token,
  )
}

describe('celina 5 — user-initiated cross-bank cash payment', () => {
  beforeEach(() => {
    cy.task('resetInterbank')
  })

  it('happy path: saga completed, money moves on both banks', () => {
    cy.bankLogin('bank1', 'klijent@banka.local', 'Klijent123!').then((tok) => {
      pickClientEurAccount().then((src) => {
        pickPartnerEurAccount().then((destNumber) => {
          const idem = `cy-pay-${crypto.randomUUID().slice(0, 8)}`
          issueCode(tok, 'interbank_payment').then((ver) => {
            submit(tok, ver, {
              idempotency_key: idem,
              source_account_id: src.id,
              remote_bank_code: '334',
              remote_account_number: destNumber,
              currency: SOURCE_CURRENCY,
              amount: AMOUNT_HAPPY,
              purpose: 'cypress cross-bank happy path',
            }).then((r) => {
              expect(r.status, JSON.stringify(r.body)).to.eq(200)
              const body = r.body as SubmitResp
              expect(body.status).to.eq('completed')
              expect(body.lastError ?? '').to.eq('')

              // Saga row reached commit_local.
              cy.task<string[][]>(
                'bank1Sql',
                `select status, current_step from "trading".saga_executions where transaction_id='${body.transactionId}'`,
              ).then((rows) => {
                expect(rows.length).to.eq(1)
                expect(rows[0]![0], 'saga.status').to.eq('completed')
                expect(rows[0]![1], 'saga.current_step').to.eq('commit_local')
              })

              // Bank-side outbound row committed on bank1.
              cy.task<string[][]>(
                'bank1Sql',
                `select direction, status, amount::text from "bank".interbank_protocol_transactions where transaction_id='${body.transactionId}'`,
              ).then((rows) => {
                expect(rows[0]![0]).to.eq('outbound')
                expect(rows[0]![1]).to.eq('committed')
                expect(Number(rows[0]![2]!)).to.eq(Number(AMOUNT_HAPPY))
              })

              // Bank-side inbound row committed on bank2.
              cy.task<string[][]>(
                'bank2Sql',
                `select direction, status, amount::text from "bank".interbank_protocol_transactions where transaction_id='${body.transactionId}'`,
              ).then((rows) => {
                expect(rows.length, 'partner saw the inbound').to.eq(1)
                expect(rows[0]![0]).to.eq('inbound')
                expect(rows[0]![1]).to.eq('committed')
                expect(Number(rows[0]![2]!)).to.eq(Number(AMOUNT_HAPPY))
              })

              // Source balance debited by exactly AMOUNT_HAPPY.
              cy.task<string[][]>(
                'bank1Sql',
                `select available_balance::text from "bank".accounts where id='${src.id}'`,
              ).then((rows) => {
                const after = Number(rows[0]![0]!)
                expect(src.before - after, 'EUR debited from source').to.eq(Number(AMOUNT_HAPPY))
              })

              // GET projection returns the same status.
              cy.bankRequest(
                'bank1',
                { method: 'GET', url: `/api/v1/payments/interbank/${body.transactionId}` },
                tok,
              ).then((g) => {
                expect(g.status).to.eq(200)
                const view = g.body as GetResp
                expect(view.status).to.eq('completed')
                expect(view.currentStep).to.eq('commit_local')
              })
            })
          })
        })
      })
    })
  })

  it('payment-kind code is rejected on /payments/interbank (distinct kind gate)', () => {
    cy.bankLogin('bank1', 'klijent@banka.local', 'Klijent123!').then((tok) => {
      pickClientEurAccount().then((src) => {
        pickPartnerEurAccount().then((destNumber) => {
          // Issue an intra-bank payment code (wrong kind for this route).
          issueCode(tok, 'payment').then((ver) => {
            submit(tok, ver, {
              idempotency_key: `cy-wrong-${crypto.randomUUID().slice(0, 8)}`,
              source_account_id: src.id,
              remote_bank_code: '334',
              remote_account_number: destNumber,
              currency: SOURCE_CURRENCY,
              amount: '1.00',
              purpose: 'cypress wrong-kind',
            }).then((r) => {
              expect(r.status, JSON.stringify(r.body)).to.eq(401)
              const body = r.body as { message?: string }
              expect(body.message ?? '').to.contain('Verifikacioni kod ne odgovara')
            })

            // Source balance unchanged.
            cy.task<string[][]>(
              'bank1Sql',
              `select available_balance::text from "bank".accounts where id='${src.id}'`,
            ).then((rows) => {
              expect(Number(rows[0]![0]!), 'no debit').to.eq(src.before)
            })
          })
        })
      })
    })
  })

  it('repeated submit with same idempotency_key replays the same tx (no double-charge)', () => {
    cy.bankLogin('bank1', 'klijent@banka.local', 'Klijent123!').then((tok) => {
      pickClientEurAccount().then((src) => {
        pickPartnerEurAccount().then((destNumber) => {
          const idem = `cy-idem-${crypto.randomUUID().slice(0, 8)}`
          const body = {
            idempotency_key: idem,
            source_account_id: src.id,
            remote_bank_code: '334',
            remote_account_number: destNumber,
            currency: SOURCE_CURRENCY,
            amount: AMOUNT_IDEM,
            purpose: 'cypress idem',
          }

          issueCode(tok, 'interbank_payment').then((v1) => {
            submit(tok, v1, body).then((r1) => {
              expect(r1.status).to.eq(200)
              const firstTxID = (r1.body as SubmitResp).transactionId
              expect((r1.body as SubmitResp).status).to.eq('completed')

              // Replay with a fresh verification code BUT the same
              // idempotency_key — saga.Start replays the existing row.
              issueCode(tok, 'interbank_payment').then((v2) => {
                submit(tok, v2, body).then((r2) => {
                  expect(r2.status).to.eq(200)
                  const replayTxID = (r2.body as SubmitResp).transactionId
                  expect(replayTxID, 'same tx id').to.eq(firstTxID)
                  expect((r2.body as SubmitResp).status).to.eq('completed')
                })
              })

              // Exactly one saga row + one bank-side committed row.
              cy.task<string[][]>(
                'bank1Sql',
                `select count(*) from "trading".saga_executions where transaction_id='${firstTxID}'`,
              ).then((rows) => expect(rows[0]![0]).to.eq('1'))

              cy.task<string[][]>(
                'bank1Sql',
                `select count(*) from "bank".interbank_protocol_transactions where transaction_id='${firstTxID}'`,
              ).then((rows) => expect(rows[0]![0]).to.eq('1'))

              // And we were debited exactly AMOUNT_IDEM (not 2 × it).
              cy.task<string[][]>(
                'bank1Sql',
                `select available_balance::text from "bank".accounts where id='${src.id}'`,
              ).then((rows) => {
                expect(src.before - Number(rows[0]![0]!)).to.eq(Number(AMOUNT_IDEM))
              })
            })
          })
        })
      })
    })
  })
})
