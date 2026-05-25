// Celina 5 — cross-bank 2PC payment primitive.
//
// Drives bank.InterbankProtocolService directly via the partner-facing
// REST surface (the same routes a peer bank would call). The user-
// facing "client initiates a cross-bank payment" flow doesn't exist as
// a dedicated endpoint yet — the 2PC primitive is currently only used
// by trading's external_otc_accept + external_otc_exercise sagas. This
// suite proves the primitive itself works end-to-end between the two
// Banka 3 instances:
//
//   * happy path — prepare → commit lands money on the receiver, gets
//     deducted on the sender via the matching same-bank leg.
//   * rollback — prepare → rollback releases the reservation; balance
//     is unchanged.
//   * idempotency — repeating prepare with the same payload returns the
//     cached message; the underlying reservation count does not grow.

const API_KEY = 'dev-outbound-banka3'

interface AccountRow {
  id: string
  number: string
  currency: string
  availableBalance: string
}

type Bank = 'bank1' | 'bank2'

function rsdAccounts(bank: Bank, token: string): Cypress.Chainable<AccountRow[]> {
  return cy
    .bankRequest(bank, { method: 'GET', url: '/api/v1/accounts' }, token)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .then((r) => ((r.body as any)?.accounts ?? []) as AccountRow[])
    .then((accts) => accts.filter((a) => a.currency === 'CURRENCY_RSD'))
}

function pickRsdAccount(bank: Bank, token: string): Cypress.Chainable<AccountRow> {
  return rsdAccounts(bank, token).then((accts) => {
    // Filter to RSD accounts with positive balance; seed plants both
    // a -60k overdraft fixture and a +499k spending account.
    const usable = accts.filter((a) => Number(a.availableBalance) > 10_000)
    if (usable.length === 0) throw new Error(`${bank}: no funded RSD account`)
    return usable[0]!
  })
}

function uuid(): string {
  return crypto.randomUUID()
}

describe('celina 5 — cross-bank 2PC payment primitive', () => {
  beforeEach(() => {
    cy.task('resetInterbank')
  })

  it('prepare → commit moves money cross-bank (inbound to bank B)', () => {
    cy.bankLogin('bank1', 'klijent@banka.local', 'Klijent123!').then((tokA) => {
      cy.bankLogin('bank2', 'klijent@banka.local', 'Klijent123!').then((tokB) => {
        pickRsdAccount('bank1', tokA).then((senderA) => {
          pickRsdAccount('bank2', tokB).then((recipientB) => {
            const txID = uuid()
            const amount = '1000.00'

            // Bank A's outbound view: drive bank A's local debit via the
            // /bank/api/v1/interbank/transactions endpoint with direction
            // OUTBOUND (we are the sender). Use bank A's own
            // partner-facing route since the user-facing initiate flow
            // isn't built yet.
            cy.bankRequest(
              'bank1',
              {
                method: 'POST',
                url: '/bank/api/v1/interbank/transactions',
                headers: {
                  'X-Api-Key': API_KEY,
                  'X-Idempotence-Key': uuid(),
                },
                body: {
                  sender_routing_number: 333,
                  transaction_id: txID,
                  direction: 'outbound',
                  local_account_number: senderA.number,
                  remote_account_number: recipientB.number,
                  currency: 'RSD',
                  amount,
                  purpose: 'cypress 2pc happy-path',
                },
              },
            ).then((prepA) => {
              expect(prepA.status, JSON.stringify(prepA.body)).to.eq(200)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              expect((prepA.body as any).status).to.eq('prepared')
            })

            // Bank B's inbound view: partner says "credit your account".
            cy.bankRequest(
              'bank2',
              {
                method: 'POST',
                url: '/bank/api/v1/interbank/transactions',
                headers: {
                  'X-Api-Key': API_KEY,
                  'X-Idempotence-Key': uuid(),
                },
                body: {
                  sender_routing_number: 333,
                  transaction_id: txID,
                  direction: 'inbound',
                  local_account_number: recipientB.number,
                  remote_account_number: senderA.number,
                  currency: 'RSD',
                  amount,
                  purpose: 'cypress 2pc happy-path',
                },
              },
            ).then((prepB) => {
              expect(prepB.status, JSON.stringify(prepB.body)).to.eq(200)
            })

            // Commit both sides.
            cy.bankRequest('bank1', {
              method: 'POST',
              url: `/bank/api/v1/interbank/transactions/${txID}/commit`,
              headers: { 'X-Api-Key': API_KEY, 'X-Idempotence-Key': uuid() },
              body: { sender_routing_number: 333 },
            }).then((cA) => expect(cA.status).to.eq(200))

            cy.bankRequest('bank2', {
              method: 'POST',
              url: `/bank/api/v1/interbank/transactions/${txID}/commit`,
              headers: { 'X-Api-Key': API_KEY, 'X-Idempotence-Key': uuid() },
              body: { sender_routing_number: 333 },
            }).then((cB) => expect(cB.status).to.eq(200))

            // Both sides flipped to 'committed'.
            cy.task<string[][]>(
              'bank1Sql',
              `select status from "bank".interbank_protocol_transactions where transaction_id = '${txID}'`,
            ).then((rows) => {
              expect(rows.length).to.eq(1)
              expect(rows[0]?.[0]).to.eq('committed')
            })
            cy.task<string[][]>(
              'bank2Sql',
              `select status from "bank".interbank_protocol_transactions where transaction_id = '${txID}'`,
            ).then((rows) => {
              expect(rows.length).to.eq(1)
              expect(rows[0]?.[0]).to.eq('committed')
            })

            // Balances moved.
            rsdAccounts('bank1', tokA).then((after) => {
              const sa = after.find((a) => a.number === senderA.number)!
              expect(
                Number(sa.availableBalance),
                'bank A sender debited',
              ).to.be.lessThan(Number(senderA.availableBalance))
            })
            rsdAccounts('bank2', tokB).then((after) => {
              const rb = after.find((a) => a.number === recipientB.number)!
              expect(
                Number(rb.availableBalance),
                'bank B recipient credited',
              ).to.be.greaterThan(Number(recipientB.availableBalance))
            })
          })
        })
      })
    })
  })

  it('prepare → rollback releases the reservation without moving money', () => {
    cy.bankLogin('bank1', 'klijent@banka.local', 'Klijent123!').then((tokA) => {
      pickRsdAccount('bank1', tokA).then((senderA) => {
        const txID = uuid()
        cy.bankRequest('bank1', {
          method: 'POST',
          url: '/bank/api/v1/interbank/transactions',
          headers: { 'X-Api-Key': API_KEY, 'X-Idempotence-Key': uuid() },
          body: {
            sender_routing_number: 333,
            transaction_id: txID,
            direction: 'outbound',
            local_account_number: senderA.number,
            remote_account_number: '333000000000000000',
            currency: 'RSD',
            amount: '750.00',
            purpose: 'cypress 2pc rollback',
          },
        }).then((prep) => {
          expect(prep.status, JSON.stringify(prep.body)).to.eq(200)
        })

        cy.bankRequest('bank1', {
          method: 'POST',
          url: `/bank/api/v1/interbank/transactions/${txID}/rollback`,
          headers: { 'X-Api-Key': API_KEY, 'X-Idempotence-Key': uuid() },
          body: { sender_routing_number: 333, reason: 'cypress' },
        }).then((rb) => {
          expect(rb.status, JSON.stringify(rb.body)).to.eq(200)
        })

        cy.task<string[][]>(
          'bank1Sql',
          `select status from "bank".interbank_protocol_transactions where transaction_id = '${txID}'`,
        ).then((rows) => {
          expect(rows[0]?.[0]).to.eq('rolled_back')
        })

        rsdAccounts('bank1', tokA).then((after) => {
          const sa = after.find((a) => a.number === senderA.number)!
          expect(Number(sa.availableBalance)).to.eq(Number(senderA.availableBalance))
        })
      })
    })
  })

  it('repeated prepare with the same idempotence key is cached', () => {
    cy.bankLogin('bank1', 'klijent@banka.local', 'Klijent123!').then((tokA) => {
      pickRsdAccount('bank1', tokA).then((senderA) => {
        const txID = uuid()
        const idemKey = uuid()
        const body = {
          sender_routing_number: 333,
          transaction_id: txID,
          direction: 'outbound',
          local_account_number: senderA.number,
          remote_account_number: '333000000000000000',
          currency: 'RSD',
          amount: '500.00',
          purpose: 'cypress 2pc idempotency',
        }
        const headers = { 'X-Api-Key': API_KEY, 'X-Idempotence-Key': idemKey }

        cy.bankRequest('bank1', {
          method: 'POST',
          url: '/bank/api/v1/interbank/transactions',
          headers,
          body,
        }).then((r1) => {
          expect(r1.status).to.eq(200)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const txId1 = (r1.body as any).transaction_id

          // Re-fire with same idem key — must return the cached response.
          cy.bankRequest('bank1', {
            method: 'POST',
            url: '/bank/api/v1/interbank/transactions',
            headers,
            body,
          }).then((r2) => {
            expect(r2.status, 'replay 200').to.eq(200)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const txId2 = (r2.body as any).transaction_id
            expect(txId2, 'replay returns same tx id').to.eq(txId1)
          })

          // Exactly one row in the message table.
          cy.task<string[][]>(
            'bank1Sql',
            `select count(*) from "bank".interbank_protocol_messages where idempotence_key = '${idemKey}'`,
          ).then((rows) => {
            expect(rows[0]?.[0]).to.eq('1')
          })
        })
      })
    })
  })
})
