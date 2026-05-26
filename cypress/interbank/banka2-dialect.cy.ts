// Celina 5 — Banka-2 dialect inbound shim.
//
// Drives the root-mounted endpoints our gateway exposes for the
// Spring-Boot-shape protocol coursemate banks speak:
//
//   POST   /interbank                          (Message<T> envelope)
//   GET    /public-stock                       (flat OTC discovery)
//   POST   /negotiations                       (OTC create)
//   GET    /negotiations/{rn}/{id}             (OTC read)
//   PUT    /negotiations/{rn}/{id}             (OTC counter)
//   DELETE /negotiations/{rn}/{id}             (OTC withdraw)
//   GET    /bank/api/v1/interbank/user/{rn}/{id} (friendly-name lookup)
//
// All traffic is bank1-only — the shim is per-bank and behaves
// identically on the partner stack since it's the same Go binary.
// We pretend to be Banka 2 (routing 222) so the spec exercises the
// dialect translation without needing a real Banka-2 instance.

const API_KEY = 'dev-outbound-banka3'
const FAKE_PARTNER_ROUTING = 222

interface Banka2ForeignID { routingNumber: number; ID?: string; id?: string }
interface Banka2Vote { vote: string; reasons?: { reason: string }[] }
interface Banka2Negotiation {
  stock?: { ticker?: string }
  pricePerUnit?: { currency?: string; amount?: number | string }
  premium?: { currency?: string; amount?: number | string }
  amount?: number | string
  isOngoing?: boolean
  buyerId?: Banka2ForeignID
  sellerId?: Banka2ForeignID
}
interface Banka2UserInfo { bankDisplayName?: string; displayName?: string }
interface Banka2PublicStock {
  stock?: { ticker?: string }
  sellers?: { seller?: Banka2ForeignID; amount?: number | string }[]
}

function uuid(): string {
  return crypto.randomUUID()
}

function envelope(routing: number, key: string, messageType: string, message: unknown) {
  return {
    idempotenceKey: { routingNumber: routing, locallyGeneratedKey: key },
    messageType,
    message,
  }
}

// Pick a 333-prefixed EUR account on bank1 that belongs to a real
// client (personal_fx), not one of the bank's own house accounts.
// Filtering to kind='personal_fx' avoids picking the system EUR
// account (commitInbound's executeMoneyMove uses system as the src;
// if dst==src the +N credit is a no-op self-transfer).
function pickEurAccount(): Cypress.Chainable<string> {
  return cy
    .task<string[][]>(
      'bank1Sql',
      "select number from \"bank\".accounts where currency='EUR' " +
        "and substring(number,1,3)='333' and status='active' " +
        "and kind='personal_fx' " +
        "order by available_balance desc limit 1",
    )
    .then((rows) => {
      if (rows.length === 0 || !rows[0]?.[0]) {
        throw new Error('no 333-prefixed EUR personal_fx account seeded')
      }
      return rows[0]![0]!
    })
}

describe('celina 5 — Banka-2 dialect inbound shim', () => {
  beforeEach(() => {
    cy.task('resetInterbank')
  })

  // -------------------------------------------------------------------
  // /public-stock — unauthenticated discovery
  // -------------------------------------------------------------------
  it('GET /public-stock returns flattened seller-per-ticker rows', () => {
    cy.bankRequest('bank1', { method: 'GET', url: '/public-stock' }).then((resp) => {
      expect(resp.status, JSON.stringify(resp.body)).to.eq(200)
      const items = resp.body as Banka2PublicStock[]
      expect(Array.isArray(items), 'top-level is a list').to.eq(true)
      // Don't pin a specific length — seeded set varies. But every
      // entry must have a ticker + seller routing.
      items.forEach((it) => {
        expect(it.stock?.ticker, 'ticker').to.be.a('string')
        ;(it.sellers ?? []).forEach((s) => {
          expect(s.seller?.routingNumber, 'routing on every seller').to.be.a('number')
        })
      })
    })
  })

  // -------------------------------------------------------------------
  // /bank/api/v1/interbank/user/{rn}/{id} — friendly-name lookup
  // -------------------------------------------------------------------
  it('GET /bank/api/v1/interbank/user/{rn}/{id} resolves a seeded client uuid', () => {
    // Find any seeded client; we don't pin a specific uuid because
    // the user service can reseed with fresh ids on `make nuke`.
    cy.task<string[][]>(
      'bank1Sql',
      "select id from \"user\".clients order by created_at limit 1",
    ).then((rows) => {
      if (rows.length === 0 || !rows[0]?.[0]) throw new Error('no seeded client')
      const clientID = rows[0]![0]!
      cy.bankRequest(
        'bank1',
        {
          method: 'GET',
          url: `/bank/api/v1/interbank/user/333/${clientID}`,
          headers: { 'X-Api-Key': API_KEY },
        },
      ).then((resp) => {
        expect(resp.status, JSON.stringify(resp.body)).to.eq(200)
        const body = resp.body as Banka2UserInfo
        expect(body.bankDisplayName).to.eq('Banka 3')
        expect(body.displayName, 'non-empty display name').to.be.a('string').and.not.eq('')
      })
    })
  })

  it('GET /bank/api/v1/interbank/user with wrong routing → 404', () => {
    cy.task<string[][]>(
      'bank1Sql',
      "select id from \"user\".clients order by created_at limit 1",
    ).then((rows) => {
      const clientID = rows[0]![0]!
      cy.bankRequest(
        'bank1',
        {
          method: 'GET',
          url: `/bank/api/v1/interbank/user/222/${clientID}`,
          headers: { 'X-Api-Key': API_KEY },
        },
      ).then((resp) => {
        expect(resp.status).to.eq(404)
      })
    })
  })

  // -------------------------------------------------------------------
  // /interbank envelope — POST NEW_TX → COMMIT_TX cash payment
  // -------------------------------------------------------------------
  it('NEW_TX YES + COMMIT_TX moves money + records committed row', () => {
    pickEurAccount().then((accountNum) => {
      // Capture pre-balance so we can assert the +50 delta after commit.
      cy.task<string[][]>(
        'bank1Sql',
        `select available_balance from "bank".accounts where number='${accountNum}'`,
      ).then((before) => {
        const pre = Number(before[0]![0]!)
        const txID = `cy-b2-${uuid().slice(0, 8)}`
        const keyPrepare = `${txID}-prepare`
        const keyCommit = `${txID}-commit`

        const tx = {
          transactionId: { routingNumber: FAKE_PARTNER_ROUTING, id: txID },
          message: 'cypress banka2 inbound', callNumber: '', paymentCode: '289',
          paymentPurpose: 'cypress smoke',
          postings: [
            { account: { type: 'ACCOUNT', num: '222000999888777666' }, amount: -50.0,
              asset: { type: 'MONAS', asset: { currency: 'EUR' } } },
            { account: { type: 'ACCOUNT', num: accountNum }, amount: 50.0,
              asset: { type: 'MONAS', asset: { currency: 'EUR' } } },
          ],
        }

        cy.bankRequest('bank1', {
          method: 'POST', url: '/interbank',
          headers: { 'X-Api-Key': API_KEY },
          body: envelope(FAKE_PARTNER_ROUTING, keyPrepare, 'NEW_TX', tx),
        }).then((r) => {
          expect(r.status, JSON.stringify(r.body)).to.eq(200)
          expect((r.body as Banka2Vote).vote).to.eq('YES')
        })

        cy.bankRequest('bank1', {
          method: 'POST', url: '/interbank',
          headers: { 'X-Api-Key': API_KEY },
          body: envelope(FAKE_PARTNER_ROUTING, keyCommit, 'COMMIT_TX', {
            transactionId: { routingNumber: FAKE_PARTNER_ROUTING, id: txID },
          }),
        }).then((r) => {
          expect(r.status).to.eq(204)
        })

        // Verify the bank-side row landed + balance moved.
        cy.task<string[][]>(
          'bank1Sql',
          `select status, direction, amount from "bank".interbank_protocol_transactions where transaction_id='${txID}'`,
        ).then((rows) => {
          expect(rows.length, 'one bank row per tx').to.eq(1)
          expect(rows[0]![0]).to.eq('committed')
          expect(rows[0]![1]).to.eq('inbound')
          expect(Number(rows[0]![2]!)).to.eq(50)
        })
        cy.task<string[][]>(
          'bank1Sql',
          `select available_balance from "bank".accounts where number='${accountNum}'`,
        ).then((after) => {
          expect(Number(after[0]![0]!) - pre, '+50 EUR credit landed').to.eq(50)
        })
      })
    })
  })

  // -------------------------------------------------------------------
  // /interbank envelope — idempotency
  // -------------------------------------------------------------------
  it('replay of same locallyGeneratedKey returns cached YES without re-prepare', () => {
    pickEurAccount().then((accountNum) => {
      const txID = `cy-b2-idem-${uuid().slice(0, 8)}`
      const key = `${txID}-prepare`
      const body = envelope(FAKE_PARTNER_ROUTING, key, 'NEW_TX', {
        transactionId: { routingNumber: FAKE_PARTNER_ROUTING, id: txID },
        message: '', callNumber: '', paymentCode: '', paymentPurpose: 'idem',
        postings: [
          { account: { type: 'ACCOUNT', num: '222000999888777666' }, amount: -10.0,
            asset: { type: 'MONAS', asset: { currency: 'EUR' } } },
          { account: { type: 'ACCOUNT', num: accountNum }, amount: 10.0,
            asset: { type: 'MONAS', asset: { currency: 'EUR' } } },
        ],
      })

      cy.bankRequest('bank1', {
        method: 'POST', url: '/interbank',
        headers: { 'X-Api-Key': API_KEY }, body,
      }).then((r1) => {
        expect(r1.status).to.eq(200)
        expect((r1.body as Banka2Vote).vote).to.eq('YES')
      })

      // Replay — same envelope.
      cy.bankRequest('bank1', {
        method: 'POST', url: '/interbank',
        headers: { 'X-Api-Key': API_KEY }, body,
      }).then((r2) => {
        expect(r2.status, 'cached 200').to.eq(200)
        expect((r2.body as Banka2Vote).vote).to.eq('YES')
      })

      // Exactly one row in interbank_protocol_messages.
      cy.task<string[][]>(
        'bank1Sql',
        `select count(*) from "bank".interbank_protocol_messages where idempotence_key='${key}'`,
      ).then((rows) => {
        expect(rows[0]?.[0]).to.eq('1')
      })
    })
  })

  // -------------------------------------------------------------------
  // /interbank envelope — structured NO votes
  // -------------------------------------------------------------------
  it('unbalanced posting list → NO with UNBALANCED_TX reason', () => {
    pickEurAccount().then((accountNum) => {
      const txID = `cy-b2-bal-${uuid().slice(0, 8)}`
      cy.bankRequest('bank1', {
        method: 'POST', url: '/interbank',
        headers: { 'X-Api-Key': API_KEY },
        body: envelope(FAKE_PARTNER_ROUTING, `${txID}-prepare`, 'NEW_TX', {
          transactionId: { routingNumber: FAKE_PARTNER_ROUTING, id: txID },
          message: '', callNumber: '', paymentCode: '', paymentPurpose: 'bad',
          postings: [
            { account: { type: 'ACCOUNT', num: '222000999888777666' }, amount: -50.0,
              asset: { type: 'MONAS', asset: { currency: 'EUR' } } },
            { account: { type: 'ACCOUNT', num: accountNum }, amount: 40.0,
              asset: { type: 'MONAS', asset: { currency: 'EUR' } } },
          ],
        }),
      }).then((r) => {
        expect(r.status).to.eq(200)
        const vote = r.body as Banka2Vote
        expect(vote.vote).to.eq('NO')
        expect(vote.reasons?.map((x) => x.reason)).to.include('UNBALANCED_TX')
      })
    })
  })

  it('posting to non-existent local account → NO vote (not 500)', () => {
    const txID = `cy-b2-na-${uuid().slice(0, 8)}`
    cy.bankRequest('bank1', {
      method: 'POST', url: '/interbank',
      headers: { 'X-Api-Key': API_KEY },
      body: envelope(FAKE_PARTNER_ROUTING, `${txID}-prepare`, 'NEW_TX', {
        transactionId: { routingNumber: FAKE_PARTNER_ROUTING, id: txID },
        message: '', callNumber: '', paymentCode: '', paymentPurpose: 'bad',
        postings: [
          { account: { type: 'ACCOUNT', num: '222000000000000000' }, amount: -50.0,
            asset: { type: 'MONAS', asset: { currency: 'EUR' } } },
          { account: { type: 'ACCOUNT', num: '333000000000000000' }, amount: 50.0,
            asset: { type: 'MONAS', asset: { currency: 'EUR' } } },
        ],
      }),
    }).then((r) => {
      expect(r.status, 'envelope still returns 200 — body carries the NO').to.eq(200)
      expect((r.body as Banka2Vote).vote).to.eq('NO')
    })
  })

  // -------------------------------------------------------------------
  // /interbank auth
  // -------------------------------------------------------------------
  it('POST /interbank without X-Api-Key → 401', () => {
    cy.bankRequest('bank1', {
      method: 'POST', url: '/interbank',
      body: envelope(FAKE_PARTNER_ROUTING, 'no-auth', 'NEW_TX', {}),
    }).then((r) => expect(r.status).to.eq(401))
  })

  // -------------------------------------------------------------------
  // OTC dialect: POST /negotiations → GET → PUT counter → DELETE
  // -------------------------------------------------------------------
  it('OTC create + read + counter + withdraw drives the partner-shaped lifecycle', () => {
    // Use ListPublicHoldings as bank1 sees it to pick a seller+ticker
    // we know exists (saves us from hardcoding seeded uuids).
    cy.bankRequest('bank1', { method: 'GET', url: '/public-stock' }).then((resp) => {
      const items = resp.body as Banka2PublicStock[]
      const usable = items.find((it) => (it.sellers ?? []).length > 0)
      if (!usable) throw new Error('no seller advertised on bank1 /public-stock')
      const ticker = usable.stock!.ticker!
      const seller = usable.sellers![0]!.seller!
      const sellerID = (seller.id ?? seller.ID) as string

      const buyerID = `cy-b2-buyer-${uuid().slice(0, 6)}`
      const offer = {
        stock: { ticker },
        settlementDate: '2027-08-01T00:00:00Z',
        pricePerUnit: { currency: 'USD', amount: 450.1 },
        premium: { currency: 'USD', amount: 15.0 },
        buyerId: { routingNumber: FAKE_PARTNER_ROUTING, id: buyerID },
        sellerId: { routingNumber: 333, id: sellerID },
        amount: 1,
        lastModifiedBy: { routingNumber: FAKE_PARTNER_ROUTING, id: buyerID },
      }

      // POST /negotiations
      cy.bankRequest('bank1', {
        method: 'POST', url: '/negotiations',
        headers: { 'X-Api-Key': API_KEY }, body: offer,
      }).then((r) => {
        expect(r.status, JSON.stringify(r.body)).to.eq(200)
        const fid = r.body as Banka2ForeignID
        expect(fid.routingNumber).to.eq(333)
        const threadID = (fid.id ?? fid.ID) as string
        expect(threadID, 'thread id minted').to.be.a('string').and.not.eq('')

        // GET /negotiations/{rn}/{id}
        cy.bankRequest('bank1', {
          method: 'GET', url: `/negotiations/333/${threadID}`,
          headers: { 'X-Api-Key': API_KEY },
        }).then((g) => {
          expect(g.status).to.eq(200)
          const neg = g.body as Banka2Negotiation
          expect(neg.stock?.ticker).to.eq(ticker)
          expect(neg.isOngoing).to.eq(true)
          expect(Number(neg.amount)).to.eq(1)
        })

        // PUT counter (different price)
        cy.bankRequest('bank1', {
          method: 'PUT', url: `/negotiations/333/${threadID}`,
          headers: { 'X-Api-Key': API_KEY },
          body: { ...offer, pricePerUnit: { currency: 'USD', amount: 455 } },
        }).then((p) => expect(p.status).to.eq(204))

        cy.bankRequest('bank1', {
          method: 'GET', url: `/negotiations/333/${threadID}`,
          headers: { 'X-Api-Key': API_KEY },
        }).then((g2) => {
          expect(Number((g2.body as Banka2Negotiation).pricePerUnit?.amount ?? 0))
            .to.eq(455)
        })

        // DELETE withdraw → isOngoing flips false.
        cy.bankRequest('bank1', {
          method: 'DELETE', url: `/negotiations/333/${threadID}`,
          headers: { 'X-Api-Key': API_KEY },
        }).then((d) => expect(d.status).to.eq(204))

        cy.bankRequest('bank1', {
          method: 'GET', url: `/negotiations/333/${threadID}`,
          headers: { 'X-Api-Key': API_KEY },
        }).then((g3) => {
          expect((g3.body as Banka2Negotiation).isOngoing).to.eq(false)
        })
      })
    })
  })
})
