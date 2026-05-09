import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useQueries, useQuery } from '@tanstack/react-query'
import { listActuaries } from '@/lib/api/actuaries'
import { getEmployee } from '@/lib/api/employees'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'
import { v1ActuaryType } from '@/lib/api/generated/models/v1ActuaryType'
import { actuaryTypeLabel } from '@/lib/labels'
import { formatMoney } from '@/lib/format'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

const GATE = [Permissions.Admin, Permissions.ActuarySupervisor] as const

export const Route = createFileRoute('/_authed/portal/aktuari/')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!hasAny(perms, [...GATE])) {
      throw redirect({ to: '/portal' })
    }
  },
  component: ActuariesIndex,
})

function ActuariesIndex() {
  const navigate = useNavigate()

  const list = useQuery({
    queryKey: keys.actuary.list({}),
    queryFn: () => listActuaries({ pageSize: 100 }),
  })

  const rows = list.data?.actuaries ?? []

  // actuary_info has no name/email/position columns — those live in
  // user.users. Fan out to the user service per row; cached by id so
  // jumping back from /aktuari/$id is free.
  const employeeQs = useQueries({
    queries: rows.map((a) => ({
      queryKey: keys.employee.detail(a.employeeId ?? ''),
      queryFn: () => getEmployee(a.employeeId ?? ''),
      enabled: !!a.employeeId,
    })),
  })

  return (
    <main className="container space-y-6 py-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Aktuari</h1>
          <p className="text-sm text-muted-foreground">
            Pregled supervizora i agenata, dnevni limiti, status odobravanja.
          </p>
        </div>
      </header>

      {list.isLoading && <p className="text-muted-foreground">Učitavanje…</p>}
      {list.isError && <p className="text-danger">Greška pri učitavanju liste aktuara.</p>}

      <Table>
        <THead>
          <TR>
            <TH>Email</TH>
            <TH>Ime i prezime</TH>
            <TH>Pozicija</TH>
            <TH>Tip</TH>
            <TH className="text-right">Dnevni limit (RSD)</TH>
            <TH className="text-right">Iskorišćeno (RSD)</TH>
            <TH>Odobrenje</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={7}>{list.isFetching ? 'Učitavanje…' : 'Nema aktuara.'}</EmptyRow>
          ) : (
            rows.map((a, i) => {
              const id = a.employeeId ?? ''
              const emp = employeeQs[i]?.data
              const isSupervisor = a.type === v1ActuaryType.ACTUARY_TYPE_SUPERVISOR
              return (
                <TR
                  key={id}
                  onClick={() => navigate({ to: '/portal/aktuari/$employeeId', params: { employeeId: id } })}
                >
                  <TD data-cy={`actuary-row-${id}`}>{emp?.email ?? <span className="text-muted-foreground">—</span>}</TD>
                  <TD>
                    {emp ? `${emp.firstName} ${emp.lastName}` : <span className="text-muted-foreground">—</span>}
                  </TD>
                  <TD>{emp?.position ?? <span className="text-muted-foreground">—</span>}</TD>
                  <TD>
                    <Badge tone={isSupervisor ? 'blue' : 'neutral'}>
                      {a.type ? actuaryTypeLabel[a.type] : '—'}
                    </Badge>
                  </TD>
                  <TD className="text-right" data-cy="cell-daily-limit">
                    {isSupervisor ? '—' : formatMoney(a.dailyLimit)}
                  </TD>
                  <TD className="text-right" data-cy="cell-used-limit">
                    {isSupervisor ? '—' : formatMoney(a.usedLimit)}
                  </TD>
                  <TD>
                    {isSupervisor
                      ? '—'
                      : a.needApproval
                        ? <Badge tone="yellow">Zahteva odobrenje</Badge>
                        : <Badge tone="green">Auto</Badge>}
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
