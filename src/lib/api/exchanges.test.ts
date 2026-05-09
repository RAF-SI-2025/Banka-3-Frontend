import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import { api } from './client'
import { listExchanges, setExchangeOverride } from './exchanges'

describe('exchanges wrappers', () => {
  let mock: MockAdapter
  beforeEach(() => {
    mock = new MockAdapter(api)
  })
  afterEach(() => {
    mock.restore()
  })

  it('listExchanges GETs /v1/exchanges', async () => {
    let url: string | undefined
    mock.onGet(/\/v1\/exchanges$/).reply((cfg) => {
      url = cfg.url
      return [200, { exchanges: [{ mic: 'XNAS', name: 'Nasdaq' }] }]
    })
    const res = await listExchanges()
    expect(url).toBe('/v1/exchanges')
    expect(res.exchanges?.[0]?.mic).toBe('XNAS')
  })

  it('setExchangeOverride PATCHes with {open} when forcing a state', async () => {
    let url: string | undefined
    let body: unknown
    let key: string | undefined
    mock.onPatch(/\/v1\/exchanges\/.+\/override/).reply((cfg) => {
      url = cfg.url
      body = cfg.data ? JSON.parse(cfg.data) : undefined
      key = cfg.headers?.['Idempotency-Key'] as string | undefined
      return [200, { mic: 'XNAS', overrideOpen: true }]
    })
    await setExchangeOverride('XNAS', true)
    expect(url).toBe('/v1/exchanges/XNAS/override')
    expect(body).toEqual({ open: true })
    expect(key).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('setExchangeOverride PATCHes with {clear:true} when clearing', async () => {
    let body: unknown
    mock.onPatch(/\/v1\/exchanges\/.+\/override/).reply((cfg) => {
      body = cfg.data ? JSON.parse(cfg.data) : undefined
      return [200, { mic: 'XNAS' }]
    })
    await setExchangeOverride('XNAS', null)
    expect(body).toEqual({ clear: true })
  })

  it('setExchangeOverride URL-encodes the MIC path segment', async () => {
    let url: string | undefined
    mock.onPatch(/\/v1\/exchanges\/.+\/override/).reply((cfg) => {
      url = cfg.url
      return [200, { mic: 'X NAS' }]
    })
    await setExchangeOverride('X NAS', false)
    expect(url).toBe('/v1/exchanges/X%20NAS/override')
  })
})
