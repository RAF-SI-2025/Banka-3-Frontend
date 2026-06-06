import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { listAuditLog, type ListAuditLogArgs } from '@/lib/api/audit'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error'
import { formatDateTime } from '@/lib/format'

// Audit log is restricted to admins + supervisors (S46: clients denied).
export const Route = createFileRoute('/_authed/portal/audit-log/')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!hasAny(perms, [Permissions.Admin, Permissions.ActuarySupervisor])) {
      throw redirect({ to: '/portal' })
    }
  },
  component: AuditLogPage,
})

// Known action keys → Serbian labels. Unknown keys fall back to the raw
// key so a newly-emitted action is still readable before this map grows.
const ACTION_LABELS: Record<string, string> = {
  'employee.create': 'Kreiranje zaposlenog',
  'employee.update': 'Izmena zaposlenog',
  'permission.change': 'Promena permisija',
  'limit.change': 'Promena limita',
  'order.approve': 'Odobravanje naloga',
  'order.decline': 'Odbijanje naloga',
  'tax.run': 'Obračun poreza',
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

function AuditLogPage() {
  const [action, setAction] = useState('')
  const [actor, setActor] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  // <input type="date"> yields YYYY-MM-DD; the backend parses RFC3339,
  // so pin from→start-of-day and to→end-of-day (UTC).
  const args: ListAuditLogArgs = {
    action: action || undefined,
    actor: actor.trim() || undefined,
    from: from ? `${from}T00:00:00Z` : undefined,
    to: to ? `${to}T23:59:59Z` : undefined,
    page: 1,
    pageSize: 100,
  }

  const list = useQuery({
    queryKey: keys.audit.list(args),
    queryFn: () => listAuditLog(args),
  })

  const entries = list.data?.items ?? []

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-lg font-semibold">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Evidencija administrativnih akcija nad sistemom.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Tip akcije
          <Select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">Sve akcije</option>
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Korisnik (ime ili ID)
          <Input value={actor} onChange={(e) => setActor(e.target.value)} placeholder="npr. Petar" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Od
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Do
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        {(action || actor || from || to) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAction('')
              setActor('')
              setFrom('')
              setTo('')
            }}
          >
            Poništi filtere
          </Button>
        )}
      </div>

      {list.isError && <ErrorBanner>Greška pri učitavanju audit loga.</ErrorBanner>}

      <Table>
        <THead>
          <TR>
            <TH>Vreme</TH>
            <TH>Akcija</TH>
            <TH>Izvršio</TH>
            <TH>Cilj</TH>
            <TH>Detalji</TH>
          </TR>
        </THead>
        <TBody>
          {entries.length === 0 ? (
            <EmptyRow colSpan={5}>Nema zapisa.</EmptyRow>
          ) : (
            entries.map((e) => (
              <TR key={e.id}>
                <TD className="whitespace-nowrap">{formatDateTime(e.createdAt)}</TD>
                <TD>{actionLabel(e.action)}</TD>
                <TD>{e.actorName || e.actorId}</TD>
                <TD>{e.targetLabel || e.targetId || '—'}</TD>
                <TD>
                  {e.note && <div>{e.note}</div>}
                  {(e.oldValue || e.newValue) && (
                    <div className="text-xs text-muted-foreground">
                      {e.oldValue || '∅'} → {e.newValue || '∅'}
                    </div>
                  )}
                  {!e.note && !e.oldValue && !e.newValue && '—'}
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>
    </div>
  )
}
