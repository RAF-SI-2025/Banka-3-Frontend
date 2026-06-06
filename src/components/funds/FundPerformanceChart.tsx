import type { v1FundPerformanceSnapshot } from '@/lib/api/generated/models/v1FundPerformanceSnapshot'

// Hand-rolled SVG line chart of total_value_rsd over time. Matches
// the look of PriceHistoryChart. The snapshot cron writes one row
// daily so the series is dense enough to draw without smoothing.
//
// An optional `avg` overlay (todoSpec S75) draws the average of all
// funds' value over the same time window as a dashed comparison line.
// Both series are scaled to the combined min/max so the comparison is
// visually honest.
const W = 720
const H = 200
const PAD_X = 40
const PAD_Y = 12

export interface AvgPoint {
  /** ISO timestamp (must line up with the fund's snapshot timestamps). */
  t: string
  /** average total value across all funds in RSD at that instant. */
  value: number
}

export function FundPerformanceChart({
  rows,
  avg,
}: {
  rows: v1FundPerformanceSnapshot[]
  avg?: AvgPoint[]
}) {
  if (rows.length === 0) return null

  const values = rows.map((r) => Number(r.totalValueRsd ?? '0'))
  const avgValues = (avg ?? []).map((p) => p.value).filter((v) => Number.isFinite(v))
  const all = [...values, ...avgValues]
  const vMin = Math.min(...all)
  const vMax = Math.max(...all)
  const span = Math.max(1e-6, vMax - vMin)
  const usableW = W - PAD_X * 2
  const stepX = rows.length > 1 ? usableW / (rows.length - 1) : 0
  const yAt = (v: number) => PAD_Y + (H - PAD_Y * 2) * (1 - (v - vMin) / span)
  const xAt = (i: number) => PAD_X + i * stepX

  const path = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`)
    .join(' ')

  // The avg line is index-aligned to the fund's own snapshot rows so the
  // two lines share an x-axis; gaps (no avg value for that index) break
  // the path into separate move segments.
  const avgPath =
    avg && avg.length > 0
      ? avg
          .map((p, i) =>
            Number.isFinite(p.value)
              ? `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(p.value).toFixed(1)}`
              : '',
          )
          .filter(Boolean)
          .join(' ')
      : ''

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-full" role="img" aria-label="Performans fonda">
        <line x1={PAD_X} x2={W - PAD_X} y1={H - PAD_Y} y2={H - PAD_Y} className="stroke-border" strokeWidth={1} />
        <line x1={PAD_X} x2={W - PAD_X} y1={PAD_Y} y2={PAD_Y} className="stroke-border" strokeDasharray="2 4" strokeWidth={1} />
        <text x={4} y={PAD_Y + 4} className="fill-muted-foreground text-[10px]">{vMax.toFixed(0)}</text>
        <text x={4} y={H - PAD_Y} className="fill-muted-foreground text-[10px]">{vMin.toFixed(0)}</text>
        {avgPath && (
          <path
            d={avgPath}
            className="stroke-muted-foreground"
            strokeWidth={1.25}
            strokeDasharray="4 3"
            fill="none"
            data-cy="fund-perf-avg-line"
          />
        )}
        <path d={path} className="stroke-primary" strokeWidth={1.5} fill="none" data-cy="fund-perf-line" />
      </svg>
      {avgPath && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-primary" /> Ovaj fond
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 border-t border-dashed border-muted-foreground" />
            Prosek svih fondova
          </span>
        </div>
      )}
    </div>
  )
}
