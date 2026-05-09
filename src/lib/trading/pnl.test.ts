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

  it('uses server-provided profit when present', () => {
    const r = unrealizedPnL({ quantity: 10, weightedAvgPrice: '100', currentPrice: '120', profit: '199' })
    expect(r.abs).toBe(199)
    expect(r.pct).toBeCloseTo(19.9)
  })
})
