import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { listHoldings } from '@/lib/api/portfolio'
import { listDividends } from '@/lib/api/dividends'
import { getSecurity } from '@/lib/api/securities'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { securityTypeLabel } from '@/lib/labels'
import { formatMoney, formatDate } from '@/lib/format'
import { unrealizedPnL } from '@/lib/trading/pnl'
import { v1SecurityType } from '@/lib/api/generated/models/v1SecurityType'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/_authed/banking/portfolio/$securityId')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!has(perms, Permissions.TradingClient)) {
      throw redirect({ to: '/banking' })
    }
  },
  component: PositionDetail,
})

function PositionDetail() {
  const { securityId } = Route.useParams()

  const security = useQuery({
    queryKey: keys.security.detail(securityId),
    queryFn: () => getSecurity(securityId),
    // Live price + the holding below auto-refresh like the portfolio
    // index (5s). Without this the per-security page stayed stale
    // after a sell — the holding still looked unsold until a manual
    // reload.
    refetchInterval: 5_000,
  })

  const userId = useAuthStore((s) => s.userId) ?? ''
  // Reuse the shared list endpoint and pluck this position. Backend
  // doesn't ship a per-position GET; the list response is small.
  const holdings = useQuery({
    queryKey: keys.portfolio.list(userId),
    queryFn: () => listHoldings(),
    enabled: Boolean(userId),
    refetchInterval: 5_000,
  })

  // Dividend history for this position (S59) — dates + amounts.
  const dividends = useQuery({
    queryKey: keys.dividends.position(userId, securityId),
    queryFn: () => listDividends({ securityId }),
    enabled: Boolean(userId),
  })

  const sec = security.data?.security
  const lst = security.data?.listing
  const holding = (holdings.data?.holdings ?? []).find((h) => h.security?.id === securityId)
  const payouts = dividends.data?.payouts ?? []

  const pnl = holding
    ? unrealizedPnL({ quantity: holding.quantity, weightedAvgPrice: holding.weightedAvgPrice, currentPrice: holding.currentPrice, profit: holding.profit })
    : null

  // Buy/sell on a stock or future routes through the listing detail
  // form; pass ?direction=sell&qty=N as deep-link initial values.
  // We deliberately deep-link by *security* id (not listing id) so
  // the resulting URL is the same shape the user sees in the
  // address bar of any listing — keeps shareable links consistent.
  const tradable = sec?.type === v1SecurityType.SECURITY_TYPE_STOCK || sec?.type === v1SecurityType.SECURITY_TYPE_FUTURE
  const sellTargetId = sec?.id ?? lst?.id

  return (
    <main className="container space-y-6 py-8">
      <Link to="/banking/portfolio" className="text-sm text-muted-foreground hover:text-foreground">
        ← Nazad na portfolio
      </Link>

      {!holding && holdings.isFetched && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Nemate aktivnu poziciju za ovu hartiju.
        </div>
      )}

      {holding && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="font-mono">{sec?.ticker ?? securityId}</CardTitle>
              {sec?.name && <p className="text-sm text-muted-foreground">{sec.name}</p>}
            </div>
            {tradable && sellTargetId && holding.quantity && holding.quantity > 0 && (
              <Link
                to="/banking/trgovina/$securityId"
                params={{ securityId: sellTargetId }}
                search={{ direction: 'sell', qty: holding.quantity }}
                data-cy="sell-deeplink"
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-soft hover:bg-primary/90"
              >
                Prodaj
              </Link>
            )}
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Tip">{sec?.type ? securityTypeLabel[sec.type] : '—'}</Row>
            <Row label="Količina">{holding.quantity ?? 0}</Row>
            <Row label="Prosečna nabavna cena">{formatMoney(holding.weightedAvgPrice)}</Row>
            <Row label="Trenutna cena">{formatMoney(holding.currentPrice)}</Row>
            <Row label="Tržišna vrednost">{formatMoney(holding.marketValue)}</Row>
            <Row label="Nerealizovan P&L">
              {pnl && (
                <span className={pnl.abs >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                  {pnl.abs >= 0 ? '+' : ''}{pnl.abs.toFixed(2)}
                  {pnl.pct !== null && <> ({pnl.abs >= 0 ? '+' : ''}{pnl.pct.toFixed(2)}%)</>}
                </span>
              )}
            </Row>
          </CardContent>
        </Card>
      )}

      {(payouts.length > 0 || dividends.isFetched) && (
        <Card data-cy="dividend-history">
          <CardHeader>
            <CardTitle className="text-base">Isplaćene dividende</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {payouts.length === 0 ? (
              <p className="text-muted-foreground">Za ovu poziciju još nema isplaćenih dividendi.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 text-left text-muted-foreground">
                    <th className="py-1.5 font-medium">Datum</th>
                    <th className="py-1.5 font-medium">Količina</th>
                    <th className="py-1.5 text-right font-medium">Iznos</th>
                    <th className="py-1.5 text-right font-medium">Porez (RSD)</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((d) => (
                    <tr key={d.id} className="border-b border-border/40 last:border-0">
                      <td className="py-1.5">{formatDate(d.paidAt ?? d.createdAt)}</td>
                      <td className="py-1.5">{d.quantity ?? 0}</td>
                      <td className="py-1.5 text-right">{formatMoney(d.grossAmount, d.currency)}</td>
                      <td className="py-1.5 text-right">{formatMoney(d.taxRsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/40 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  )
}
