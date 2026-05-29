import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import { api } from './client'
import { getListing, getListingHistory, listListings, upsertListing } from './listings'
import { v1SecurityType } from './generated/models/v1SecurityType'

describe('listings wrappers', () => {
  let mock: MockAdapter
  beforeEach(() => {
    mock = new MockAdapter(api)
  })
  afterEach(() => {
    mock.restore()
  })

  it('listListings GETs /v1/listings with params', async () => {
    let url: string | undefined
    let params: Record<string, unknown> | undefined
    mock.onGet(/\/v1\/listings(?:\?.*)?$/).reply((cfg) => {
      url = cfg.url
      params = cfg.params as Record<string, unknown>
      return [200, { listings: [] }]
    })
    await listListings({
      type: v1SecurityType.SECURITY_TYPE_STOCK,
      exchangeMic: 'XNAS',
      sortBy: 'volume',
      sortDesc: true,
      page: 1,
      pageSize: 50,
    })
    expect(url).toBe('/v1/listings')
    expect(params).toMatchObject({
      type: 'SECURITY_TYPE_STOCK',
      exchangeMic: 'XNAS',
      sortBy: 'volume',
      sortDesc: true,
      page: 1,
      pageSize: 50,
    })
  })

  it('getListing URL-encodes the id', async () => {
    let url: string | undefined
    mock.onGet(/\/v1\/listings\/.+/).reply((cfg) => {
      url = cfg.url
      return [200, {}]
    })
    await getListing('a/b')
    expect(url).toBe('/v1/listings/a%2Fb')
  })

  it('getListingHistory passes from/to as query params', async () => {
    let url: string | undefined
    let params: Record<string, unknown> | undefined
    mock.onGet(/\/v1\/listings\/.+\/history/).reply((cfg) => {
      url = cfg.url
      params = cfg.params as Record<string, unknown>
      return [200, { rows: [] }]
    })
    await getListingHistory('lst-1', { from: '2026-04-01', to: '2026-05-01' })
    expect(url).toBe('/v1/listings/lst-1/history')
    expect(params).toEqual({ from: '2026-04-01', to: '2026-05-01' })
  })

  it('upsertListing PUTs /v1/listings (admin override path)', async () => {
    let url: string | undefined
    let method: string | undefined
    mock.onPut('/v1/listings').reply((cfg) => {
      url = cfg.url
      method = cfg.method
      return [200, {}]
    })
    await upsertListing({ securityId: 's-1', price: '100' })
    expect(url).toBe('/v1/listings')
    expect(method).toBe('put')
  })
})
