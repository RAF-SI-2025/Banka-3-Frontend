// Price line + volume bar chart for the listing detail page. Hand-
// rolled SVG instead of pulling recharts; the data set is small (≤365
// daily rows) and the chart has no zoom/tooltip requirements per
// spec p.46. Renders nothing useful for empty data — the parent
// shows an "Nema istorije" message.

import type { v1ListingDailyPrice } from '@/lib/api/generated/models/v1ListingDailyPrice'

const W = 720
const H_PRICE = 200
const H_VOL = 60
const H_GAP = 12
const H = H_PRICE + H_GAP + H_VOL
const PAD_X = 32
const PAD_Y = 8

export function PriceHistoryChart({ rows }: { rows: v1ListingDailyPrice[] }) {
  if (rows.length === 0) return null

  const prices = rows.map((r) => Number(r.price ?? 0))
  const volumes = rows.map((r) => Number(r.volume ?? 0))

  const pMin = Math.min(...prices)
  const pMax = Math.max(...prices)
  const pSpan = Math.max(1e-6, pMax - pMin)
  const vMax = Math.max(1, ...volumes)

  const usableW = W - PAD_X * 2
  const stepX = rows.length > 1 ? usableW / (rows.length - 1) : 0

  const xAt = (i: number) => PAD_X + i * stepX
  const yPrice = (p: number) => PAD_Y + (H_PRICE - PAD_Y * 2) * (1 - (p - pMin) / pSpan)
  const yVolTop = H_PRICE + H_GAP

  const path = prices
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yPrice(p).toFixed(1)}`)
    .join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-full" role="img" aria-label="Istorija cene">
      <line x1={PAD_X} x2={W - PAD_X} y1={H_PRICE - PAD_Y} y2={H_PRICE - PAD_Y} className="stroke-border" strokeWidth={1} />
      <line x1={PAD_X} x2={W - PAD_X} y1={PAD_Y} y2={PAD_Y} className="stroke-border" strokeDasharray="2 4" strokeWidth={1} />

      <text x={4} y={PAD_Y + 4} className="fill-muted-foreground text-[10px]">{pMax.toFixed(2)}</text>
      <text x={4} y={H_PRICE - PAD_Y} className="fill-muted-foreground text-[10px]">{pMin.toFixed(2)}</text>

      <path d={path} className="stroke-primary" strokeWidth={1.5} fill="none" />

      {volumes.map((v, i) => {
        const barH = (H_VOL - 4) * (v / vMax)
        const barW = Math.max(1, stepX * 0.6)
        return (
          <rect
            key={i}
            x={xAt(i) - barW / 2}
            y={yVolTop + (H_VOL - barH)}
            width={barW}
            height={barH}
            className="fill-muted-foreground/40"
          />
        )
      })}
      <text x={4} y={yVolTop + 10} className="fill-muted-foreground text-[10px]">vol</text>
    </svg>
  )
}
