import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  listInterbankAuditLog,
  type ListInterbankAuditLogArgs,
  type InterbankMessageType,
} from '@/lib/api/interbank'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error'
import { formatDateTime } from '@/lib/format'

// Comms / audit history of inbound partner messages (celina 5).
export const Route = createFileRoute('/_authed/portal/medjubankarske/komunikacija')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!hasAny(perms, [Permissions.Admin, Permissions.ActuarySupervisor])) {
      throw redirect({ to: '/portal' })
    }
  },
  component: InterbankCommsPage,
})

const MSG_TYPE_LABELS: Record<string, string> = {
  NEW_TX: 'Nova transakcija',
  COMMIT_TX: 'Potvrda (commit)',
  ROLLBACK_TX: 'Poništenje (rollback)',
}

function msgTypeLabel(t?: string): string {
  return (t && MSG_TYPE_LABELS[t]) || t || '—'
}

function statusClass(code?: number): string {
  if (code === undefined) return 'text-muted-foreground'
  return code >= 200 && code < 300 ? 'text-emerald-600' : 'text-red-600'
}

function InterbankCommsPage() {
  const [routing, setRouting] = useState('')
  const [messageType, setMessageType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const args: ListInterbankAuditLogArgs = {
    senderRoutingNumber: routing ? Number(routing) : undefined,
    messageType: (messageType || undefined) as InterbankMessageType | undefined,
    from: from ? `${from}T00:00:00Z` : undefined,
    to: to ? `${to}T23:59:59Z` : undefined,
    page: 1,
    pageSize: 100,
  }

  const list = useQuery({
    queryKey: keys.interbank.auditLog(args),
    queryFn: () => listInterbankAuditLog(args),
  })

  const rows = list.data?.messages ?? []
  const hasFilters = routing || messageType || from || to

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-lg font-semibold">Međubankarska komunikacija</h1>
        <p className="text-sm text-muted-foreground">
          Evidencija primljenih poruka partnerskih banaka i odgovora koje smo vratili.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Rutni broj banke
          <Input
            value={routing}
            onChange={(e) => setRouting(e.target.value.replace(/\D/g, ''))}
            placeholder="npr. 444"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Tip poruke
          <Select value={messageType} onChange={(e) => setMessageType(e.target.value)}>
            <option value="">Svi tipovi</option>
            {Object.entries(MSG_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Od
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Do
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRouting('')
              setMessageType('')
              setFrom('')
              setTo('')
            }}
          >
            Poništi filtere
          </Button>
        )}
      </div>

      {list.isError && <ErrorBanner>Greška pri učitavanju komunikacije.</ErrorBanner>}

      <Table>
        <THead>
          <TR>
            <TH>Vreme</TH>
            <TH>Banka (rutni)</TH>
            <TH>Tip poruke</TH>
            <TH>ID transakcije</TH>
            <TH>Idempotentni ključ</TH>
            <TH>Odgovor</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={6}>Nema zapisa.</EmptyRow>
          ) : (
            rows.map((m) => (
              <TR key={`${m.senderRoutingNumber}:${m.idempotenceKey}`}>
                <TD className="whitespace-nowrap">{formatDateTime(m.createdAt)}</TD>
                <TD>{m.senderRoutingNumber}</TD>
                <TD>{msgTypeLabel(m.messageType)}</TD>
                <TD className="font-mono text-xs">{m.transactionId || '—'}</TD>
                <TD className="font-mono text-xs">{m.idempotenceKey}</TD>
                <TD className={statusClass(m.responseStatus)}>{m.responseStatus ?? '—'}</TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>
    </div>
  )
}
