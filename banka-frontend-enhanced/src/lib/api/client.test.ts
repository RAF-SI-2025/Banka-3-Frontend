import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import { api } from './client'

// The interceptor lives module-side so we can hit it via a real axios
// adapter mock and assert on the outgoing headers.

describe('axios client interceptor', () => {
  let mock: MockAdapter
  beforeEach(() => {
    mock = new MockAdapter(api)
  })
  afterEach(() => {
    mock.restore()
  })

  it('attaches Idempotency-Key to POST', async () => {
    let captured: string | undefined
    mock.onPost('/v1/payments').reply((cfg) => {
      captured = cfg.headers?.['Idempotency-Key'] as string | undefined
      return [200, {}]
    })
    await api.post('/v1/payments', { amount: '1' })
    expect(captured).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('attaches Idempotency-Key to PATCH and DELETE', async () => {
    const seen: Record<string, string | undefined> = {}
    mock.onPatch(/.*/).reply((cfg) => {
      seen.patch = cfg.headers?.['Idempotency-Key'] as string | undefined
      return [200, {}]
    })
    mock.onDelete(/.*/).reply((cfg) => {
      seen.delete = cfg.headers?.['Idempotency-Key'] as string | undefined
      return [200, {}]
    })
    await api.patch('/v1/x', {})
    await api.delete('/v1/x')
    expect(seen.patch).toBeTruthy()
    expect(seen.delete).toBeTruthy()
    expect(seen.patch).not.toEqual(seen.delete) // a new key per request
  })

  it('does not attach Idempotency-Key to GET', async () => {
    let captured: string | undefined
    mock.onGet('/v1/accounts').reply((cfg) => {
      captured = cfg.headers?.['Idempotency-Key'] as string | undefined
      return [200, {}]
    })
    await api.get('/v1/accounts')
    expect(captured).toBeUndefined()
  })

  it('respects a caller-supplied Idempotency-Key', async () => {
    let captured: string | undefined
    mock.onPost('/v1/payments').reply((cfg) => {
      captured = cfg.headers?.['Idempotency-Key'] as string | undefined
      return [200, {}]
    })
    await api.post('/v1/payments', {}, { headers: { 'Idempotency-Key': 'caller-supplied' } })
    expect(captured).toBe('caller-supplied')
  })

  it('crypto.randomUUID is preferred when available', async () => {
    // Spy to confirm we delegate, rather than re-implementing uuid.
    const spy = vi.spyOn(globalThis.crypto, 'randomUUID')
    mock.onPost('/x').reply(200, {})
    await api.post('/x')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
