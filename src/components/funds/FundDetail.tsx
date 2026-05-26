import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error'
import { getFund, getFundPerformance } from '@/lib/api/funds'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { apiError } from '@/lib/api/error'
import { formatDate, formatMoney } from '@/lib/format'
import { InvestFundDialog } from './InvestFundDialog'
import { WithdrawFundDialog } from './WithdrawFundDialog'
import { FundSellHoldingDialog } from './FundSellHoldingDialog'
import { FundBuyDialog } from './FundBuyDialog'
import { FundPerformanceChart } from './FundPerformanceChart'
import type { v1FundHolding } from '@/lib/api/generated/models/v1FundHolding'

interface Props {
  fundId: string
}

// Spec p.74 fund detail. Body shows name + manager + total value +
// min uplata + RSD account + liquid balance. Holdings table mirrors
// the portfolio columns; supervisors get a per-row Prodaj button.
// Performance chart pulls from GetFundPerformance.
export function FundDetail({ fundId }: Props) {
  const perms = useAuthStore((s) => s.permissions)
  const canManage = has(perms, Permissions.FundsManageSupervisor)

  const fundQ = useQuery({
    queryKey: keys.funds.detail(fundId),
    queryFn: () => getFund(fundId),
    staleTime: 0,
    refetchInterval: 5_000,
  })
  const perfQ = useQuery({
    queryKey: keys.funds.performance(fundId, 365),
    queryFn: () => getFundPerformance(fundId, 365),
    staleTime: 5 * 60_000,
  })

  const [investOpen, setInvestOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [buyOpen, setBuyOpen] = useState(false)
  const [sellHolding, setSellHolding] = useState<v1FundHolding | null>(null)
  const [pendingToast, setPendingToast] = useState<string | null>(null)

  if (fundQ.isPending) {
    return <main className="container py-8 text-sm text-muted-foreground">Učitavanje fonda…</main>
  }
  if (fundQ.isError || !fundQ.data?.fund) {
    return (
      <main className="container py-8">
        <ErrorBanner>{apiError(fundQ.error, 'Fond nije pronađen.')}</ErrorBanner>
      </main>
    )
  }

  const { fund, holdings = [], position } = fundQ.data
  const snapshots = perfQ.data?.snapshots ?? []

  return (
    <main className="container space-y-6 py-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-cy="fund-detail-name">
            {fund.name}
          </h1>
          <p className="text-sm text-muted-foreground">{fund.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => setInvestOpen(true)} data-cy="fund-invest">
            {canManage ? 'Uplata u ime banke' : 'Uplata'}
          </Button>
          <Button variant="ghost" onClick={() => setWithdrawOpen(true)} data-cy="fund-withdraw">
            Povlačenje
          </Button>
        </div>
      </header>

      {pendingToast && (
        <div
          className="rounded-md border border-warning bg-warning/10 p-3 text-sm text-warning-foreground"
          data-cy="fund-pending-toast"
        >
          {pendingToast}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pregled</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <KV k="Menadžer" v={fund.managerDisplayName ?? fund.managerUserId ?? '—'} />
            <KV k="Ukupna vrednost" v={formatMoney(fund.totalValueRsd, 'RSD')} />
            <KV k="Min. uplata" v={formatMoney(fund.minimumContribution, 'RSD')} />
            <KV
              k="Profit"
              v={formatMoney(fund.profitRsd, 'RSD')}
              className={Number(fund.profitRsd ?? '0') >= 0 ? 'text-emerald-600' : 'text-rose-600'}
            />
            <KV k="Račun fonda" v={fund.bankAccountNumber ?? '—'} cy="fund-detail-bank-account" />
            <KV k="Likvidnost" v={formatMoney(fund.liquidRsd, 'RSD')} />
            <KV k="Vrednost hartija" v={formatMoney(fund.holdingsValueRsd, 'RSD')} />
            <KV k="Cena jedinice" v={formatMoney(fund.unitPriceRsd, 'RSD')} />
            <KV k="Ukupno jedinica" v={fund.totalUnits ?? '0'} />
          </CardContent>
        </Card>

        {position && (
          <Card>
            <CardHeader>
              <CardTitle>Vaša pozicija</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm" data-cy="fund-position-summary">
              <KV k="Jedinica" v={position.units ?? '0'} />
              <KV k="Trenutna vrednost" v={formatMoney(position.currentValueRsd, 'RSD')} />
              <KV k="Ukupno uloženo" v={formatMoney(position.totalInvestedRsd, 'RSD')} />
              <KV
                k="Profit"
                v={formatMoney(position.profitRsd, 'RSD')}
                className={Number(position.profitRsd ?? '0') >= 0 ? 'text-emerald-600' : 'text-rose-600'}
              />
              <KV k="Udeo u fondu" v={`${position.sharePct ?? '0'}%`} />
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performans (godinu unazad)</CardTitle>
        </CardHeader>
        <CardContent>
          {snapshots.length === 0 ? (
            <p className="text-sm text-muted-foreground">Još nema istorije performansa.</p>
          ) : (
            <FundPerformanceChart rows={snapshots} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Hartije u fondu</CardTitle>
          {canManage && (
            <Button
              type="button"
              size="sm"
              variant="primary"
              data-cy="fund-buy"
              onClick={() => setBuyOpen(true)}
            >
              Kupi hartiju za fond
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Ticker</TH>
                <TH className="text-right">Količina</TH>
                <TH className="text-right">Cena</TH>
                <TH className="text-right">Promena</TH>
                <TH className="text-right">Obim</TH>
                <TH className="text-right">Inicijalna marža</TH>
                <TH>Datum nabavke</TH>
                <TH>{/* actions */}</TH>
              </TR>
            </THead>
            <TBody>
              {holdings.length === 0 ? (
                <EmptyRow colSpan={8}>Fond trenutno nema otvorenih pozicija.</EmptyRow>
              ) : (
                holdings.map((h) => {
                  const chg = Number(h.changeAmt ?? '0')
                  const color = chg >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  return (
                    <TR key={h.holdingId} data-cy={`fund-holding-${h.holdingId}`}>
                      <TD className="font-mono">{h.security?.ticker ?? '—'}</TD>
                      <TD className="text-right">{h.quantity ?? 0}</TD>
                      <TD className="text-right">{formatMoney(h.currentPrice, h.currency)}</TD>
                      <TD className={`text-right ${color}`}>{formatMoney(h.changeAmt, h.currency)}</TD>
                      <TD className="text-right tabular-nums">
                        {h.volume != null ? Number(h.volume).toLocaleString('sr-RS') : '—'}
                      </TD>
                      <TD className="text-right">{formatMoney(h.initialMarginCost, h.currency)}</TD>
                      <TD>{formatDate(h.acquiredAt)}</TD>
                      <TD>
                        {canManage && (h.quantity ?? 0) > 0 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            data-cy={`fund-sell-${h.holdingId}`}
                            onClick={() => setSellHolding(h)}
                          >
                            Prodaj
                          </Button>
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

      <InvestFundDialog
        open={investOpen}
        fund={fund}
        onClose={() => setInvestOpen(false)}
      />
      <WithdrawFundDialog
        open={withdrawOpen}
        fund={fund}
        position={position ?? null}
        onClose={() => setWithdrawOpen(false)}
        onPending={() =>
          setPendingToast('Likvidacija u toku — sredstva stižu uskoro.')
        }
      />
      <FundSellHoldingDialog
        open={Boolean(sellHolding)}
        fund={fund}
        holding={sellHolding}
        onClose={() => setSellHolding(null)}
      />
      <FundBuyDialog open={buyOpen} fund={fund} onClose={() => setBuyOpen(false)} />
    </main>
  )
}

function KV({ k, v, className, cy }: { k: string; v: string; className?: string; cy?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{k}</span>
      <span className={`tabular-nums ${className ?? ''}`} data-cy={cy}>
        {v}
      </span>
    </div>
  )
}
