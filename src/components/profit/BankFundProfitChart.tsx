import { useMemo } from 'react'
import type { v1BankFundPosition } from '@/lib/api/generated/models/v1BankFundPosition'
import { compactRsd, formatMoney } from '@/lib/format'

// Dependency-free grouped horizontal bar chart of the bank's fund
// positions: "Uloženo" (principal) vs "Trenutna vrednost" (mark-to-
// market). The gap between the two bars is the profit/loss; the value
// bar is tinted green on gain, red on loss so the sign reads at a
// glance. Caller hands rows already sorted desc by profitRsd.

const VB_W = 880
const PAD = { top: 16, right: 96, bottom: 8, left: 176 }
const BAND = 46
const PLOT_W = VB_W - PAD.left - PAD.right

function num(s: string | undefined): number {
  const n = Number(s ?? 0)
  return Number.isFinite(n) ? n : 0
}

function clip(s: string, max = 26): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

export function BankFundProfitChart({ rows }: { rows: v1BankFundPosition[] }) {
  const model = useMemo(() => {
    const items = rows.map((r) => {
      const p = r.position
      const invested = num(p?.totalInvestedRsd)
      const current = num(p?.currentValueRsd)
      return {
        name: r.fundName || p?.fundName || '—',
        manager: r.managerDisplayName || '',
        sharePct: p?.sharePct ? Number(p.sharePct) : null,
        invested,
        current,
        profit: num(p?.profitRsd),
      }
    })
    const max = Math.max(1, ...items.flatMap((i) => [i.invested, i.current]))
    return { items, max }
  }, [rows])

  if (model.items.length === 0) return null

  const { items, max } = model
  const VB_H = PAD.top + PAD.bottom + items.length * BAND
  const barH = 12
  const gap = 4

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full"
        role="img"
        aria-label="Pozicije banke u investicionim fondovima — uloženo i trenutna vrednost"
      >
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
          const top = PAD.top + i * BAND
          const cy = top + BAND / 2
          const wInv = (it.invested / max) * PLOT_W
          const wCur = (it.current / max) * PLOT_W
          const gain = it.profit >= 0
          const valFill = gain ? 'hsl(var(--success))' : 'hsl(var(--danger))'
          const sign = gain ? '+' : '−'
          const tip =
            `${it.name}${it.manager ? ` — ${it.manager}` : ''}` +
            (it.sharePct != null ? `\nUdeo: ${it.sharePct.toFixed(2)}%` : '') +
            `\nUloženo: ${formatMoney(String(it.invested), 'RSD')}` +
            `\nTrenutna vrednost: ${formatMoney(String(it.current), 'RSD')}` +
            `\nProfit: ${sign}${formatMoney(String(Math.abs(it.profit)), 'RSD')}`
          const yInv = cy - gap / 2 - barH
          const yCur = cy + gap / 2
          return (
            <g key={`${it.name}-${i}`}>
              <title>{tip}</title>
              <text
                x={PAD.left - 10}
                y={cy - 4}
                textAnchor="end"
                fontSize={12}
                fill="hsl(var(--foreground))"
              >
                {clip(it.name)}
              </text>
              {it.sharePct != null && (
                <text
                  x={PAD.left - 10}
                  y={cy + 11}
                  textAnchor="end"
                  fontSize={10}
                  fill="hsl(var(--muted-foreground))"
                >
                  {`udeo ${it.sharePct.toFixed(2)}%`}
                </text>
              )}
              <rect
                x={PAD.left}
                y={yInv}
                width={Math.max(1, wInv)}
                height={barH}
                fill="hsl(var(--muted-foreground))"
                opacity={0.45}
                rx={2}
              />
              <rect
                x={PAD.left}
                y={yCur}
                width={Math.max(1, wCur)}
                height={barH}
                fill={valFill}
                rx={2}
              />
              <text
                x={PAD.left + Math.max(Math.max(1, wInv), Math.max(1, wCur)) + 8}
                y={cy + 4}
                textAnchor="start"
                fontSize={11}
                fill={valFill}
              >
                {`${sign}${compactRsd(Math.abs(it.profit))}`}
              </text>
            </g>
          )
        })}
      </svg>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'hsl(var(--muted-foreground))', opacity: 0.45 }} />
          Uloženo
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'hsl(var(--success))' }} />
          Trenutna vrednost (dobitak)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'hsl(var(--danger))' }} />
          Trenutna vrednost (gubitak)
        </span>
      </figcaption>
    </figure>
  )
}
