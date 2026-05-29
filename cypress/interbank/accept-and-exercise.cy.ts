// Celina 5 — cross-bank accept + exercise.
//
// Drives the full OTC contract lifecycle between two real Banka 3
// instances:
//   1. Bank A creates an offer against bank B's published holding.
//   2. Bank B counters with different terms → flips the "modified by"
//      side so bank A is now allowed to accept.
//   3. Bank A accepts (verification-gated) → external_otc_accept SAGA
//      runs the bank 2PC primitive to settle the premium cross-bank
//      and mints a contract on both sides.
//   4. Bank A exercises (verification-gated) → external_otc_exercise
//      SAGA reserves + commits the strike notional via the same 2PC.
//
// Assumes both stacks running (make interbank-up).

interface PublicHolding {
  bankCode?: string
  sellerUserRef?: string
  sellerHoldingId?: string
  securityTicker?: string
  securityType?: string
  currency?: string
  quantity?: number
  askPrice?: string
}

interface DiscoveryResp { items?: PublicHolding[] }

interface ThreadMirror {
  id?: string
  remoteBankCode?: string
  remoteThreadId?: string
  status?: string
  modifiedBySide?: string
  quantity?: number
  pricePerUnit?: string
  premium?: string
}

interface ContractRow {
  id?: string
  threadId?: string
  remoteBankCode?: string
  remoteContractId?: string
  status?: string
  quantity?: number
  strikePrice?: string
  premiumPaid?: string
  currency?: string
}

interface CreateOfferResp { localMirror?: ThreadMirror }
interface AcceptResp { thread?: ThreadMirror; contract?: ContractRow }
interface VerifyResp { verificationId?: string; code?: string }

const CLIENT_A = { email: 'klijent@banka.local', password: 'Klijent123!' }
// Bank B's public holdings are seeded under klijent2, not klijent, so
// the partner-incoming mirror lands on klijent2's local_user_id.
const CLIENT_B = { email: 'klijent2@banka.local', password: 'Klijent123!' }

function requestVerification(
  bank: 'bank1' | 'bank2',
  token: string,
  actionKind: string,
): Cypress.Chainable<{ verificationId: string; code: string }> {
  return cy
    .bankRequest(
      bank,
      {
        method: 'POST',
        url: '/api/v1/verification/request',
        body: { actionKind },
      },
      token,
    )
    .then((r) => {
      const body = r.body as VerifyResp
      if (!body.verificationId || !body.code) {
        throw new Error(`verification request failed: ${JSON.stringify(r.body)}`)
      }
      return { verificationId: body.verificationId, code: body.code }
    })
}

describe('celina 5 — cross-bank OTC accept + exercise lifecycle', () => {
  beforeEach(() => {
    cy.task('resetInterbank')
  })

  it('bank A creates → bank B counters → bank A accepts → contract on both sides', () => {
    cy.bankLogin('bank1', CLIENT_A.email, CLIENT_A.password).then((tokA) => {
      cy.bankLogin('bank2', CLIENT_B.email, CLIENT_B.password).then((tokB) => {
        // Step 1 — bank A discovers bank B's holdings + picks one.
        cy.bankRequest(
          'bank1',
          { method: 'GET', url: '/api/v1/otc/external-discovery?bankCode=334' },
          tokA,
        ).then((discResp) => {
          const target = ((discResp.body as DiscoveryResp).items ?? [])[0]!
          expect(target?.sellerHoldingId, 'bank B has a public holding to target').to.be.a('string')

          // Step 2 — bank A finds its USD account (buyer pays in security currency).
          cy.bankRequest(
            'bank1',
            { method: 'GET', url: '/api/v1/accounts' },
            tokA,
          ).then((acctResp) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const accts = ((acctResp.body as any)?.accounts ?? []) as Array<{ id: string; currency: string }>
            const buyerAcc = accts.find((a) => a.currency === 'CURRENCY_USD')
            expect(buyerAcc?.id, 'bank A client has a USD account').to.be.a('string')

            // Step 3 — bank A creates the offer.
            cy.bankRequest(
              'bank1',
              {
                method: 'POST',
                url: '/api/v1/otc/external-offers',
                body: {
                  remoteBankCode: target.bankCode,
                  remoteUserRef: target.sellerUserRef,
                  buyerAccountId: buyerAcc.id,
                  sellerHoldingId: target.sellerHoldingId,
                  securityTicker: target.securityTicker,
                  securityType: target.securityType,
                  currency: target.currency,
                  quantity: 1,
                  pricePerUnit: '150',
                  premium: '5',
                  settlementDate: '2027-08-01T00:00:00Z',
                },
              },
              tokA,
            ).then((createResp) => {
              expect(createResp.status, JSON.stringify(createResp.body)).to.eq(200)
              const mirrorA = (createResp.body as CreateOfferResp).localMirror!
              expect(mirrorA.modifiedBySide).to.eq('EXTERNAL_OTC_SIDE_LOCAL')

              // Step 4 — bank B finds its mirrored thread (incoming).
              cy.bankRequest(
                'bank2',
                { method: 'GET', url: '/api/v1/otc/external-offers' },
                tokB,
              ).then((listResp) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const threadsB = ((listResp.body as any)?.threads ?? []) as ThreadMirror[]
                const mirrorB = threadsB.find(
                  (t) => t.remoteThreadId === mirrorA.id && t.remoteBankCode === '333',
                )
                expect(mirrorB?.id, 'bank B has the mirror thread').to.be.a('string')

                // Step 5 — bank B counters with different terms.
                cy.bankRequest(
                  'bank2',
                  {
                    method: 'POST',
                    url: `/api/v1/otc/external-offers/333/${mirrorB!.id}/counter`,
                    body: {
                      quantity: 1,
                      pricePerUnit: '160',
                      premium: '7',
                      settlementDate: '2027-08-01T00:00:00Z',
                    },
                  },
                  tokB,
                ).then((counterResp) => {
                  expect(counterResp.status, JSON.stringify(counterResp.body)).to.eq(200)

                  // Step 6 — bank A accepts (verification-gated).
                  requestVerification('bank1', tokA, 'external_otc_accept').then((proof) => {
                    cy.bankRequest(
                      'bank1',
                      {
                        method: 'POST',
                        url: `/api/v1/otc/external-offers/334/${mirrorA.id}/accept`,
                        headers: {
                          'X-Verification-Id': proof.verificationId,
                          'X-Verification-Code': proof.code,
                        },
                      },
                      tokA,
                    ).then((acceptResp) => {
                      expect(acceptResp.status, JSON.stringify(acceptResp.body)).to.eq(200)
                      const result = acceptResp.body as AcceptResp
                      expect(result.thread?.status).to.eq('EXTERNAL_OTC_THREAD_STATUS_ACCEPTED')
                      expect(result.contract?.id, 'bank A has the contract').to.be.a('string')
                      expect(result.contract?.status).to.eq(
                        'EXTERNAL_OTC_CONTRACT_STATUS_ACTIVE',
                      )

                      // Step 7 — bank B's mirror should also have an active
                      // contract minted by the partner-receive accept flow.
                      cy.task<string[][]>(
                        'bank2Sql',
                        `select id, status from "trading".external_otc_contracts where remote_bank_code = '333'`,
                      ).then((rows) => {
                        expect(rows.length, 'bank B minted its contract').to.be.greaterThan(0)
                        expect(rows[0]?.[1]).to.eq('active')
                      })

                      // Step 8 — bank A's contract is exercisable.
                      requestVerification('bank1', tokA, 'external_otc_exercise').then(
                        (xProof) => {
                          cy.bankRequest(
                            'bank1',
                            {
                              method: 'POST',
                              url: `/api/v1/otc/external-contracts/334/${result.contract!.id}/exercise`,
                              headers: {
                                'X-Verification-Id': xProof.verificationId,
                                'X-Verification-Code': xProof.code,
                              },
                              body: {},
                            },
                            tokA,
                          ).then((xResp) => {
                            expect(xResp.status, JSON.stringify(xResp.body)).to.eq(200)
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const contract = (xResp.body as any)?.contract as ContractRow
                            expect(
                              contract?.status,
                              `expected exercised, got ${JSON.stringify(xResp.body)}`,
                            ).to.eq('EXTERNAL_OTC_CONTRACT_STATUS_EXERCISED')
                          })
                        },
                      )
                    })
                  })
                })
              })
            })
          })
        })
      })
    })
  })
})
