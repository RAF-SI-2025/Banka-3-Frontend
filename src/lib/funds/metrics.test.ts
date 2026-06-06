import { describe, expect, it } from 'vitest'
import {
  MIN_SNAPSHOTS,
  computeFundMetrics,
  maxDrawdown,
  metricsFromSnapshots,
  toSeries,
  annualizedReturn,
  type FundSnapshotPoint,
} from './metrics'

// Build a series spaced one day apart starting at a fixed date.
function days(values: number[]): FundSnapshotPoint[] {
  const start = Date.parse('2026-01-01T00:00:00Z')
  return values.map((value, i) => ({
    t: new Date(start + i * 86_400_000).toISOString(),
    value,
  }))
}

describe('toSeries', () => {
  it('sorts ascending by time and drops bad rows', () => {
    const s = toSeries([
      { snapshotAt: '2026-01-03T00:00:00Z', totalValueRsd: '300' },
      { snapshotAt: '2026-01-01T00:00:00Z', totalValueRsd: '100' },
      { snapshotAt: '2026-01-02T00:00:00Z', totalValueRsd: '200' },
      { snapshotAt: '', totalValueRsd: '999' }, // no timestamp
      { snapshotAt: '2026-01-04T00:00:00Z', totalValueRsd: '0' }, // non-positive
      { snapshotAt: '2026-01-05T00:00:00Z', totalValueRsd: 'abc' }, // NaN
    ])
    expect(s.map((p) => p.value)).toEqual([100, 200, 300])
  })
})

describe('insufficient data (S74)', () => {
  it('returns null metrics for fewer than MIN_SNAPSHOTS points', () => {
    const m = computeFundMetrics(days([100, 110]))
    expect(MIN_SNAPSHOTS).toBe(3)
    expect(m.insufficient).toBe(true)
    expect(m.annualReturn).toBeNull()
    expect(m.volatility).toBeNull()
    expect(m.sharpe).toBeNull()
    expect(m.maxDrawdown).toBeNull()
  })

  it('returns null metrics for an empty series', () => {
    expect(computeFundMetrics([]).insufficient).toBe(true)
  })

  it('metricsFromSnapshots also flags insufficient', () => {
    const m = metricsFromSnapshots([{ snapshotAt: '2026-01-01T00:00:00Z', totalValueRsd: '100' }])
    expect(m.insufficient).toBe(true)
  })
})

describe('maxDrawdown (S77)', () => {
  it('is zero for a monotonically rising series', () => {
    expect(maxDrawdown([100, 110, 120, 130])).toBe(0)
  })

  it('captures the deepest peak-to-trough decline', () => {
    // peak 200 holds across the whole window; deepest trough is 90 → 200→90 = 55%
    expect(maxDrawdown([100, 200, 150, 100, 120, 90, 120])).toBeCloseTo(0.55, 10)
  })

  it('recovers the peak before a new drawdown window', () => {
    // peak 100 → 80 (20%), then up to 300, then 300 → 240 (20%)
    expect(maxDrawdown([100, 80, 300, 240])).toBeCloseTo(0.2, 10)
  })
})

describe('annualizedReturn (S76)', () => {
  it('annualizes a one-year doubling to ~100%', () => {
    const s: FundSnapshotPoint[] = [
      { t: '2025-01-01T00:00:00Z', value: 100 },
      { t: '2026-01-01T00:00:00Z', value: 200 },
    ]
    const r = annualizedReturn(s)
    expect(r).not.toBeNull()
    expect(r as number).toBeCloseTo(1.0, 2)
  })

  it('is negative for a declining fund', () => {
    const r = annualizedReturn([
      { t: '2025-01-01T00:00:00Z', value: 200 },
      { t: '2026-01-01T00:00:00Z', value: 150 },
    ])
    expect(r as number).toBeLessThan(0)
  })

  it('returns null for a zero-span series', () => {
    expect(
      annualizedReturn([
        { t: '2026-01-01T00:00:00Z', value: 100 },
        { t: '2026-01-01T00:00:00Z', value: 200 },
      ]),
    ).toBeNull()
  })
})

describe('computeFundMetrics happy path', () => {
  it('computes all four metrics for a sufficient series', () => {
    const m = computeFundMetrics(days([100, 110, 105, 120, 130]))
    expect(m.insufficient).toBe(false)
    expect(m.annualReturn).not.toBeNull()
    expect(m.volatility).not.toBeNull()
    expect((m.volatility as number) >= 0).toBe(true)
    expect(m.maxDrawdown).not.toBeNull()
    // one dip 110 → 105 = ~4.5% is the only drawdown
    expect(m.maxDrawdown as number).toBeCloseTo((110 - 105) / 110, 10)
    // sharpe = annualReturn / volatility
    expect(m.sharpe).toBeCloseTo(
      (m.annualReturn as number) / (m.volatility as number),
      8,
    )
  })

  it('reports null sharpe for a perfectly flat fund (zero volatility)', () => {
    const m = computeFundMetrics(days([100, 100, 100, 100]))
    expect(m.insufficient).toBe(false)
    expect(m.volatility).toBeCloseTo(0, 12)
    expect(m.sharpe).toBeNull()
    expect(m.maxDrawdown).toBe(0)
  })
})
