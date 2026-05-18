import { useMemo, useState } from 'react'
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
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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

  // QA S1: the actuary-management page had no filters. Type comes off
  // actuary_info; name/email come from the per-row employee fan-out,
  // so both filters run client-side over the paired rows.
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [q, setQ] = useState('')
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows
      .map((a, i) => ({ a, emp: employeeQs[i]?.data }))
      .filter(({ a, emp }) => {
        if (typeFilter && a.type !== typeFilter) return false
        if (needle) {
          const hay = `${emp?.firstName ?? ''} ${emp?.lastName ?? ''} ${emp?.email ?? ''}`.toLowerCase()
          if (!hay.includes(needle)) return false
        }
        return true
      })
  }, [rows, employeeQs, typeFilter, q])

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

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Label>Pretraga (ime, prezime, email)</Label>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="npr. Petar ili petar@banka.local"
            data-cy="actuary-filter-search"
          />
        </div>
        <div>
          <Label>Tip</Label>
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            data-cy="actuary-filter-type"
          >
            <option value="">Svi</option>
            <option value={v1ActuaryType.ACTUARY_TYPE_AGENT}>
              {actuaryTypeLabel[v1ActuaryType.ACTUARY_TYPE_AGENT]}
            </option>
            <option value={v1ActuaryType.ACTUARY_TYPE_SUPERVISOR}>
              {actuaryTypeLabel[v1ActuaryType.ACTUARY_TYPE_SUPERVISOR]}
            </option>
          </Select>
        </div>
      </div>

      {list.isLoading && <p className="text-muted-foreground">Učitavanje…</p>}
      {list.isError && <p className="text-danger">Greška pri učitavanju liste aktuara.</p>}

      <Table>
        <THead>
          <TR>
            <TH>Ime i prezime</TH>
            <TH>Email</TH>
            <TH>Tip</TH>
            <TH className="text-right">Dnevni limit (RSD)</TH>
            <TH className="text-right">Iskorišćeno (RSD)</TH>
            <TH>Odobrenje</TH>
          </TR>
        </THead>
        <TBody>
          {visible.length === 0 ? (
            <EmptyRow colSpan={6}>{list.isFetching ? 'Učitavanje…' : 'Nema aktuara.'}</EmptyRow>
          ) : (
            visible.map(({ a, emp }) => {
              const id = a.employeeId ?? ''
              const isSupervisor = a.type === v1ActuaryType.ACTUARY_TYPE_SUPERVISOR
              return (
                <TR
                  key={id}
                  onClick={() => navigate({ to: '/portal/aktuari/$employeeId', params: { employeeId: id } })}
                >
                  <TD data-cy={`actuary-row-${id}`}>
                    {emp ? `${emp.firstName} ${emp.lastName}` : <span className="text-muted-foreground">—</span>}
                  </TD>
                  <TD>{emp?.email ?? <span className="text-muted-foreground">—</span>}</TD>
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
