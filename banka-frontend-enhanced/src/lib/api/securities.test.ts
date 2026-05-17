import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import { api } from './client'
import {
  getOptionChain,
  getSecurity,
  listSecurities,
  upsertSecurity,
} from './securities'
import { v1SecurityType } from './generated/models/v1SecurityType'

describe('securities wrappers', () => {
  let mock: MockAdapter
  beforeEach(() => {
    mock = new MockAdapter(api)
  })
  afterEach(() => {
    mock.restore()
  })

  it('listSecurities encodes the FE-5 ask/bid range filters', async () => {
    let url: string | undefined
    let params: Record<string, unknown> | undefined
    mock.onGet(/\/v1\/securities(?:\?.*)?$/).reply((cfg) => {
      url = cfg.url
      params = cfg.params as Record<string, unknown>
      return [200, { securities: [] }]
    })
    await listSecurities({
      type: v1SecurityType.SECURITY_TYPE_STOCK,
      minAsk: '10',
      maxAsk: '50',
      minBid: '9',
      maxBid: '49',
      minPrice: '5',
      maxPrice: '100',
    })
    expect(url).toBe('/v1/securities')
    expect(params).toMatchObject({
      type: 'SECURITY_TYPE_STOCK',
      minAsk: '10',
      maxAsk: '50',
      minBid: '9',
      maxBid: '49',
      minPrice: '5',
      maxPrice: '100',
    })
  })

  it('listSecurities encodes settlement range', async () => {
    let params: Record<string, unknown> | undefined
    mock.onGet(/\/v1\/securities(?:\?.*)?$/).reply((cfg) => {
      params = cfg.params as Record<string, unknown>
      return [200, { securities: [] }]
    })
    await listSecurities({ minSettlement: '2026-06-01', maxSettlement: '2026-12-31' })
    expect(params).toMatchObject({
      minSettlement: '2026-06-01',
      maxSettlement: '2026-12-31',
    })
  })

  it('getSecurity URL-encodes the id', async () => {
    let url: string | undefined
    mock.onGet(/\/v1\/securities\/.+/).reply((cfg) => {
      url = cfg.url
      return [200, {}]
    })
    await getSecurity('s/1')
    expect(url).toBe('/v1/securities/s%2F1')
  })

  it('upsertSecurity PUTs /v1/securities', async () => {
    let url: string | undefined
    let method: string | undefined
    mock.onPut('/v1/securities').reply((cfg) => {
      url = cfg.url
      method = cfg.method
      return [200, {}]
    })
    await upsertSecurity({ ticker: 'AAPL', name: 'Apple', type: v1SecurityType.SECURITY_TYPE_STOCK })
    expect(url).toBe('/v1/securities')
    expect(method).toBe('put')
  })

  it('getOptionChain GETs /v1/securities/{id}/option-chain with params', async () => {
    let url: string | undefined
    let params: Record<string, unknown> | undefined
    mock.onGet(/\/v1\/securities\/.+\/option-chain/).reply((cfg) => {
      url = cfg.url
      params = cfg.params as Record<string, unknown>
      return [200, { groups: [] }]
    })
    await getOptionChain('aapl', { settlementDate: '2026-06-19', strikesWindow: 5 })
    expect(url).toBe('/v1/securities/aapl/option-chain')
    expect(params).toEqual({ settlementDate: '2026-06-19', strikesWindow: 5 })
  })
})
