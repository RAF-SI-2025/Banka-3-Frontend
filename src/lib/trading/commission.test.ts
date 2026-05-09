import { describe, expect, it } from 'vitest'
import { computeCommission, pricePerUnitForType } from './commission'
import { deriveOrderType } from './order-type'
import { v1OrderType } from '@/lib/api/generated/models/v1OrderType'

describe('deriveOrderType', () => {
  it.each([
    ['', '', v1OrderType.ORDER_TYPE_MARKET],
    ['100', '', v1OrderType.ORDER_TYPE_LIMIT],
    ['', '95', v1OrderType.ORDER_TYPE_STOP],
    ['100', '95', v1OrderType.ORDER_TYPE_STOP_LIMIT],
  ] as const)('limit=%s stop=%s → %s', (l, s, want) => {
    expect(deriveOrderType(l, s)).toBe(want)
  })
})

describe('computeCommission', () => {
  it('market: percent below cap → 14% of approx', () => {
    expect(computeCommission(v1OrderType.ORDER_TYPE_MARKET, 50, 1)).toBeCloseTo(7) // pct = 7, cap = 7
    expect(computeCommission(v1OrderType.ORDER_TYPE_MARKET, 40, 1)).toBeCloseTo(5.6)
  })

  it('market: percent above cap → $7-eq cap', () => {
    expect(computeCommission(v1OrderType.ORDER_TYPE_MARKET, 1000, 1)).toBeCloseTo(7)
    // listing currency is RSD ish: $7 ≈ 770 RSD; pct of 1000000 = 140000, cap = 770
    expect(computeCommission(v1OrderType.ORDER_TYPE_MARKET, 1000000, 110)).toBeCloseTo(770)
  })

  it('limit: 24% with $12-eq cap', () => {
    expect(computeCommission(v1OrderType.ORDER_TYPE_LIMIT, 50, 1)).toBeCloseTo(12) // pct = 12, cap = 12
    expect(computeCommission(v1OrderType.ORDER_TYPE_LIMIT, 1000000, 110)).toBeCloseTo(1320)
  })

  it('stop maps to market schedule, stop-limit maps to limit schedule', () => {
    expect(computeCommission(v1OrderType.ORDER_TYPE_STOP, 1000, 1)).toBeCloseTo(7)
    expect(computeCommission(v1OrderType.ORDER_TYPE_STOP_LIMIT, 1000, 1)).toBeCloseTo(12)
  })
})

describe('pricePerUnitForType', () => {
  const lst = { price: '100', ask: '101', bid: '99' }

  it('market BUY uses ask, market SELL uses bid', () => {
    expect(pricePerUnitForType(v1OrderType.ORDER_TYPE_MARKET, 'buy', lst)).toBe(101)
    expect(pricePerUnitForType(v1OrderType.ORDER_TYPE_MARKET, 'sell', lst)).toBe(99)
  })

  it('market falls back to last when ask/bid missing', () => {
    expect(pricePerUnitForType(v1OrderType.ORDER_TYPE_MARKET, 'buy', { price: '100' })).toBe(100)
  })

  it('limit + stop-limit use limitPrice', () => {
    expect(pricePerUnitForType(v1OrderType.ORDER_TYPE_LIMIT, 'buy', lst, '105')).toBe(105)
    expect(pricePerUnitForType(v1OrderType.ORDER_TYPE_STOP_LIMIT, 'buy', lst, '105', '95')).toBe(105)
  })

  it('stop uses stopPrice', () => {
    expect(pricePerUnitForType(v1OrderType.ORDER_TYPE_STOP, 'buy', lst, undefined, '95')).toBe(95)
  })

  it('returns null when required price is missing', () => {
    expect(pricePerUnitForType(v1OrderType.ORDER_TYPE_LIMIT, 'buy', lst)).toBeNull()
    expect(pricePerUnitForType(v1OrderType.ORDER_TYPE_STOP, 'buy', lst)).toBeNull()
  })
})
