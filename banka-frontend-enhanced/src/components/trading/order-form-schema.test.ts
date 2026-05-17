// Schema-level guards for the order form. The form's higher-level
// behavior (eligible-account refinement, settlement-date guard) is
// enforced at the OrderForm submit level via superRefine — those are
// covered by the OrderForm/cypress specs, not here.

import { describe, expect, it } from 'vitest'
import { orderFormSchema, QUANTITY_MAX } from './order-form-schema'
import { v1Direction } from '@/lib/api/generated/models/v1Direction'

const base = {
  direction: v1Direction.DIRECTION_BUY,
  quantity: '5',
  limitPrice: '',
  stopPrice: '',
  allOrNone: false,
  margin: false,
  accountId: 'acct-1',
}

describe('orderFormSchema', () => {
  it('accepts a minimal valid market order', () => {
    expect(orderFormSchema.safeParse(base).success).toBe(true)
  })

  it('rejects empty / non-numeric quantity', () => {
    for (const q of ['', '0', 'abc', '1.5', '-1']) {
      const r = orderFormSchema.safeParse({ ...base, quantity: q })
      expect(r.success, `quantity=${q}`).toBe(false)
    }
  })

  it(`rejects quantity over ${QUANTITY_MAX}`, () => {
    const r = orderFormSchema.safeParse({ ...base, quantity: String(QUANTITY_MAX + 1) })
    expect(r.success).toBe(false)
  })

  it(`accepts quantity at the cap (${QUANTITY_MAX})`, () => {
    const r = orderFormSchema.safeParse({ ...base, quantity: String(QUANTITY_MAX) })
    expect(r.success).toBe(true)
  })

  it('rejects 0 (and 0.00) as limit/stop price', () => {
    for (const v of ['0', '0.0', '0.00']) {
      expect(orderFormSchema.safeParse({ ...base, limitPrice: v }).success, `limit=${v}`).toBe(false)
      expect(orderFormSchema.safeParse({ ...base, stopPrice: v }).success, `stop=${v}`).toBe(false)
    }
  })

  it('accepts positive decimal limit/stop', () => {
    expect(orderFormSchema.safeParse({ ...base, limitPrice: '105.50' }).success).toBe(true)
    expect(orderFormSchema.safeParse({ ...base, stopPrice: '0.01' }).success).toBe(true)
  })

  it('requires accountId', () => {
    const r = orderFormSchema.safeParse({ ...base, accountId: '' })
    expect(r.success).toBe(false)
  })
})
