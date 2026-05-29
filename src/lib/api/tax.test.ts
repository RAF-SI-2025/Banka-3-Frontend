import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import { api } from './client'
import { listRealizedPnL, listTaxPositions, runTaxJob } from './tax'
import { bankaTradingV1UserKind } from './generated/models/bankaTradingV1UserKind'

describe('tax wrappers', () => {
  let mock: MockAdapter
  beforeEach(() => {
    mock = new MockAdapter(api)
  })
  afterEach(() => {
    mock.restore()
  })

  it('listTaxPositions GETs /v1/tax/positions with the kind+name filter', async () => {
    let url: string | undefined
    let params: Record<string, unknown> | undefined
    mock.onGet(/\/v1\/tax\/positions/).reply((cfg) => {
      url = cfg.url
      params = cfg.params as Record<string, unknown>
      return [200, { positions: [] }]
    })
    await listTaxPositions({ userKind: bankaTradingV1UserKind.USER_KIND_CLIENT, nameQuery: 'mar' })
    expect(url).toBe('/v1/tax/positions')
    expect(params).toEqual({ userKind: 'USER_KIND_CLIENT', nameQuery: 'mar' })
  })

  it('listRealizedPnL GETs /v1/tax/realized with userId+range', async () => {
    let params: Record<string, unknown> | undefined
    mock.onGet(/\/v1\/tax\/realized/).reply((cfg) => {
      params = cfg.params as Record<string, unknown>
      return [200, { rows: [] }]
    })
    await listRealizedPnL({
      userId: 'u-1',
      userKind: bankaTradingV1UserKind.USER_KIND_EMPLOYEE,
      from: '2026-01-01T00:00:00Z',
      to: '2026-05-09T23:59:59Z',
    })
    expect(params).toEqual({
      userId: 'u-1',
      userKind: 'USER_KIND_EMPLOYEE',
      from: '2026-01-01T00:00:00Z',
      to: '2026-05-09T23:59:59Z',
    })
  })

  it('runTaxJob POSTs /v1/tax/run with an idempotency key and returns the summary', async () => {
    let body: unknown
    let key: string | undefined
    mock.onPost('/v1/tax/run').reply((cfg) => {
      body = cfg.data ? JSON.parse(cfg.data) : undefined
      key = cfg.headers?.['Idempotency-Key'] as string | undefined
      return [200, { usersTaxed: 3, totalCollectedRsd: '1234.56' }]
    })
    const res = await runTaxJob({})
    expect(body).toEqual({})
    expect(key).toMatch(/^[0-9a-f-]{36}$/)
    expect(res.usersTaxed).toBe(3)
    expect(res.totalCollectedRsd).toBe('1234.56')
  })
})
