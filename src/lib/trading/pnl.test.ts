import { describe, expect, it } from 'vitest'
import { unrealizedPnL } from './pnl'

describe('unrealizedPnL', () => {
  it('positive: gain over cost basis', () => {
    const r = unrealizedPnL({ quantity: 10, weightedAvgPrice: '100', currentPrice: '120' })
    expect(r.abs).toBe(200)
    expect(r.pct).toBeCloseTo(20)
  })

  it('negative: loss is signed', () => {
    const r = unrealizedPnL({ quantity: 5, weightedAvgPrice: '50', currentPrice: '40' })
    expect(r.abs).toBe(-50)
    expect(r.pct).toBeCloseTo(-20)
  })

  it('zero quantity: pct is null, abs is 0', () => {
    const r = unrealizedPnL({ quantity: 0, weightedAvgPrice: '100', currentPrice: '120' })
    expect(r.abs).toBe(0)
    expect(r.pct).toBeNull()
  })

  it('zero cost basis: pct is null even if quantity is positive', () => {
    const r = unrealizedPnL({ quantity: 10, weightedAvgPrice: '0', currentPrice: '5' })
    expect(r.pct).toBeNull()
  })

  it('uses server-provided profit for abs but keeps pct on per-unit prices', () => {
    const r = unrealizedPnL({ quantity: 10, weightedAvgPrice: '100', currentPrice: '120', profit: '199' })
    expect(r.abs).toBe(199)
    expect(r.pct).toBeCloseTo(20)
  })

  it('futures with contractSize baked into server profit: pct is unit-based, not inflated', () => {
    // CL: 2 contracts × 1000 contractSize, avg 70 → 78.50.
    // Server returns profit = 17000 (=8.5 × 2 × 1000). The percent
    // must be 12.14%, not 17000 / (70×2) × 100 = 12142.86%.
    const r = unrealizedPnL({ quantity: 2, weightedAvgPrice: '70', currentPrice: '78.50', profit: '17000' })
    expect(r.abs).toBe(17000)
    expect(r.pct).toBeCloseTo(12.142857, 4)
  })
})
