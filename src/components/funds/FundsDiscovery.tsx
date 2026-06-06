import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { listFunds, type ListFundsArgs } from '@/lib/api/funds'
import { keys } from '@/lib/query-keys'
import { formatMoney } from '@/lib/format'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { useFundMetrics } from '@/lib/funds/useFundMetrics'
import type { FundMetrics } from '@/lib/funds/metrics'
import { CreateFundDialog } from './CreateFundDialog'

interface Props {
  basePath: '/portal/fondovi' | '/banking/fondovi'
}

// Sort keys: the four name/value/profit/min columns map to numeric or
// string fields on the fund; the four statistics columns sort on the
// client-computed metrics (todoSpec S73/S76/S77). Metrics that are
// unavailable (insufficient history) always sort to the bottom.
type SortKey =
  | 'name'
  | 'total_value'
  | 'profit'
  | 'minimum_contribution'
  | 'annualReturn'
  | 'sharpe'
  | 'maxDrawdown'
  | 'volatility'
type SortDir = 'asc' | 'desc'

function fmtPct(v: number | null): string {
  if (v == null) return '—'
  return `${(v * 100).toFixed(2)}%`
}

function fmtRatio(v: number | null): string {
  if (v == null) return '—'
  return v.toFixed(2)
}

// Spec p.71 "Investicioni fondovi — pregled" + todoSpec S73. Supervisors
// (with funds.manage.supervisor) see the "Kreiraj fond" button; everyone
// else is read-only. Discovery shows fund value/profit plus four risk
// statistics (godišnji prinos / Sharpe / Max Drawdown / Volatilnost),
// each column sortable; unavailable metrics render "—" (S74). Click row →
// detail.
export function FundsDiscovery({ basePath }: Props) {
  const navigate = useNavigate()
  const perms = useAuthStore((s) => s.permissions)
  const goDetail = (id: string) => {
    if (basePath === '/portal/fondovi') {
      navigate({ to: '/portal/fondovi/$fundId', params: { fundId: id } })
    } else {
      navigate({ to: '/banking/fondovi/$fundId', params: { fundId: id } })
    }
  }
  const canManage = has(perms, Permissions.FundsManageSupervisor)
  // Default to godišnji prinos descending (S76 is the canonical default view).
  const [sortKey, setSortKey] = useState<SortKey>('annualReturn')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [minAtLeast, setMinAtLeast] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  // The list endpoint sorts server-side, but the statistics are computed
  // client-side, so we fetch with a stable order and do all ordering here
  // to keep every column sortable uniformly.
  const args = useMemo<ListFundsArgs>(
    () => ({
      status: 'active',
      sort: 'name',
      order: 'asc',
      minContributionAtLeast: minAtLeast.trim() || undefined,
    }),
    [minAtLeast],
  )

  const q = useQuery({
    queryKey: keys.funds.list(args),
    queryFn: () => listFunds(args),
    staleTime: 0,
    refetchInterval: 5_000,
  })

  const funds = useMemo(() => q.data?.funds ?? [], [q.data])
  const metrics = useFundMetrics(funds.map((f) => f.id))

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // Numbers default to descending (biggest first); name to ascending.
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const rows = useMemo(() => {
    const metricField: Record<string, keyof FundMetrics> = {
      annualReturn: 'annualReturn',
      sharpe: 'sharpe',
      maxDrawdown: 'maxDrawdown',
      volatility: 'volatility',
    }
    const valueOf = (f: (typeof funds)[number]): number | string | null => {
      switch (sortKey) {
        case 'name':
          return (f.name ?? '').toLowerCase()
        case 'total_value':
          return Number(f.totalValueRsd ?? '0')
        case 'profit':
          return Number(f.profitRsd ?? '0')
        case 'minimum_contribution':
          return Number(f.minimumContribution ?? '0')
        default: {
          const m = metrics.get(f.id)
          return m[metricField[sortKey]] as number | null
        }
      }
    }
    const dir = sortDir === 'asc' ? 1 : -1
    return [...funds].sort((a, b) => {
      const va = valueOf(a)
      const vb = valueOf(b)
      // null (unavailable metric) always sinks to the bottom regardless of dir.
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'string' && typeof vb === 'string') {
        return va.localeCompare(vb, 'sr-RS') * dir
      }
      return ((va as number) - (vb as number)) * dir
    })
  }, [funds, metrics, sortKey, sortDir])

  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '')

  function SortTH({
    label,
    sortKeyName,
    className,
    cy,
  }: {
    label: string
    sortKeyName: SortKey
    className?: string
    cy: string
  }) {
    return (
      <TH
        className={`cursor-pointer select-none hover:text-foreground ${className ?? ''}`}
        onClick={() => toggleSort(sortKeyName)}
        aria-sort={sortKey === sortKeyName ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
        data-cy={`funds-sort-${cy}`}
        data-cy-active={sortKey === sortKeyName ? sortDir : undefined}
      >
        {label}
        {arrow(sortKeyName)}
      </TH>
    )
  }

  return (
    <main className="container space-y-6 py-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Investicioni fondovi</h1>
          <p className="text-sm text-muted-foreground">
            Aktivni fondovi banke sa statistikom prinosa i rizika. Kliknite na zaglavlje
            kolone za sortiranje, na red za detalje.
          </p>
        </div>
        {canManage && (
          <Button
            type="button"
            variant="primary"
            data-cy="funds-create"
            onClick={() => setCreateOpen(true)}
          >
            Kreiraj fond
          </Button>
        )}
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <Label htmlFor="funds-min-at-least">Min. uplata ≥ (RSD)</Label>
              <Input
                id="funds-min-at-least"
                value={minAtLeast}
                onChange={(e) => setMinAtLeast(e.target.value)}
                placeholder="npr. 1000"
                inputMode="decimal"
                data-cy="funds-min-at-least"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <THead>
              <TR>
                <SortTH label="Naziv" sortKeyName="name" cy="name" />
                <TH>Opis</TH>
                <SortTH
                  label="Ukupna vrednost"
                  sortKeyName="total_value"
                  className="text-right"
                  cy="total-value"
                />
                <SortTH label="Profit" sortKeyName="profit" className="text-right" cy="profit" />
                <SortTH
                  label="Min. uplata"
                  sortKeyName="minimum_contribution"
                  className="text-right"
                  cy="min"
                />
                <SortTH
                  label="Godišnji prinos"
                  sortKeyName="annualReturn"
                  className="text-right"
                  cy="annual-return"
                />
                <SortTH
                  label="Reward-to-variability"
                  sortKeyName="sharpe"
                  className="text-right"
                  cy="sharpe"
                />
                <SortTH
                  label="Max Drawdown"
                  sortKeyName="maxDrawdown"
                  className="text-right"
                  cy="max-drawdown"
                />
                <SortTH
                  label="Volatilnost"
                  sortKeyName="volatility"
                  className="text-right"
                  cy="volatility"
                />
                <TH>{/* actions */}</TH>
              </TR>
            </THead>
            <TBody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={10}>
                  {q.isFetching ? 'Učitavanje…' : 'Nema fondova.'}
                </EmptyRow>
              ) : (
                rows.map((f) => {
                  const profit = Number(f.profitRsd ?? '0')
                  const profitColor = profit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  const m = metrics.get(f.id)
                  const arColor =
                    m.annualReturn == null
                      ? 'text-muted-foreground'
                      : m.annualReturn >= 0
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                  return (
                    <TR
                      key={f.id}
                      data-cy={`fund-row-${f.id}`}
                      className="cursor-pointer hover:bg-accent/30"
                      onClick={() => {
                        if (f.id) goDetail(f.id)
                      }}
                    >
                      <TD className="font-medium">{f.name ?? '—'}</TD>
                      <TD className="max-w-xs truncate text-muted-foreground">
                        {f.description ?? '—'}
                      </TD>
                      <TD className="text-right tabular-nums">
                        {formatMoney(f.totalValueRsd, 'RSD')}
                      </TD>
                      <TD className={`text-right tabular-nums ${profitColor}`}>
                        {formatMoney(f.profitRsd, 'RSD')}
                      </TD>
                      <TD className="text-right tabular-nums">
                        {formatMoney(f.minimumContribution, 'RSD')}
                      </TD>
                      <TD
                        className={`text-right tabular-nums ${arColor}`}
                        data-cy="fund-annual-return"
                        title={m.insufficient ? 'Nedovoljno istorije za izračun' : undefined}
                      >
                        {fmtPct(m.annualReturn)}
                      </TD>
                      <TD className="text-right tabular-nums" data-cy="fund-sharpe">
                        {fmtRatio(m.sharpe)}
                      </TD>
                      <TD className="text-right tabular-nums" data-cy="fund-max-drawdown">
                        {fmtPct(m.maxDrawdown)}
                      </TD>
                      <TD className="text-right tabular-nums" data-cy="fund-volatility">
                        {fmtPct(m.volatility)}
                      </TD>
                      <TD>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (f.id) goDetail(f.id)
                          }}
                        >
                          Detalji
                        </Button>
                      </TD>
                    </TR>
                  )
                })
              )}
            </TBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            Statistika se računa iz istorije vrednosti fonda. Fondovi sa nedovoljno
            istorije prikazuju „—“. Reward-to-variability koristi nerizičnu stopu od 0%.
          </p>
        </CardContent>
      </Card>

      {canManage && (
        <CreateFundDialog open={createOpen} onClose={() => setCreateOpen(false)} basePath={basePath} />
      )}
    </main>
  )
}
