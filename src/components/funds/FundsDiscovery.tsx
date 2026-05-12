import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { listFunds, type ListFundsArgs } from '@/lib/api/funds'
import { keys } from '@/lib/query-keys'
import { formatMoney } from '@/lib/format'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { CreateFundDialog } from './CreateFundDialog'

interface Props {
  basePath: '/portal/fondovi' | '/banking/fondovi'
}

// Spec p.71 "Investicioni fondovi — pregled". Supervisors (with
// funds.manage.supervisor) see the "Kreiraj fond" button; everyone
// else is read-only. Click row → detail.
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
  const [sort, setSort] = useState<NonNullable<ListFundsArgs['sort']>>('name')
  const [order, setOrder] = useState<NonNullable<ListFundsArgs['order']>>('asc')
  const [minAtLeast, setMinAtLeast] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const args = useMemo<ListFundsArgs>(
    () => ({
      status: 'active',
      sort,
      order,
      minContributionAtLeast: minAtLeast.trim() || undefined,
    }),
    [sort, order, minAtLeast],
  )

  const q = useQuery({
    queryKey: keys.funds.list(args),
    queryFn: () => listFunds(args),
    refetchInterval: 30_000,
  })

  const rows = q.data?.funds ?? []

  return (
    <main className="container space-y-6 py-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Investicioni fondovi</h1>
          <p className="text-sm text-muted-foreground">
            Aktivni fondovi banke. Kliknite na red za detalje, ulaganje ili povlačenje.
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
              <Label htmlFor="funds-sort">Sortiraj po</Label>
              <Select
                id="funds-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as NonNullable<ListFundsArgs['sort']>)}
                data-cy="funds-sort"
              >
                <option value="name">Naziv</option>
                <option value="total_value">Ukupna vrednost</option>
                <option value="profit">Profit</option>
                <option value="minimum_contribution">Min. uplata</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="funds-order">Smer</Label>
              <Select
                id="funds-order"
                value={order}
                onChange={(e) => setOrder(e.target.value as NonNullable<ListFundsArgs['order']>)}
                data-cy="funds-order"
              >
                <option value="asc">Rastuće</option>
                <option value="desc">Opadajuće</option>
              </Select>
            </div>
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
                <TH>Naziv</TH>
                <TH>Opis</TH>
                <TH className="text-right">Ukupna vrednost</TH>
                <TH className="text-right">Profit</TH>
                <TH className="text-right">Min. uplata</TH>
                <TH>{/* actions */}</TH>
              </TR>
            </THead>
            <TBody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={6}>
                  {q.isFetching ? 'Učitavanje…' : 'Nema fondova.'}
                </EmptyRow>
              ) : (
                rows.map((f) => {
                  const profit = Number(f.profitRsd ?? '0')
                  const profitColor = profit >= 0 ? 'text-emerald-600' : 'text-rose-600'
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
                      <TD className="max-w-md truncate text-muted-foreground">{f.description ?? '—'}</TD>
                      <TD className="text-right tabular-nums">{formatMoney(f.totalValueRsd, 'RSD')}</TD>
                      <TD className={`text-right tabular-nums ${profitColor}`}>
                        {formatMoney(f.profitRsd, 'RSD')}
                      </TD>
                      <TD className="text-right tabular-nums">{formatMoney(f.minimumContribution, 'RSD')}</TD>
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
        </CardContent>
      </Card>

      {canManage && (
        <CreateFundDialog open={createOpen} onClose={() => setCreateOpen(false)} basePath={basePath} />
      )}
    </main>
  )
}
