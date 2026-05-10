import { useState } from 'react'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { listHoldings } from '@/lib/api/portfolio'
import type { v1Holding } from '@/lib/api/generated/models/v1Holding'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'
import { v1SecurityType } from '@/lib/api/generated/models/v1SecurityType'
import { securityTypeLabel } from '@/lib/labels'
import { formatMoney } from '@/lib/format'
import { unrealizedPnL } from '@/lib/trading/pnl'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ExerciseOptionDialog } from '@/components/trading/ExerciseOptionDialog'

const TRADING_PERMS = [
  Permissions.Actuary,
  Permissions.ActuarySupervisor,
  Permissions.ActuaryAgent,
  Permissions.Admin,
] as const

export const Route = createFileRoute('/_authed/portal/portfolio/')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!hasAny(perms, [...TRADING_PERMS])) {
      throw redirect({ to: '/portal' })
    }
  },
  component: PortalPortfolioPage,
})

function PortalPortfolioPage() {
  const userId = useAuthStore((s) => s.userId) ?? ''
  // Server forces own-portfolio for non-supervisor callers anyway.
  const holdings = useQuery({
    queryKey: keys.portfolio.list(userId),
    queryFn: () => listHoldings(),
    enabled: Boolean(userId),
  })

  const items = holdings.data?.holdings ?? []
  const stocks = items.filter((h) => h.security?.type === v1SecurityType.SECURITY_TYPE_STOCK)
  const futures = items.filter((h) => h.security?.type === v1SecurityType.SECURITY_TYPE_FUTURE)
  const forex = items.filter((h) => h.security?.type === v1SecurityType.SECURITY_TYPE_FOREX)
  const options = items.filter((h) => h.security?.type === v1SecurityType.SECURITY_TYPE_OPTION)

  return (
    <main className="container space-y-6 py-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Portfolio (aktuar)</h1>
          <p className="text-sm text-muted-foreground">Vaše pozicije po hartiji.</p>
        </div>
        <Card className="px-4 py-2 text-right">
          <p className="text-xs text-muted-foreground">Ukupan profit</p>
          <p className="text-xl font-semibold">{formatMoney(holdings.data?.totalProfit)}</p>
        </Card>
      </header>

      <HoldingsSection title={securityTypeLabel[v1SecurityType.SECURITY_TYPE_STOCK]} rows={stocks} loading={holdings.isFetching} />
      <HoldingsSection title={securityTypeLabel[v1SecurityType.SECURITY_TYPE_FUTURE]} rows={futures} loading={holdings.isFetching} />
      {forex.length > 0 && (
        <HoldingsSection title={securityTypeLabel[v1SecurityType.SECURITY_TYPE_FOREX]} rows={forex} loading={holdings.isFetching} />
      )}
      {options.length > 0 && (
        <OptionsSection rows={options} loading={holdings.isFetching} />
      )}
    </main>
  )
}

// OptionsSection adds the spec p.61.d "Iskoristi" action plus the
// option-specific columns the regular HoldingsSection doesn't show
// (Tip, Strike, Datum izvršenja).
function OptionsSection({ rows, loading }: { rows: v1Holding[]; loading: boolean }) {
  const [exercising, setExercising] = useState<v1Holding | null>(null)
  return (
    <Card>
      <CardHeader><CardTitle>{securityTypeLabel[v1SecurityType.SECURITY_TYPE_OPTION]}</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <THead>
            <TR>
              <TH>Ticker</TH>
              <TH>Tip</TH>
              <TH className="text-right">Strike</TH>
              <TH className="text-right">Količina</TH>
              <TH className="text-right">Premium plaćen</TH>
              <TH>Datum izvršenja</TH>
              <TH>{/* actions */}</TH>
            </TR>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={7}>{loading ? 'Učitavanje…' : 'Nemate opcije'}</EmptyRow>
            ) : (
              rows.map((h) => {
                const sec = h.security
                const optionTypeLabel = sec?.optionType === 'OPTION_TYPE_CALL' ? 'CALL'
                  : sec?.optionType === 'OPTION_TYPE_PUT' ? 'PUT' : '—'
                return (
                  <TR key={h.id}>
                    <TD className="font-mono">{sec?.ticker ?? '—'}</TD>
                    <TD>{optionTypeLabel}</TD>
                    <TD className="text-right">{formatMoney(sec?.strikePrice, sec?.currency)}</TD>
                    <TD className="text-right">{h.quantity ?? 0}</TD>
                    <TD className="text-right">{formatMoney(h.weightedAvgPrice, sec?.currency)}</TD>
                    <TD>{sec?.settlementDate ? new Date(sec.settlementDate).toLocaleDateString('sr-RS') : '—'}</TD>
                    <TD>
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        data-cy={`exercise-${h.id}`}
                        disabled={(h.quantity ?? 0) === 0}
                        onClick={() => setExercising(h)}
                      >
                        Iskoristi
                      </Button>
                    </TD>
                  </TR>
                )
              })
            )}
          </TBody>
        </Table>
      </CardContent>
      {exercising && (
        <ExerciseOptionDialog
          open={Boolean(exercising)}
          onClose={() => setExercising(null)}
          holding={exercising}
        />
      )}
    </Card>
  )
}

function HoldingsSection({ title, rows, loading }: { title: string; rows: v1Holding[]; loading: boolean }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <THead>
            <TR>
              <TH>Ticker</TH>
              <TH className="text-right">Količina</TH>
              <TH className="text-right">Avg cena</TH>
              <TH className="text-right">Trenutna cena</TH>
              <TH className="text-right">Tržišna vrednost</TH>
              <TH className="text-right">Nerealizovan P&L</TH>
              <TH>{/* arrow */}</TH>
            </TR>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={7}>{loading ? 'Učitavanje…' : 'Nemate pozicije'}</EmptyRow>
            ) : (
              rows.map((h) => {
                const pnl = unrealizedPnL({
                  quantity: h.quantity,
                  weightedAvgPrice: h.weightedAvgPrice,
                  currentPrice: h.currentPrice,
                  profit: h.profit,
                })
                const sign = pnl.abs >= 0 ? '+' : ''
                const className = pnl.abs >= 0 ? 'text-emerald-600' : 'text-rose-600'
                return (
                  <TR key={h.id}>
                    <TD className="font-mono">{h.security?.ticker ?? '—'}</TD>
                    <TD className="text-right">{h.quantity ?? 0}</TD>
                    <TD className="text-right">{formatMoney(h.weightedAvgPrice)}</TD>
                    <TD className="text-right">{formatMoney(h.currentPrice)}</TD>
                    <TD className="text-right">{formatMoney(h.marketValue)}</TD>
                    <TD className={`text-right ${className}`}>
                      {sign}{pnl.abs.toFixed(2)}
                      {pnl.pct !== null && <span className="text-xs"> ({sign}{pnl.pct.toFixed(2)}%)</span>}
                    </TD>
                    <TD>
                      {h.security?.id && (
                        <Link
                          to="/portal/trgovina/$listingId"
                          params={{ listingId: h.security.id }}
                          className="text-primary hover:underline"
                        >
                          Trguj →
                        </Link>
                      )}
                    </TD>
                  </TR>
                )
              })
            )}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  )
}
