import { useMemo } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { listActuaryPerformances } from '@/lib/api/profit'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'
import { v1ActuaryType } from '@/lib/api/generated/models/v1ActuaryType'
import { actuaryTypeLabel } from '@/lib/labels'
import { formatMoney } from '@/lib/format'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
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
  const navigate = useNavigate()
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
          Rang lista aktuara po ostvarenoj kapitalnoj dobiti (RSD). Kliknite na
          aktuara da vidite istoriju njegovih naloga.
        </p>
      </header>

      {list.isLoading && <p className="text-muted-foreground">Učitavanje…</p>}
      {list.isError && <p className="text-danger">Greška pri učitavanju liste aktuara.</p>}

      <Table>
        <THead>
          <TR>
            <TH>Aktuar</TH>
            <TH className="text-center">Broj realizovanih prodaja</TH>
            <TH className="text-center">Profit (RSD)</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={3}>{list.isFetching ? 'Učitavanje…' : 'Nema podataka.'}</EmptyRow>
          ) : (
            rows.map((r) => {
              const isSupervisor = r.type === v1ActuaryType.ACTUARY_TYPE_SUPERVISOR
              const uid = r.userId ?? ''
              return (
                <TR
                  key={uid}
                  data-cy={`profit-actuary-row-${uid}`}
                  onClick={
                    uid
                      ? () =>
                          navigate({
                            to: '/portal/trgovina/nalozi',
                            search: { userId: uid },
                          })
                      : undefined
                  }
                >
                  <TD>
                    <span className="inline-flex items-center gap-2">
                      <span>
                        {r.displayName || <span className="text-muted-foreground">—</span>}
                      </span>
                      <Badge tone={isSupervisor ? 'blue' : 'neutral'}>
                        {r.type ? actuaryTypeLabel[r.type] : '—'}
                      </Badge>
                    </span>
                  </TD>
                  <TD className="text-center">{r.realizedCount ?? '0'}</TD>
                  <TD className="text-center" data-cy="cell-profit-rsd">
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
