import { useMemo } from 'react'
import type { v1BankProfitBucket } from '@/lib/api/generated/models/v1BankProfitBucket'
import type { ProfitBucket } from '@/lib/api/profit'
import { compactRsd, formatMoney } from '@/lib/format'

// Dependency-free combo chart: stacked per-period bars (trading vs
// fund-withdrawal share of realized capital gains) plus a cumulative
// line on a secondary axis. Fixed viewBox + width:100% keeps it
// responsive without a charting library or a ResizeObserver.

const VB_W = 880
const VB_H = 340
const PAD = { top: 24, right: 64, bottom: 44, left: 64 }
const PLOT_W = VB_W - PAD.left - PAD.right
const PLOT_H = VB_H - PAD.top - PAD.bottom

function num(s: string | undefined): number {
  const n = Number(s ?? 0)
  return Number.isFinite(n) ? n : 0
}

function periodLabel(iso: string | undefined, bucket: ProfitBucket): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  if (bucket === 'month') return `${mm}.${d.getFullYear()}`
  return `${dd}.${mm}`
}

export function ProfitTimeseriesChart({
  buckets,
  bucket,
}: {
  buckets: v1BankProfitBucket[]
  bucket: ProfitBucket
}) {
  const model = useMemo(() => {
    const rows = buckets.map((b) => ({
      label: periodLabel(b.periodStart, bucket),
      trading: num(b.tradingRsd),
      fund: num(b.fundRsd),
      period: num(b.profitRsd),
      cumulative: num(b.cumulativeRsd),
      count: num(b.realizedCount),
    }))
    const maxPeriod = Math.max(1, ...rows.map((r) => r.period))
    const maxCum = Math.max(1, ...rows.map((r) => r.cumulative))
    return { rows, maxPeriod, maxCum }
  }, [buckets, bucket])

  if (model.rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Nema realizovane dobiti u izabranom periodu.
      </p>
    )
  }

  const { rows, maxPeriod, maxCum } = model
  const n = rows.length
  const slot = PLOT_W / n
  const barW = Math.min(34, slot * 0.6)

  const yBar = (v: number) => PAD.top + PLOT_H - (v / maxPeriod) * PLOT_H
  const yCum = (v: number) => PAD.top + PLOT_H - (v / maxCum) * PLOT_H
  const xCenter = (i: number) => PAD.left + slot * i + slot / 2

  const gridTicks = [0, 0.25, 0.5, 0.75, 1]
  // Label every period when sparse, otherwise thin to ~12 ticks.
  const labelStep = Math.max(1, Math.ceil(n / 12))

  const cumPath = rows
    .map((r, i) => `${i === 0 ? 'M' : 'L'} ${xCenter(i).toFixed(1)} ${yCum(r.cumulative).toFixed(1)}`)
    .join(' ')

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full"
        role="img"
        aria-label="Kretanje realizovane dobiti banke kroz vreme"
      >
        {/* horizontal gridlines + left (per-period) axis ticks */}
        {gridTicks.map((t) => {
          const y = PAD.top + PLOT_H - t * PLOT_H
          return (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={PAD.left + PLOT_W}
                y1={y}
                y2={y}
                stroke="hsl(var(--border))"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y + 4}
                textAnchor="end"
                fontSize={11}
                fill="hsl(var(--muted-foreground))"
              >
                {compactRsd(t * maxPeriod)}
              </text>
              <text
                x={PAD.left + PLOT_W + 8}
                y={y + 4}
                textAnchor="start"
                fontSize={11}
                fill="hsl(var(--primary))"
              >
                {compactRsd(t * maxCum)}
              </text>
            </g>
          )
        })}

        {/* stacked per-period bars: trading (base) + fund (on top) */}
        {rows.map((r, i) => {
          const cx = xCenter(i)
          const x = cx - barW / 2
          const tradingTop = yBar(r.trading)
          const stackTop = yBar(r.trading + r.fund)
          const tradingH = PAD.top + PLOT_H - tradingTop
          const fundH = tradingTop - stackTop
          const tip =
            `${r.label} — ukupno ${formatMoney(String(r.period), 'RSD')}` +
            `\nTrgovina: ${formatMoney(String(r.trading), 'RSD')}` +
            `\nFondovi: ${formatMoney(String(r.fund), 'RSD')}` +
            `\nKumulativno: ${formatMoney(String(r.cumulative), 'RSD')}` +
            `\nRealizovanih prodaja: ${r.count}`
          return (
            <g key={i}>
              <title>{tip}</title>
              {tradingH > 0 && (
                <rect
                  x={x}
                  y={tradingTop}
                  width={barW}
                  height={tradingH}
                  fill="hsl(var(--primary))"
                  rx={2}
                />
              )}
              {fundH > 0 && (
                <rect
                  x={x}
                  y={stackTop}
                  width={barW}
                  height={fundH}
                  fill="hsl(var(--success))"
                  rx={2}
                />
              )}
              {/* invisible full-height hit area so the tooltip works
                  even on near-zero periods */}
              <rect
                x={cx - slot / 2}
                y={PAD.top}
                width={slot}
                height={PLOT_H}
                fill="transparent"
              />
            </g>
          )
        })}

        {/* cumulative line + endpoint markers (secondary axis) */}
        <path
          d={cumPath}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          strokeDasharray="4 3"
          strokeLinejoin="round"
        />
        {rows.map((r, i) => (
          <circle
            key={i}
            cx={xCenter(i)}
            cy={yCum(r.cumulative)}
            r={2.5}
            fill="hsl(var(--primary))"
          />
        ))}

        {/* baseline + x labels */}
        <line
          x1={PAD.left}
          x2={PAD.left + PLOT_W}
          y1={PAD.top + PLOT_H}
          y2={PAD.top + PLOT_H}
          stroke="hsl(var(--border))"
          strokeWidth={1.5}
        />
        {rows.map((r, i) =>
          i % labelStep === 0 ? (
            <text
              key={i}
              x={xCenter(i)}
              y={PAD.top + PLOT_H + 18}
              textAnchor="middle"
              fontSize={11}
              fill="hsl(var(--muted-foreground))"
            >
              {r.label}
            </text>
          ) : null,
        )}
      </svg>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'hsl(var(--primary))' }} />
          Trgovina (po periodu)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'hsl(var(--success))' }} />
          Fondovi (po periodu)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: 'hsl(var(--primary))' }} />
          Kumulativno (desna osa)
        </span>
      </figcaption>
    </figure>
  )
}
