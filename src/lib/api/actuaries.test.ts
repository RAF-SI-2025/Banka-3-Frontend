import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import { api } from './client'
import {
  getActuaryInfo,
  listActuaries,
  resetActuaryUsedLimit,
  runActuaryResetJob,
  setActuaryNeedApproval,
  updateActuaryLimit,
  upsertActuary,
} from './actuaries'
import { v1ActuaryType } from './generated/models/v1ActuaryType'

describe('actuaries wrappers', () => {
  let mock: MockAdapter
  beforeEach(() => {
    mock = new MockAdapter(api)
  })
  afterEach(() => {
    mock.restore()
  })

  it('listActuaries GETs /v1/actuaries with params', async () => {
    let url: string | undefined
    let params: Record<string, unknown> | undefined
    mock.onGet(/\/v1\/actuaries(?:\?.*)?$/).reply((cfg) => {
      url = cfg.url
      params = cfg.params as Record<string, unknown>
      return [200, { actuaries: [] }]
    })
    await listActuaries({
      nameQuery: 'Pera',
      type: v1ActuaryType.ACTUARY_TYPE_AGENT,
      page: 1,
      pageSize: 50,
    })
    expect(url).toBe('/v1/actuaries')
    expect(params).toMatchObject({
      nameQuery: 'Pera',
      type: 'ACTUARY_TYPE_AGENT',
      page: 1,
      pageSize: 50,
    })
  })

  it('getActuaryInfo URL-encodes the id', async () => {
    let url: string | undefined
    mock.onGet(/\/v1\/actuaries\/.+/).reply((cfg) => {
      url = cfg.url
      return [200, {}]
    })
    await getActuaryInfo('e/m')
    expect(url).toBe('/v1/actuaries/e%2Fm')
  })

  it('upsertActuary PUTs /v1/actuaries/{id} with body', async () => {
    let url: string | undefined
    let body: unknown
    mock.onPut(/\/v1\/actuaries\/.+/).reply((cfg) => {
      url = cfg.url
      body = cfg.data ? JSON.parse(cfg.data) : undefined
      return [200, {}]
    })
    await upsertActuary('emp-1', {
      type: v1ActuaryType.ACTUARY_TYPE_AGENT,
      dailyLimit: '1000000',
      needApproval: false,
    })
    expect(url).toBe('/v1/actuaries/emp-1')
    expect(body).toMatchObject({ dailyLimit: '1000000' })
  })

  it('updateActuaryLimit PATCHes /…/limit with {dailyLimit}', async () => {
    let url: string | undefined
    let body: unknown
    mock.onPatch(/\/v1\/actuaries\/.+\/limit/).reply((cfg) => {
      url = cfg.url
      body = cfg.data ? JSON.parse(cfg.data) : undefined
      return [200, {}]
    })
    await updateActuaryLimit('emp-1', '500000')
    expect(url).toBe('/v1/actuaries/emp-1/limit')
    expect(body).toEqual({ dailyLimit: '500000' })
  })

  it('setActuaryNeedApproval PATCHes /…/need-approval', async () => {
    let url: string | undefined
    let body: unknown
    mock.onPatch(/\/v1\/actuaries\/.+\/need-approval/).reply((cfg) => {
      url = cfg.url
      body = cfg.data ? JSON.parse(cfg.data) : undefined
      return [200, {}]
    })
    await setActuaryNeedApproval('emp-1', true)
    expect(url).toBe('/v1/actuaries/emp-1/need-approval')
    expect(body).toEqual({ needApproval: true })
  })

  it('resetActuaryUsedLimit POSTs /…/used-limit/reset', async () => {
    let url: string | undefined
    mock.onPost(/\/v1\/actuaries\/.+\/used-limit\/reset/).reply((cfg) => {
      url = cfg.url
      return [200, {}]
    })
    await resetActuaryUsedLimit('emp-1')
    expect(url).toBe('/v1/actuaries/emp-1/used-limit/reset')
  })

  it('runActuaryResetJob POSTs /v1/actuaries/reset-job', async () => {
    let url: string | undefined
    mock.onPost('/v1/actuaries/reset-job').reply((cfg) => {
      url = cfg.url
      return [200, { affected: 12 }]
    })
    const res = await runActuaryResetJob()
    expect(url).toBe('/v1/actuaries/reset-job')
    expect(res.affected).toBe(12)
  })
})
