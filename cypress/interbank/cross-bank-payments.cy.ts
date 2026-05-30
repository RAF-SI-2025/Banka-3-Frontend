// Celina 5 — cross-bank payments 2PC primitive end-to-end.
//
// Exercises bank.InterbankProtocolService via the partner-facing REST
// surface (`/bank/api/v1/interbank/transactions`) on both directions:
//
//   * inbound prepare → commit (bank B credits a local account on
//     behalf of "bank A" the originator)
//   * inbound prepare → rollback (no balance change)
//   * idempotency: replaying a prepare with the same X-Idempotence-Key
//     returns the cached response and doesn't re-reserve
//
// The cypress test acts as bank A's outbound caller by hitting bank B's
// partner endpoints directly with X-Api-Key. The 2PC primitive is
// symmetric so the converse (bank B → bank A) is covered too.
//
// Prereq: both stacks running. `make interbank-up` in Banka-3-Backend.

interface PrepareResp {
  transaction_id?: string
  status?: string
  reservation_id?: string
}

interface CommitResp {
  transaction_id?: string
  status?: string
  op_id?: string
}

interface RollbackResp {
  transaction_id?: string
  status?: string
}

// Pull bank B's klijent USD account number from postgres so the test
// stays independent of seed UUIDs.
function bankBUSDAccount(): Cypress.Chainable<{ id: string; number: string; balance: string }> {
  return cy
    .task<string[][]>(
      'bank2Sql',
      `select id, number, balance::text from "bank".accounts
       where currency = 'USD' and kind = 'personal_fx'
       order by created_at limit 1`,
    )
    .then((rows) => {
      if (rows.length === 0) throw new Error('bank B has no USD personal_fx account')
      const [id, number, balance] = rows[0]!
      return { id: id!, number: number!, balance: balance! }
    })
}

function readBalance(accountId: string): Cypress.Chainable<number> {
  return cy
    .task<string[][]>(
      'bank2Sql',
      `select balance::text from "bank".accounts where id = '${accountId}'`,
    )
    .then((rows) => Number(rows[0]?.[0] ?? '0'))
}

function uuid(): string {
  // RFC4122-ish v4 — crypto.randomUUID() exists in Cypress' Node ctx.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as { randomUUID: () => string }).randomUUID()
  }
  // Fallback for older runners.
  let out = ''
  for (let i = 0; i < 32; i++) out += Math.floor(Math.random() * 16).toString(16)
  return (
    out.slice(0, 8) +
    '-' +
    out.slice(8, 12) +
    '-4' +
    out.slice(13, 16) +
    '-8' +
    out.slice(17, 20) +
    '-' +
    out.slice(20)
  )
}

describe('celina 5 — cross-bank payments 2PC primitive', () => {
  beforeEach(() => {
    cy.task('resetInterbank')
  })

  it('prepare → commit credits the destination account', () => {
    bankBUSDAccount().then((acct) => {
      const txID = uuid()
      cy.bankRequest('bank2', {
        method: 'POST',
        url: '/bank/api/v1/interbank/transactions',
        headers: { 'X-Api-Key': Cypress.env('INTERBANK_API_KEY') as string },
        body: {
          sender_routing_number: 333,
          transaction_id: txID,
          direction: 'inbound',
          local_account_number: acct.number,
          remote_account_number: '333000111111111111',
          currency: 'USD',
          amount: '42.50',
          purpose: 'cypress test',
        },
      }).then((prepResp) => {
        expect(prepResp.status, JSON.stringify(prepResp.body)).to.eq(200)
        const prep = prepResp.body as PrepareResp
        expect(prep.status).to.eq('prepared')
        expect(prep.transaction_id).to.eq(txID)

        readBalance(acct.id).then((balBefore) => {
          cy.bankRequest('bank2', {
            method: 'POST',
            url: `/bank/api/v1/interbank/transactions/${txID}/commit`,
            headers: { 'X-Api-Key': Cypress.env('INTERBANK_API_KEY') as string },
            body: { sender_routing_number: 333 },
          }).then((commitResp) => {
            expect(commitResp.status, JSON.stringify(commitResp.body)).to.eq(200)
            const commit = commitResp.body as CommitResp
            expect(commit.status).to.eq('committed')
            expect(commit.op_id, 'commit returned an op_id').to.be.a('string').and.to.have.length.greaterThan(0)

            readBalance(acct.id).then((balAfter) => {
              expect(balAfter - balBefore).to.be.closeTo(42.5, 0.0001)
            })
          })
        })
      })
    })
  })

  it('prepare → rollback leaves balance untouched', () => {
    bankBUSDAccount().then((acct) => {
      const txID = uuid()
      readBalance(acct.id).then((balBefore) => {
        cy.bankRequest('bank2', {
          method: 'POST',
          url: '/bank/api/v1/interbank/transactions',
          headers: { 'X-Api-Key': Cypress.env('INTERBANK_API_KEY') as string },
          body: {
            sender_routing_number: 333,
            transaction_id: txID,
            direction: 'inbound',
            local_account_number: acct.number,
            remote_account_number: '333000222222222222',
            currency: 'USD',
            amount: '99.99',
            purpose: 'cypress rollback test',
          },
        }).then((prepResp) => {
          expect(prepResp.status).to.eq(200)
          cy.bankRequest('bank2', {
            method: 'POST',
            url: `/bank/api/v1/interbank/transactions/${txID}/rollback`,
            headers: { 'X-Api-Key': Cypress.env('INTERBANK_API_KEY') as string },
            body: { sender_routing_number: 333, reason: 'cypress test' },
          }).then((rbResp) => {
            expect(rbResp.status, JSON.stringify(rbResp.body)).to.eq(200)
            expect((rbResp.body as RollbackResp).status).to.eq('rolled_back')
            readBalance(acct.id).then((balAfter) => {
              expect(balAfter, 'balance unchanged after rollback').to.eq(balBefore)
            })
          })
        })
      })
    })
  })

  it('X-Idempotence-Key replay returns the cached response', () => {
    bankBUSDAccount().then((acct) => {
      const txID = uuid()
      const idemKey = uuid()
      const body = {
        sender_routing_number: 333,
        transaction_id: txID,
        direction: 'inbound',
        local_account_number: acct.number,
        remote_account_number: '333000333333333333',
        currency: 'USD',
        amount: '15.00',
        purpose: 'cypress idem test',
      }
      const headers = {
        'X-Api-Key': Cypress.env('INTERBANK_API_KEY') as string,
        'X-Idempotence-Key': idemKey,
      }
      cy.bankRequest('bank2', {
        method: 'POST',
        url: '/bank/api/v1/interbank/transactions',
        headers,
        body,
      }).then((firstResp) => {
        expect(firstResp.status).to.eq(200)
        const firstBody = firstResp.body
        // Send the same payload again with the same idempotence key.
        // Bank B should replay the cached response from
        // bank.interbank_protocol_messages.
        cy.bankRequest('bank2', {
          method: 'POST',
          url: '/bank/api/v1/interbank/transactions',
          headers,
          body,
        }).then((replayResp) => {
          expect(replayResp.status).to.eq(200)
          expect(replayResp.body, 'replay matches cached body').to.deep.eq(firstBody)
          // And only one bank.interbank_protocol_transactions row exists.
          cy.task<string[][]>(
            'bank2Sql',
            `select count(*)::text from "bank".interbank_protocol_transactions
             where transaction_id = '${txID}'`,
          ).then((rows) => {
            expect(rows[0]?.[0], 'one tx row, not two').to.eq('1')
          })
        })
      })
    })
  })

  it('rejects an unknown X-Api-Key with 401', () => {
    cy.bankRequest('bank2', {
      method: 'POST',
      url: '/bank/api/v1/interbank/transactions',
      headers: { 'X-Api-Key': 'not-the-key' },
      body: {
        sender_routing_number: 333,
        transaction_id: uuid(),
        direction: 'inbound',
        local_account_number: '333000000000000000',
        currency: 'USD',
        amount: '1.00',
      },
    }).then((resp) => {
      expect(resp.status, 'X-Api-Key guard fires before the handler').to.eq(401)
    })
  })
})
