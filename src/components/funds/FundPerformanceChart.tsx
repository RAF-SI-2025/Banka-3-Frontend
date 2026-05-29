import type { v1FundPerformanceSnapshot } from '@/lib/api/generated/models/v1FundPerformanceSnapshot'

// Hand-rolled SVG line chart of total_value_rsd over time. Matches
// the look of PriceHistoryChart. The snapshot cron writes one row
// daily so the series is dense enough to draw without smoothing.
const W = 720
const H = 200
const PAD_X = 40
const PAD_Y = 12

export function FundPerformanceChart({ rows }: { rows: v1FundPerformanceSnapshot[] }) {
  if (rows.length === 0) return null

  const values = rows.map((r) => Number(r.totalValueRsd ?? '0'))
  const vMin = Math.min(...values)
  const vMax = Math.max(...values)
  const span = Math.max(1e-6, vMax - vMin)
  const usableW = W - PAD_X * 2
  const stepX = rows.length > 1 ? usableW / (rows.length - 1) : 0
  const yAt = (v: number) => PAD_Y + (H - PAD_Y * 2) * (1 - (v - vMin) / span)
  const xAt = (i: number) => PAD_X + i * stepX

  const path = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`)
    .join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-full" role="img" aria-label="Performans fonda">
      <line x1={PAD_X} x2={W - PAD_X} y1={H - PAD_Y} y2={H - PAD_Y} className="stroke-border" strokeWidth={1} />
      <line x1={PAD_X} x2={W - PAD_X} y1={PAD_Y} y2={PAD_Y} className="stroke-border" strokeDasharray="2 4" strokeWidth={1} />
      <text x={4} y={PAD_Y + 4} className="fill-muted-foreground text-[10px]">{vMax.toFixed(0)}</text>
      <text x={4} y={H - PAD_Y} className="fill-muted-foreground text-[10px]">{vMin.toFixed(0)}</text>
      <path d={path} className="stroke-primary" strokeWidth={1.5} fill="none" />
    </svg>
  )
}
