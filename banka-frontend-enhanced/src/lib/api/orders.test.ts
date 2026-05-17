import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import { api } from './client'
import {
  approveOrder,
  cancelOrder,
  declineOrder,
  getOrder,
  listOrders,
  placeOrder,
} from './orders'
import { v1Direction } from './generated/models/v1Direction'
import { v1OrderType } from './generated/models/v1OrderType'

// Wrapper-shape contract: the six methods must hit the right verbs +
// URLs. Spec p.50 + p.57 lifecycle is server-side; the wrappers are
// thin pass-throughs and the bug surface here is verb/URL drift, not
// business logic.

describe('orders wrappers', () => {
  let mock: MockAdapter
  beforeEach(() => {
    mock = new MockAdapter(api)
  })
  afterEach(() => {
    mock.restore()
  })

  it('listOrders GETs /v1/orders with params', async () => {
    let url: string | undefined
    let params: Record<string, unknown> | undefined
    mock.onGet(/\/v1\/orders(?:\?.*)?$/).reply((cfg) => {
      url = cfg.url
      params = cfg.params as Record<string, unknown>
      return [200, { orders: [] }]
    })
    await listOrders({ status: 'pending', page: 2, pageSize: 25 })
    expect(url).toBe('/v1/orders')
    expect(params).toMatchObject({ status: 'pending', page: 2, pageSize: 25 })
  })

  it('getOrder GETs /v1/orders/{id} URL-encoded', async () => {
    let url: string | undefined
    mock.onGet(/\/v1\/orders\/.+/).reply((cfg) => {
      url = cfg.url
      return [200, { id: 'abc/def' }]
    })
    await getOrder('abc/def')
    expect(url).toBe('/v1/orders/abc%2Fdef')
  })

  it('placeOrder POSTs /v1/orders with body + Idempotency-Key', async () => {
    let url: string | undefined
    let body: unknown
    let key: string | undefined
    mock.onPost('/v1/orders').reply((cfg) => {
      url = cfg.url
      body = cfg.data ? JSON.parse(cfg.data) : undefined
      key = cfg.headers?.['Idempotency-Key'] as string | undefined
      return [200, { order: {}, exchangeClosed: false }]
    })
    await placeOrder({
      securityId: 's-1',
      orderType: v1OrderType.ORDER_TYPE_MARKET,
      direction: v1Direction.DIRECTION_BUY,
      quantity: 1,
      accountId: 'acct-1',
    })
    expect(url).toBe('/v1/orders')
    expect(body).toMatchObject({ securityId: 's-1', quantity: 1, accountId: 'acct-1' })
    expect(key).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('approveOrder POSTs /v1/orders/{id}/approve', async () => {
    let url: string | undefined
    mock.onPost(/\/v1\/orders\/.+\/approve/).reply((cfg) => {
      url = cfg.url
      return [200, { id: 'o-1', status: 'approved' }]
    })
    await approveOrder('o-1')
    expect(url).toBe('/v1/orders/o-1/approve')
  })

  it('declineOrder POSTs /v1/orders/{id}/decline with reason', async () => {
    let url: string | undefined
    let body: unknown
    mock.onPost(/\/v1\/orders\/.+\/decline/).reply((cfg) => {
      url = cfg.url
      body = cfg.data ? JSON.parse(cfg.data) : undefined
      return [200, { id: 'o-1', status: 'declined' }]
    })
    await declineOrder('o-1', 'previsoka cena')
    expect(url).toBe('/v1/orders/o-1/decline')
    expect(body).toEqual({ reason: 'previsoka cena' })
  })

  it('cancelOrder POSTs /v1/orders/{id}/cancel', async () => {
    let url: string | undefined
    mock.onPost(/\/v1\/orders\/.+\/cancel/).reply((cfg) => {
      url = cfg.url
      return [200, { id: 'o-1', cancelled: true }]
    })
    await cancelOrder('o-1')
    expect(url).toBe('/v1/orders/o-1/cancel')
  })
})
