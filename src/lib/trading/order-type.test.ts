// Spec p.53: order type is *derived* from whether limit and/or stop
// are present — no separate type picker. Pin the four-way matrix so a
// regression couldn't silently flip e.g. "only stop" → STOP_LIMIT.

import { describe, expect, it } from 'vitest'
import { deriveOrderType } from './order-type'
import { v1OrderType } from '@/lib/api/generated/models/v1OrderType'

describe('deriveOrderType', () => {
  it('no fields → MARKET', () => {
    expect(deriveOrderType('', '')).toBe(v1OrderType.ORDER_TYPE_MARKET)
    expect(deriveOrderType(undefined, undefined)).toBe(v1OrderType.ORDER_TYPE_MARKET)
  })

  it('only limit → LIMIT', () => {
    expect(deriveOrderType('100', '')).toBe(v1OrderType.ORDER_TYPE_LIMIT)
  })

  it('only stop → STOP', () => {
    expect(deriveOrderType('', '95')).toBe(v1OrderType.ORDER_TYPE_STOP)
  })

  it('both → STOP_LIMIT', () => {
    expect(deriveOrderType('100', '95')).toBe(v1OrderType.ORDER_TYPE_STOP_LIMIT)
  })

  it('whitespace-only counts as empty', () => {
    expect(deriveOrderType('   ', '   ')).toBe(v1OrderType.ORDER_TYPE_MARKET)
    expect(deriveOrderType('100', '   ')).toBe(v1OrderType.ORDER_TYPE_LIMIT)
  })
})
