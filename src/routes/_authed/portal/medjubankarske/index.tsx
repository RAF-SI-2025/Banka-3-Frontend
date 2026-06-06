import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  listInterbankTransactions,
  type ListInterbankTransactionsArgs,
  type InterbankTxStatus,
  type InterbankDirection,
} from '@/lib/api/interbank'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error'
import { formatDateTime, formatMoney } from '@/lib/format'

// Supervisor/admin only — inter-bank observability surface (celina 5).
export const Route = createFileRoute('/_authed/portal/medjubankarske/')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!hasAny(perms, [Permissions.Admin, Permissions.ActuarySupervisor])) {
      throw redirect({ to: '/portal' })
    }
  },
  component: InterbankTransactionsPage,
})

const STATUS_LABELS: Record<string, string> = {
  pending: 'Na čekanju',
  failed: 'Neuspela',
  prepared: 'Pripremljena',
  committed: 'Izvršena',
  rolled_back: 'Poništena',
}

const DIRECTION_LABELS: Record<string, string> = {
  inbound: 'Dolazna',
  outbound: 'Odlazna',
}

function statusLabel(s?: string): string {
  return (s && STATUS_LABELS[s]) || s || '—'
}

function directionLabel(d?: string): string {
  return (d && DIRECTION_LABELS[d]) || d || '—'
}

// Tailwind class per status so the operator can scan the flow at a glance.
function statusClass(s?: string): string {
  switch (s) {
    case 'committed':
      return 'text-emerald-600'
    case 'failed':
    case 'rolled_back':
      return 'text-red-600'
    case 'prepared':
      return 'text-amber-600'
    default:
      return 'text-muted-foreground'
  }
}

function InterbankTransactionsPage() {
  const [routing, setRouting] = useState('')
  const [status, setStatus] = useState('')
  const [direction, setDirection] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const args: ListInterbankTransactionsArgs = {
    senderRoutingNumber: routing ? Number(routing) : undefined,
    status: (status || undefined) as InterbankTxStatus | undefined,
    direction: (direction || undefined) as InterbankDirection | undefined,
    from: from ? `${from}T00:00:00Z` : undefined,
    to: to ? `${to}T23:59:59Z` : undefined,
    page: 1,
    pageSize: 100,
  }

  const list = useQuery({
    queryKey: keys.interbank.transactions(args),
    queryFn: () => listInterbankTransactions(args),
    // Poll-based real-time status tracking (no streaming) — refresh while
    // the operator watches in-flight transactions settle.
    refetchInterval: 5000,
  })

  const rows = list.data?.transactions ?? []
  const hasFilters = routing || status || direction || from || to

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-lg font-semibold">Međubankarske transakcije</h1>
        <p className="text-sm text-muted-foreground">
          Status i tok cross-bank 2PC transakcija. Lista se osvežava automatski.
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
          Status
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Svi statusi</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Smer
          <Select value={direction} onChange={(e) => setDirection(e.target.value)}>
            <option value="">Svi smerovi</option>
            {Object.entries(DIRECTION_LABELS).map(([key, label]) => (
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
              setStatus('')
              setDirection('')
              setFrom('')
              setTo('')
            }}
          >
            Poništi filtere
          </Button>
        )}
      </div>

      {list.isError && <ErrorBanner>Greška pri učitavanju transakcija.</ErrorBanner>}

      <Table>
        <THead>
          <TR>
            <TH>Vreme</TH>
            <TH>Banka (rutni)</TH>
            <TH>Smer</TH>
            <TH>ID transakcije</TH>
            <TH>Iznos</TH>
            <TH>Status</TH>
            <TH>Greška</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={7}>Nema transakcija.</EmptyRow>
          ) : (
            rows.map((t) => (
              <TR key={`${t.senderRoutingNumber}:${t.transactionId}`}>
                <TD className="whitespace-nowrap">{formatDateTime(t.createdAt)}</TD>
                <TD>{t.senderRoutingNumber}</TD>
                <TD>{directionLabel(t.direction)}</TD>
                <TD className="font-mono text-xs">{t.transactionId}</TD>
                <TD className="whitespace-nowrap">{formatMoney(t.amount, t.currency)}</TD>
                <TD className={statusClass(t.status)}>{statusLabel(t.status)}</TD>
                <TD className="text-xs text-muted-foreground">{t.lastError || '—'}</TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>
    </div>
  )
}
