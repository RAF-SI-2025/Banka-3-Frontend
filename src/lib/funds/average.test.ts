import { describe, expect, it } from 'vitest'
import { buildAverageSeries } from './average'

describe('buildAverageSeries (S75)', () => {
  const base = [
    { snapshotAt: '2026-01-01T12:00:00Z', totalValueRsd: '100' },
    { snapshotAt: '2026-01-02T12:00:00Z', totalValueRsd: '200' },
  ]

  it('averages across funds per day, aligned to the base series', () => {
    const others = [
      base,
      [
        { snapshotAt: '2026-01-01T09:00:00Z', totalValueRsd: '300' },
        { snapshotAt: '2026-01-02T09:00:00Z', totalValueRsd: '400' },
      ],
    ]
    const avg = buildAverageSeries(base, others)
    expect(avg).toHaveLength(2)
    expect(avg[0].value).toBeCloseTo((100 + 300) / 2, 10) // day 1
    expect(avg[1].value).toBeCloseTo((200 + 400) / 2, 10) // day 2
  })

  it('buckets by calendar day so different snapshot times still align', () => {
    const others = [[{ snapshotAt: '2026-01-01T23:30:00Z', totalValueRsd: '500' }]]
    const avg = buildAverageSeries(base, others)
    expect(avg[0].value).toBe(500)
  })

  it('yields NaN for a day no fund has data for', () => {
    const avg = buildAverageSeries(base, [
      [{ snapshotAt: '2026-01-01T12:00:00Z', totalValueRsd: '300' }],
    ])
    expect(avg[0].value).toBe(300)
    expect(Number.isNaN(avg[1].value)).toBe(true)
  })

  it('ignores non-positive / NaN values', () => {
    const avg = buildAverageSeries(base, [
      [
        { snapshotAt: '2026-01-01T12:00:00Z', totalValueRsd: '0' },
        { snapshotAt: '2026-01-01T12:00:00Z', totalValueRsd: '600' },
      ],
    ])
    expect(avg[0].value).toBe(600)
  })
})
