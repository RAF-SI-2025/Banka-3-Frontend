import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import { api } from './client'
import {
  acceptOTCOffer,
  counterOTCOffer,
  createOTCOffer,
  exerciseOTCContract,
  getOTCContract,
  getOTCThread,
  listOTCContracts,
  listOTCThreads,
  listPublicHoldings,
  withdrawOTCOffer,
} from './otc'

describe('otc wrappers', () => {
  let mock: MockAdapter
  beforeEach(() => { mock = new MockAdapter(api) })
  afterEach(() => mock.restore())

  it('listPublicHoldings GETs /v1/otc/discovery with ticker', async () => {
    let params: Record<string, unknown> | undefined
    mock.onGet(/\/v1\/otc\/discovery(?:\?.*)?$/).reply((cfg) => {
      params = cfg.params as Record<string, unknown>
      return [200, { items: [] }]
    })
    await listPublicHoldings({ ticker: 'AAPL' })
    expect(params).toMatchObject({ ticker: 'AAPL' })
  })

  it('createOTCOffer POSTs /v1/otc/offers with full payload', async () => {
    let url: string | undefined
    let body: unknown
    mock.onPost(/\/v1\/otc\/offers$/).reply((cfg) => {
      url = cfg.url
      body = JSON.parse(cfg.data as string)
      return [200, { id: 'o-1', threadId: 't-1' }]
    })
    await createOTCOffer({
      sellerHoldingId: 'h-1',
      buyerAccountId: 'b-1',
      sellerAccountId: 's-1',
      quantity: 5,
      pricePerUnit: '101.50',
      premium: '12.00',
      settlementDate: '2026-12-31',
    })
    expect(url).toBe('/v1/otc/offers')
    expect(body).toMatchObject({
      sellerHoldingId: 'h-1',
      quantity: 5,
      pricePerUnit: '101.50',
    })
  })

  it('counterOTCOffer POSTs /v1/otc/offers/{id}/counter', async () => {
    let url: string | undefined
    mock.onPost(/\/v1\/otc\/offers\/t-1\/counter$/).reply((cfg) => {
      url = cfg.url
      return [200, {}]
    })
    await counterOTCOffer('t-1', { quantity: 6, pricePerUnit: '99', premium: '10', settlementDate: '2026-12-31' })
    expect(url).toBe('/v1/otc/offers/t-1/counter')
  })

  it('withdrawOTCOffer POSTs the withdraw endpoint', async () => {
    let url: string | undefined
    mock.onPost(/\/v1\/otc\/offers\/t-1\/withdraw$/).reply((cfg) => {
      url = cfg.url
      return [200, {}]
    })
    await withdrawOTCOffer('t-1')
    expect(url).toBe('/v1/otc/offers/t-1/withdraw')
  })

  it('acceptOTCOffer POSTs the accept endpoint', async () => {
    let url: string | undefined
    mock.onPost(/\/v1\/otc\/offers\/t-1\/accept$/).reply((cfg) => {
      url = cfg.url
      return [200, { contract: { id: 'c-1' } }]
    })
    const res = await acceptOTCOffer('t-1')
    expect(url).toBe('/v1/otc/offers/t-1/accept')
    expect(res.contract?.id).toBe('c-1')
  })

  it('getOTCThread GETs /v1/otc/offers/{id}', async () => {
    let url: string | undefined
    mock.onGet(/\/v1\/otc\/offers\/t-1$/).reply((cfg) => {
      url = cfg.url
      return [200, { iterations: [] }]
    })
    await getOTCThread('t-1')
    expect(url).toBe('/v1/otc/offers/t-1')
  })

  it('listOTCThreads GETs /v1/otc/offers with party filters', async () => {
    let params: Record<string, unknown> | undefined
    mock.onGet(/\/v1\/otc\/offers(?:\?.*)?$/).reply((cfg) => {
      params = cfg.params as Record<string, unknown>
      return [200, { threads: [] }]
    })
    await listOTCThreads({ partyUserId: 'u-1' })
    expect(params).toMatchObject({ partyUserId: 'u-1' })
  })

  it('listOTCContracts passes status param', async () => {
    let params: Record<string, unknown> | undefined
    mock.onGet(/\/v1\/otc\/contracts(?:\?.*)?$/).reply((cfg) => {
      params = cfg.params as Record<string, unknown>
      return [200, { contracts: [] }]
    })
    await listOTCContracts({ status: 'any' })
    expect(params).toMatchObject({ status: 'any' })
  })

  it('getOTCContract GETs /v1/otc/contracts/{id}', async () => {
    let url: string | undefined
    mock.onGet(/\/v1\/otc\/contracts\/c-1$/).reply((cfg) => {
      url = cfg.url
      return [200, { id: 'c-1' }]
    })
    await getOTCContract('c-1')
    expect(url).toBe('/v1/otc/contracts/c-1')
  })

  it('exerciseOTCContract POSTs the exercise endpoint', async () => {
    let url: string | undefined
    mock.onPost(/\/v1\/otc\/contracts\/c-1\/exercise$/).reply((cfg) => {
      url = cfg.url
      return [200, { contract: { id: 'c-1' } }]
    })
    await exerciseOTCContract('c-1')
    expect(url).toBe('/v1/otc/contracts/c-1/exercise')
  })
})
