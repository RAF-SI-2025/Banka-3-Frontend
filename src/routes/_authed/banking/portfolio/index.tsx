import { useState, type ReactNode } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { listHoldings } from '@/lib/api/portfolio'
import type { v1Holding } from '@/lib/api/generated/models/v1Holding'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { v1SecurityType } from '@/lib/api/generated/models/v1SecurityType'
import { securityTypeLabel } from '@/lib/labels'
import { formatDate, formatMoney } from '@/lib/format'
import { unrealizedPnL } from '@/lib/trading/pnl'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PublicCountEditor } from '@/components/trading/PublicCountEditor'
import { MyFundPositions } from '@/components/funds/MyFundPositions'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_authed/banking/portfolio/')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!has(perms, Permissions.TradingClient)) {
      throw redirect({ to: '/banking' })
    }
  },
  component: PortfolioPage,
})

function PortfolioPage() {
  const userId = useAuthStore((s) => s.userId) ?? ''
  const perms = useAuthStore((s) => s.permissions)
  const fundsEnabled = has(perms, Permissions.TradingClient)
  const [tab, setTab] = useState<'securities' | 'funds'>('securities')
  // Fills land async via the trading worker — without a poll the page
  // would render the pre-fill snapshot and silently rot.
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

  return (
    <main className="container space-y-6 py-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Portfolio</h1>
          <p className="text-sm text-muted-foreground">Vaše pozicije po hartiji.</p>
        </div>
        <Card className="px-4 py-2 text-right">
          <p className="text-xs text-muted-foreground">Ukupan profit</p>
          <p className="text-xl font-semibold">{formatMoney(holdings.data?.totalProfit)}</p>
        </Card>
      </header>

      {fundsEnabled && (
        <div className="flex gap-1 border-b border-border" data-cy="portfolio-tabs">
          <TabButton active={tab === 'securities'} onClick={() => setTab('securities')} dataCy="portfolio-tab-securities">
            Moje hartije
          </TabButton>
          <TabButton active={tab === 'funds'} onClick={() => setTab('funds')} dataCy="portfolio-tab-funds">
            Moji fondovi
          </TabButton>
        </div>
      )}

      {tab === 'securities' ? (
        <>
          <HoldingsSection title={securityTypeLabel[v1SecurityType.SECURITY_TYPE_STOCK]} rows={stocks} loading={holdings.isFetching} showPublic />
          <HoldingsSection title={securityTypeLabel[v1SecurityType.SECURITY_TYPE_FUTURE]} rows={futures} loading={holdings.isFetching} />
        </>
      ) : (
        <MyFundPositions basePath="/banking/portfolio" />
      )}
    </main>
  )
}

function TabButton({
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
            </TR>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={showPublic ? 8 : 7}>{loading ? 'Učitavanje…' : 'Nemate pozicije'}</EmptyRow>
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
                return (
                  <TR
                    key={h.id}
                    onClick={securityId ? () => navigate({ to: '/banking/portfolio/$securityId', params: { securityId } }) : undefined}
                  >
                    <TD className="font-mono">{h.security?.ticker ?? '—'}</TD>
                    <TD className="text-right">{h.quantity ?? 0}</TD>
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
