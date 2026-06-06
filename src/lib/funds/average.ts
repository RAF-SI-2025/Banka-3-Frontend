// Builds the "average of all funds" comparison series (todoSpec S75)
// aligned to a base fund's snapshot timestamps. Each fund's snapshots
// are keyed by day; for every day in the base fund's series we average
// the total value across whichever funds have a snapshot that day.

import type { v1FundPerformanceSnapshot } from '@/lib/api/generated/models/v1FundPerformanceSnapshot'

export interface AvgPoint {
  t: string
  value: number
}

/** YYYY-MM-DD bucket so snapshots taken at slightly different times still align. */
function dayKey(iso: string | undefined): string {
  if (!iso) return ''
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : ''
}

/**
 * @param base   the snapshots of the fund being viewed (defines the x-axis).
 * @param others one snapshot list per fund in the universe (may include base).
 * @returns one AvgPoint per base snapshot; value is NaN when no fund has data
 *          for that day (the chart breaks the line there).
 */
export function buildAverageSeries(
  base: ReadonlyArray<v1FundPerformanceSnapshot>,
  others: ReadonlyArray<ReadonlyArray<v1FundPerformanceSnapshot>>,
): AvgPoint[] {
  // day -> { sum, count } across all funds.
  const byDay = new Map<string, { sum: number; count: number }>()
  for (const series of others) {
    for (const snap of series) {
      const k = dayKey(snap.snapshotAt)
      const v = Number(snap.totalValueRsd ?? 'NaN')
      if (!k || !Number.isFinite(v) || v <= 0) continue
      const cur = byDay.get(k) ?? { sum: 0, count: 0 }
      cur.sum += v
      cur.count += 1
      byDay.set(k, cur)
    }
  }

  return base.map((snap) => {
    const k = dayKey(snap.snapshotAt)
    const agg = byDay.get(k)
    return {
      t: snap.snapshotAt ?? '',
      value: agg && agg.count > 0 ? agg.sum / agg.count : NaN,
    }
  })
}
