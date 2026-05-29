import { useMemo } from 'react'
import type { v1ActuaryPerformance } from '@/lib/api/generated/models/v1ActuaryPerformance'
import { v1ActuaryType } from '@/lib/api/generated/models/v1ActuaryType'
import { actuaryTypeLabel } from '@/lib/labels'
import { compactRsd, formatMoney } from '@/lib/format'

// Dependency-free ranked horizontal bar chart of realized capital
// gains per actuary. Mirrors the table's ordering (caller hands rows
// already sorted desc by profitRsd) so the chart reads top-to-bottom
// like the leaderboard. Fixed viewBox width + height derived from row
// count keeps it responsive without a charting lib.

const VB_W = 880
const PAD = { top: 16, right: 88, bottom: 8, left: 168 }
const BAND = 30
const PLOT_W = VB_W - PAD.left - PAD.right

function num(s: string | undefined): number {
  const n = Number(s ?? 0)
  return Number.isFinite(n) ? n : 0
}

function clip(s: string, max = 24): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

export function ActuaryProfitBarChart({ rows }: { rows: v1ActuaryPerformance[] }) {
  const model = useMemo(() => {
    const items = rows.map((r) => ({
      name: r.displayName || '—',
      type: r.type,
      isSupervisor: r.type === v1ActuaryType.ACTUARY_TYPE_SUPERVISOR,
      profit: num(r.profitRsd),
      count: num(r.realizedCount),
    }))
    const max = Math.max(1, ...items.map((i) => i.profit))
    return { items, max }
  }, [rows])

  if (model.items.length === 0) return null

  const { items, max } = model
  const VB_H = PAD.top + PAD.bottom + items.length * BAND
  const barH = Math.min(18, BAND * 0.62)

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full"
        role="img"
        aria-label="Rang lista aktuara po ostvarenoj kapitalnoj dobiti"
      >
        {/* vertical gridlines + RSD scale */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const x = PAD.left + t * PLOT_W
          return (
            <g key={t}>
              <line
                x1={x}
                x2={x}
                y1={PAD.top}
                y2={PAD.top + items.length * BAND}
                stroke="hsl(var(--border))"
                strokeWidth={1}
              />
              <text
                x={x}
                y={PAD.top - 4}
                textAnchor="middle"
                fontSize={11}
                fill="hsl(var(--muted-foreground))"
              >
                {compactRsd(t * max)}
              </text>
            </g>
          )
        })}

        {items.map((it, i) => {
          const cy = PAD.top + i * BAND + BAND / 2
          const w = (it.profit / max) * PLOT_W
          const fill = it.isSupervisor ? 'hsl(var(--primary))' : 'hsl(var(--success))'
          const tip =
            `${it.name} — ${it.type ? actuaryTypeLabel[it.type] : '—'}` +
            `\nProfit: ${formatMoney(String(it.profit), 'RSD')}` +
            `\nRealizovanih prodaja: ${it.count}`
          return (
            <g key={`${it.name}-${i}`}>
              <title>{tip}</title>
              <text
                x={PAD.left - 10}
                y={cy + 4}
                textAnchor="end"
                fontSize={12}
                fill="hsl(var(--foreground))"
              >
                {clip(it.name)}
              </text>
              <rect
                x={PAD.left}
                y={cy - barH / 2}
                width={Math.max(1, w)}
                height={barH}
                fill={fill}
                rx={2}
              />
              <text
                x={PAD.left + Math.max(1, w) + 8}
                y={cy + 4}
                textAnchor="start"
                fontSize={11}
                fill="hsl(var(--muted-foreground))"
              >
                {compactRsd(it.profit)}
              </text>
            </g>
          )
        })}
      </svg>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'hsl(var(--primary))' }} />
          Supervizor
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'hsl(var(--success))' }} />
          Agent
        </span>
      </figcaption>
    </figure>
  )
}
