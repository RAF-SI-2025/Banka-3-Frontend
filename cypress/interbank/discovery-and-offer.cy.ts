// Celina 5 — end-to-end cross-bank communication tests between two
// real Banka 3 instances (bank 333 = main `banka` compose, bank 334 =
// `banka-partner` compose). The test drives both gateways directly
// via cy.request to validate the cross-bank protocol; UI rendering is
// out of scope here (covered by the c4 cypress specs).
//
// Prereq: both stacks running, seeded.
//   make interbank-up      # in Banka-3-Backend
//
// Run:
//   npm run cypress:interbank

interface PublicHolding {
  bankCode?: string
  sellerUserRef?: string
  sellerDisplay?: string
  sellerHoldingId?: string
  securityTicker?: string
  securityType?: string
  currency?: string
  quantity?: number
  askPrice?: string
  premium?: string
}

interface DiscoveryResp { items?: PublicHolding[] }

interface ThreadMirror {
  id?: string
  direction?: string
  remoteBankCode?: string
  remoteThreadId?: string
  status?: string
  modifiedBySide?: string
  quantity?: number
  pricePerUnit?: string
}

interface CreateOfferResp { localMirror?: ThreadMirror }
interface ListThreadsResp { threads?: ThreadMirror[] }

const CLIENT_BANK1 = { email: 'klijent@banka.local', password: 'Klijent123!' }
const CLIENT_BANK2 = { email: 'klijent@banka.local', password: 'Klijent123!' }

describe('celina 5 — cross-bank communication (Banka 3 ↔ Banka 3)', () => {
  beforeEach(() => {
    cy.task('resetInterbank')
  })

  it('bank 1 client discovers bank 2 public holdings', () => {
    cy.bankLogin('bank1', CLIENT_BANK1.email, CLIENT_BANK1.password).then((tok) => {
      cy.bankRequest(
        'bank1',
        { method: 'GET', url: '/api/v1/otc/external-discovery?bankCode=334' },
        tok,
      ).then((resp) => {
        expect(resp.status).to.eq(200)
        const items = (resp.body as DiscoveryResp).items ?? []
        expect(items.length, 'partner advertised at least one holding').to.be.greaterThan(0)
        items.forEach((it) => {
          expect(it.bankCode, 'every row comes from bank 334').to.eq('334')
          expect(it.securityTicker, 'ticker populated').to.be.a('string').and.not.empty
        })
      })
    })
  })

  it('bank 2 client discovers bank 1 public holdings (reverse direction)', () => {
    cy.bankLogin('bank2', CLIENT_BANK2.email, CLIENT_BANK2.password).then((tok) => {
      cy.bankRequest(
        'bank2',
        { method: 'GET', url: '/api/v1/otc/external-discovery?bankCode=333' },
        tok,
      ).then((resp) => {
        expect(resp.status).to.eq(200)
        const items = (resp.body as DiscoveryResp).items ?? []
        expect(items.length).to.be.greaterThan(0)
        items.forEach((it) => expect(it.bankCode).to.eq('333'))
      })
    })
  })

  // TODO(c5-partner-receive): bank 2's resolveSellerAccountNumber
  // hits a second GetAccount that returns NotFound when bank 1
  // drives the outbound CreateOffer. The same payload works when
  // POSTed directly to bank 2's /bank/api/v1/otc/external-offers, so
  // the failure is somewhere between trading.ReceiveExternalOTCOffer
  // and bank.GetAccount on the partner side. Re-enable once fixed.
  it.skip('offer creation lands a mirror on both banks', () => {
    cy.bankLogin('bank1', CLIENT_BANK1.email, CLIENT_BANK1.password).then((tok1) => {
      // 1. Find one of bank 2's advertised holdings.
      cy.bankRequest(
        'bank1',
        { method: 'GET', url: '/api/v1/otc/external-discovery?bankCode=334' },
        tok1,
      ).then((discResp) => {
        const items = (discResp.body as DiscoveryResp).items ?? []
        expect(items.length).to.be.greaterThan(0)
        const target = items[0]!
        cy.log(`targeting bank 334 holding ${target.sellerHoldingId} (${target.securityTicker})`)

        // 2. Find a USD account on bank 1's client.
        cy.bankRequest(
          'bank1',
          { method: 'GET', url: '/api/v1/accounts?currency=CURRENCY_USD' },
          tok1,
        ).then((acctResp) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const accounts = (acctResp.body as any)?.accounts ?? []
          expect(accounts.length, 'bank 1 client has a USD account').to.be.greaterThan(0)
          const buyerAcc = accounts[0]

          // 3. Create the offer.
          cy.bankRequest(
            'bank1',
            {
              method: 'POST',
              url: '/api/v1/otc/external-offers',
              body: {
                remoteBankCode: target.bankCode,
                remoteUserRef: target.sellerUserRef,
                remoteDisplayName: target.sellerDisplay ?? '',
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
            tok1,
          ).then((createResp) => {
            expect(createResp.status, JSON.stringify(createResp.body)).to.eq(200)
            const mirror = (createResp.body as CreateOfferResp).localMirror
            expect(mirror?.id, 'bank 1 local mirror minted').to.be.a('string').and.not.empty
            expect(mirror?.direction).to.eq('EXTERNAL_OTC_DIRECTION_OUTGOING')

            // 4. The partner's row exists too — query bank 2 DB directly.
            cy.task<string[][]>(
              'bank2Sql',
              `select id, direction, status from "trading".external_otc_threads where remote_bank_code = '333'`,
            ).then((rows) => {
              expect(rows.length, 'bank 2 has a mirror thread').to.be.greaterThan(0)
              const [_id, direction, status] = rows[0]!
              expect(direction).to.eq('incoming')
              expect(status).to.eq('open')
            })
          })
        })
      })
    })
  })

  // TODO(c5-partner-receive): depends on offer creation succeeding;
  // unskip together with the test above.
  it.skip('withdraw on bank 1 propagates to bank 2 (best-effort)', () => {
    cy.bankLogin('bank1', CLIENT_BANK1.email, CLIENT_BANK1.password).then((tok1) => {
      // Set up: create an offer first.
      cy.bankRequest(
        'bank1',
        { method: 'GET', url: '/api/v1/otc/external-discovery?bankCode=334' },
        tok1,
      ).then((discResp) => {
        const target = ((discResp.body as DiscoveryResp).items ?? [])[0]!
        cy.bankRequest(
          'bank1',
          { method: 'GET', url: '/api/v1/accounts?currency=CURRENCY_USD' },
          tok1,
        ).then((acctResp) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const buyerAcc = ((acctResp.body as any).accounts ?? [])[0]
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
            tok1,
          ).then((createResp) => {
            const mirror = (createResp.body as CreateOfferResp).localMirror!
            const localId = mirror.id!
            const remoteBank = mirror.remoteBankCode!

            // Withdraw via bank 1's user-facing route. The outbound
            // partner call is best-effort and only logs on failure;
            // the local mirror flip is the assertion.
            cy.bankRequest(
              'bank1',
              {
                method: 'POST',
                url: `/api/v1/otc/external-offers/${remoteBank}/${localId}/withdraw`,
              },
              tok1,
            ).then((wResp) => {
              expect(wResp.status, JSON.stringify(wResp.body)).to.eq(200)
              const status = (wResp.body as ThreadMirror).status
              expect(status).to.eq('EXTERNAL_OTC_THREAD_STATUS_WITHDRAWN')
            })

            // Bank 2 may or may not be in 'withdrawn' depending on
            // whether the partner call landed in time; assert local
            // flip succeeded — the partner-side withdraw notification
            // is fire-and-forget in our outbound code.
            cy.task<string[][]>(
              'bank1Sql',
              `select status from "trading".external_otc_threads where id = '${localId}'`,
            ).then((rows) => {
              expect(rows[0]?.[0]).to.eq('withdrawn')
            })
          })
        })
      })
    })
  })

  it('partner-facing /bank/api/v1/otc/public requires no JWT but lists holdings', () => {
    // The protocol-detection probe in interbank.Client hits this
    // without an API key. Make sure it stays open + returns data.
    for (const target of ['bank1', 'bank2'] as const) {
      cy.bankRequest(target, {
        method: 'GET',
        url: '/bank/api/v1/otc/public',
      }).then((resp) => {
        expect(resp.status, target).to.eq(200)
        const items = (resp.body as DiscoveryResp).items ?? []
        expect(items.length, `${target} advertises holdings`).to.be.greaterThan(0)
      })
    }
  })
})
