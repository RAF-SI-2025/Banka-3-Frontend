import { useState } from 'react'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { listHoldings } from '@/lib/api/portfolio'
import type { v1Holding } from '@/lib/api/generated/models/v1Holding'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'
import { v1SecurityType } from '@/lib/api/generated/models/v1SecurityType'
import { securityTypeLabel } from '@/lib/labels'
import { formatDate, formatMoney } from '@/lib/format'
import { unrealizedPnL } from '@/lib/trading/pnl'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ExerciseOptionDialog } from '@/components/trading/ExerciseOptionDialog'
import { PublicCountEditor } from '@/components/trading/PublicCountEditor'
import { MyFundPositions } from '@/components/funds/MyFundPositions'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

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
  const perms = useAuthStore((s) => s.permissions)
  const fundsEnabled = hasAny(perms, [
    Permissions.Admin,
    Permissions.FundsReadSupervisor,
    Permissions.FundsManageSupervisor,
  ])
  const [tab, setTab] = useState<'securities' | 'funds'>('securities')
  // Server forces own-portfolio for non-supervisor callers anyway.
  // Fills land async via the trading worker — without a poll the page
  // would render the pre-fill snapshot and silently rot. 5s strikes a
  // balance with the worker's per-second cadence on liquid listings.
  const holdings = useQuery({
    queryKey: keys.portfolio.list(userId),
    queryFn: () => listHoldings(),
    enabled: Boolean(userId),
    refetchInterval: 5_000,
    staleTime: 0,
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

      {fundsEnabled && (
        <div className="flex gap-1 border-b border-border" data-cy="portfolio-tabs">
          <PTabButton active={tab === 'securities'} onClick={() => setTab('securities')} dataCy="portfolio-tab-securities">
            Moje hartije
          </PTabButton>
          <PTabButton active={tab === 'funds'} onClick={() => setTab('funds')} dataCy="portfolio-tab-funds">
            Moji fondovi
          </PTabButton>
        </div>
      )}

      {tab === 'securities' ? (
        <>
          <HoldingsSection title={securityTypeLabel[v1SecurityType.SECURITY_TYPE_STOCK]} rows={stocks} loading={holdings.isFetching} showPublic />
          <HoldingsSection title={securityTypeLabel[v1SecurityType.SECURITY_TYPE_FUTURE]} rows={futures} loading={holdings.isFetching} />
          {forex.length > 0 && (
            <HoldingsSection title={securityTypeLabel[v1SecurityType.SECURITY_TYPE_FOREX]} rows={forex} loading={holdings.isFetching} />
          )}
          {options.length > 0 && (
            <OptionsSection rows={options} loading={holdings.isFetching} />
          )}
        </>
      ) : (
        <MyFundPositions basePath="/portal/portfolio" />
      )}
    </main>
  )
}

// OptionsSection adds the spec p.61.d "Iskoristi" action plus the
// option-specific columns the regular HoldingsSection doesn't show
// (Tip, Strike, Datum izvršenja).
function PTabButton({
  active,
  onClick,
  children,
  dataCy,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  dataCy?: string
}) {
  return (
    <button
      type="button"
      data-cy={dataCy}
      onClick={onClick}
      className={cn(
        'border-b-2 px-4 py-2 text-sm transition',
        active
          ? 'border-primary font-medium text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

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

function HoldingsSection({ title, rows, loading, showPublic }: { title: string; rows: v1Holding[]; loading: boolean; showPublic?: boolean }) {
  const navigate = useNavigate()
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
              <TH>Poslednja izmena</TH>
              {showPublic && <TH className="text-right">Javno</TH>}
              <TH>{/* actions */}</TH>
            </TR>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={showPublic ? 9 : 8}>{loading ? 'Učitavanje…' : 'Nemate pozicije'}</EmptyRow>
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
                const securityId = h.security?.id
                const qty = h.quantity ?? 0
                return (
                  <TR
                    key={h.id}
                    onClick={securityId ? () => navigate({ to: '/portal/trgovina/$securityId', params: { securityId } }) : undefined}
                  >
                    <TD className="font-mono">{h.security?.ticker ?? '—'}</TD>
                    <TD className="text-right">{qty}</TD>
                    <TD className="text-right">{formatMoney(h.weightedAvgPrice)}</TD>
                    <TD className="text-right">{formatMoney(h.currentPrice)}</TD>
                    <TD className="text-right">{formatMoney(h.marketValue)}</TD>
                    <TD className={`text-right ${className}`}>
                      {sign}{pnl.abs.toFixed(2)}
                      {pnl.pct !== null && <span className="text-xs"> ({sign}{pnl.pct.toFixed(2)}%)</span>}
                    </TD>
                    <TD className="text-muted-foreground">{formatDate(h.updatedAt)}</TD>
                    {showPublic && (
                      <TD className="text-right">
                        <PublicCountEditor holding={h} />
                      </TD>
                    )}
                    <TD>
                      {securityId && qty > 0 && (
                        <Link
                          to="/portal/trgovina/$securityId"
                          params={{ securityId }}
                          search={{ direction: 'sell', qty }}
                          data-cy={`sell-deeplink-${h.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-soft hover:bg-primary/90"
                        >
                          Prodaj
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
