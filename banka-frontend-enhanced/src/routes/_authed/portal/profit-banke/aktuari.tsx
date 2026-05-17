import { useMemo } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { listActuaryPerformances } from '@/lib/api/profit'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'
import { v1ActuaryType } from '@/lib/api/generated/models/v1ActuaryType'
import { actuaryTypeLabel } from '@/lib/labels'
import { formatMoney } from '@/lib/format'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { SkeletonTable } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

const GATE = [Permissions.Admin, Permissions.BankProfitRead] as const

export const Route = createFileRoute('/_authed/portal/profit-banke/aktuari')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!hasAny(perms, [...GATE])) {
      throw redirect({ to: '/portal' })
    }
  },
  component: ProfitActuariesPage,
})

function ProfitActuariesPage() {
  const list = useQuery({
    queryKey: keys.profit.actuaries({}),
    queryFn: () => listActuaryPerformances({}),
  })

  const rows = useMemo(() => {
    const r = list.data?.rows ?? []
    return [...r].sort((a, b) => Number(b.profitRsd ?? 0) - Number(a.profitRsd ?? 0))
  }, [list.data])

  return (
    <main className="container space-y-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold">Profit banke — aktuari</h1>
        <p className="text-sm text-muted-foreground">
          Rang lista aktuara po ostvarenoj kapitalnoj dobiti (RSD).
        </p>
      </header>

      {list.isLoading && <SkeletonTable rows={5} cols={4} />}
      {list.isError && <p className="text-danger">Greška pri učitavanju liste aktuara.</p>}

      <Table>
        <THead>
          <TR>
            <TH>Ime i prezime</TH>
            <TH>Tip</TH>
            <TH className="text-right">Broj realizovanih prodaja</TH>
            <TH className="text-right">Profit (RSD)</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={4}>{list.isFetching ? 'Učitavanje…' : 'Nema podataka.'}</EmptyRow>
          ) : (
            rows.map((r) => {
              const isSupervisor = r.type === v1ActuaryType.ACTUARY_TYPE_SUPERVISOR
              return (
                <TR key={r.userId ?? ''} data-cy={`profit-actuary-row-${r.userId ?? ''}`}>
                  <TD>{r.displayName || <span className="text-muted-foreground">—</span>}</TD>
                  <TD>
                    <Badge tone={isSupervisor ? 'blue' : 'neutral'}>
                      {r.type ? actuaryTypeLabel[r.type] : '—'}
                    </Badge>
                  </TD>
                  <TD className="text-right">{r.realizedCount ?? '0'}</TD>
                  <TD className="text-right" data-cy="cell-profit-rsd">
                    {formatMoney(r.profitRsd ?? '0', 'RSD')}
                  </TD>
                </TR>
              )
            })
          )}
        </TBody>
      </Table>
    </main>
  )
}
