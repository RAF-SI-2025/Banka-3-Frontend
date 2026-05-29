import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import { api } from './client'
import { exerciseOption, listHoldings, setPublicCount } from './portfolio'
import { v1SecurityType } from './generated/models/v1SecurityType'
import { bankaTradingV1UserKind } from './generated/models/bankaTradingV1UserKind'

describe('portfolio wrappers', () => {
  let mock: MockAdapter
  beforeEach(() => {
    mock = new MockAdapter(api)
  })
  afterEach(() => {
    mock.restore()
  })

  it('listHoldings GETs /v1/portfolio with params', async () => {
    let url: string | undefined
    let params: Record<string, unknown> | undefined
    mock.onGet(/\/v1\/portfolio(?:\?.*)?$/).reply((cfg) => {
      url = cfg.url
      params = cfg.params as Record<string, unknown>
      return [200, { holdings: [] }]
    })
    await listHoldings({
      userId: 'u-1',
      userKind: bankaTradingV1UserKind.USER_KIND_CLIENT,
      type: v1SecurityType.SECURITY_TYPE_STOCK,
    })
    expect(url).toBe('/v1/portfolio')
    expect(params).toMatchObject({
      userId: 'u-1',
      userKind: 'USER_KIND_CLIENT',
      type: 'SECURITY_TYPE_STOCK',
    })
  })

  it('setPublicCount PATCHes /v1/portfolio/{id}/public-count', async () => {
    let url: string | undefined
    let body: unknown
    mock.onPatch(/\/v1\/portfolio\/.+\/public-count/).reply((cfg) => {
      url = cfg.url
      body = cfg.data ? JSON.parse(cfg.data) : undefined
      return [200, {}]
    })
    await setPublicCount('h-1', 25)
    expect(url).toBe('/v1/portfolio/h-1/public-count')
    expect(body).toEqual({ publicCount: 25 })
  })

  it('exerciseOption POSTs /v1/portfolio/{id}/exercise with quantity', async () => {
    let url: string | undefined
    let body: unknown
    mock.onPost(/\/v1\/portfolio\/.+\/exercise/).reply((cfg) => {
      url = cfg.url
      body = cfg.data ? JSON.parse(cfg.data) : undefined
      return [200, { optionHolding: { id: 'h-1' } }]
    })
    await exerciseOption('h-1', 2)
    expect(url).toBe('/v1/portfolio/h-1/exercise')
    expect(body).toEqual({ quantity: 2 })
  })

  it('exerciseOption URL-encodes the holding id', async () => {
    let url: string | undefined
    mock.onPost(/\/v1\/portfolio\/.+\/exercise/).reply((cfg) => {
      url = cfg.url
      return [200, {}]
    })
    await exerciseOption('h/1', 1)
    expect(url).toBe('/v1/portfolio/h%2F1/exercise')
  })
})
