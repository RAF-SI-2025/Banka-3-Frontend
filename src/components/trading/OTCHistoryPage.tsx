import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { listOTCThreads } from '@/lib/api/otc'
import { keys } from '@/lib/query-keys'
import { formatDate, formatDateTime, formatMoney } from '@/lib/format'
import { useAuthStore } from '@/lib/auth/store'
import { v1OTCStatus } from '@/lib/api/generated/models/v1OTCStatus'
import type { v1OTCOffer } from '@/lib/api/generated/models/v1OTCOffer'
import { OTCThreadModal } from './OTCThreadModal'

// todoSpec S64–S68 "Istorija pregovora". Lists every negotiation that
// has reached a terminal state (accepted / withdrawn / expired) — i.e.
// threads that are no longer active. Clicking a row reuses
// OTCThreadModal, which renders the full counter-offer history with
// old & new values, timestamps and who made each change (S65).
//
// All three filters run client-side over the list the backend already
// returns (the list endpoint exposes the latest iteration per thread):
//   - status (S66): one of the terminal statuses, or "all terminal"
//   - date range (S67): updated_at of the latest iteration within bounds
//   - counterparty (S68): substring match against the other party's id

// Terminal statuses — a thread in any of these is "completed".
// OPEN is still active; SUPERSEDED only marks a single superseded
// iteration, never the latest one returned by the list endpoint.
const TERMINAL: v1OTCStatus[] = [
  v1OTCStatus.OTC_STATUS_ACCEPTED,
  v1OTCStatus.OTC_STATUS_WITHDRAWN,
  v1OTCStatus.OTC_STATUS_CANCELLED,
  v1OTCStatus.OTC_STATUS_REJECTED,
  v1OTCStatus.OTC_STATUS_EXPIRED,
]

type StatusFilter = 'all' | v1OTCStatus

export function OTCHistoryPage() {
  const userId = useAuthStore((s) => s.userId) ?? ''
  const [open, setOpen] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [party, setParty] = useState('')

  const threads = useQuery({
    queryKey: keys.otc.threads({}),
    queryFn: () => listOTCThreads({}),
    refetchInterval: 30_000,
  })

  const all = useMemo(() => threads.data?.threads ?? [], [threads.data])

  const rows = useMemo(() => {
    // S64: only completed (terminal) negotiations.
    let r = all.filter((t) => t.status && TERMINAL.includes(t.status))

    // S66: status filter.
    if (status !== 'all') {
      r = r.filter((t) => t.status === status)
    }

    // S67: date range filter against the thread's last activity.
    if (from) {
      const lo = new Date(`${from}T00:00:00`)
      r = r.filter((t) => {
        const d = new Date(t.updatedAt ?? '')
        return !Number.isNaN(d.getTime()) && d >= lo
      })
    }
    if (to) {
      const hi = new Date(`${to}T23:59:59.999`)
      r = r.filter((t) => {
        const d = new Date(t.updatedAt ?? '')
        return !Number.isNaN(d.getTime()) && d <= hi
      })
    }

    // S68: counterparty substring (the other party's identifier).
    if (party.trim()) {
      const q = party.trim().toLowerCase()
      r = r.filter((t) => counterpartyId(t, userId).toLowerCase().includes(q))
    }

    return r
  }, [all, status, from, to, party, userId])

  const reset = () => {
    setStatus('all')
    setFrom('')
    setTo('')
    setParty('')
  }

  return (
    <main className="container space-y-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold">Istorija pregovora</h1>
        <p className="text-sm text-muted-foreground">
          Završena pregovaranja (prihvaćena, povučena ili istekla) u kojima ste učestvovali.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Filteri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="otc-hist-status">Status</Label>
              <Select
                id="otc-hist-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusFilter)}
                data-cy="otc-hist-status"
              >
                <option value="all">Svi</option>
                <option value={v1OTCStatus.OTC_STATUS_ACCEPTED}>Prihvaćen</option>
                <option value={v1OTCStatus.OTC_STATUS_WITHDRAWN}>Povučen</option>
                <option value={v1OTCStatus.OTC_STATUS_CANCELLED}>Otkazan</option>
                <option value={v1OTCStatus.OTC_STATUS_REJECTED}>Odbijen</option>
                <option value={v1OTCStatus.OTC_STATUS_EXPIRED}>Istekao</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="otc-hist-from">Od datuma</Label>
              <Input
                id="otc-hist-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                data-cy="otc-hist-from"
              />
            </div>
            <div>
              <Label htmlFor="otc-hist-to">Do datuma</Label>
              <Input
                id="otc-hist-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                data-cy="otc-hist-to"
              />
            </div>
            <div>
              <Label htmlFor="otc-hist-party">Druga strana</Label>
              <Input
                id="otc-hist-party"
                type="text"
                placeholder="ime ili identifikator"
                value={party}
                onChange={(e) => setParty(e.target.value)}
                data-cy="otc-hist-party"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="button" variant="ghost" onClick={reset} data-cy="otc-hist-reset">
              Poništi filtere
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <THead>
              <TR>
                <TH>Ticker</TH>
                <TH className="text-right">Količina</TH>
                <TH className="text-right">Cena</TH>
                <TH className="text-right">Premium</TH>
                <TH>Datum izvršenja</TH>
                <TH>Završeno</TH>
                <TH>Druga strana</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={8}>
                  {threads.isFetching ? 'Učitavanje…' : 'Nema završenih pregovora.'}
                </EmptyRow>
              ) : (
                rows.map((t) => (
                  <TR
                    key={t.id}
                    data-cy={`otc-hist-thread-${t.threadId}`}
                    onClick={() => t.threadId && setOpen(t.threadId)}
                  >
                    <TD className="font-mono">{t.securityTicker ?? '—'}</TD>
                    <TD className="text-right">{t.quantity ?? 0}</TD>
                    <TD className="text-right">{formatMoney(t.pricePerUnit, t.currency)}</TD>
                    <TD className="text-right">{formatMoney(t.premium, t.currency)}</TD>
                    <TD>{formatDate(t.settlementDate)}</TD>
                    <TD>{formatDateTime(t.updatedAt)}</TD>
                    <TD className="font-mono text-xs">{counterpartyId(t, userId).slice(0, 8) || '—'}</TD>
                    <TD>{statusLabel(t.status)}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <OTCThreadModal threadId={open} onClose={() => setOpen(null)} />
    </main>
  )
}

// The "other party" on a thread: whichever of buyer/seller isn't the
// current user. Falls back to the modifier when neither id matches
// (e.g. an admin/supervisor viewing on behalf of the bank).
function counterpartyId(t: v1OTCOffer, userId: string): string {
  if (t.buyerId && t.buyerId !== userId) return t.buyerId
  if (t.sellerId && t.sellerId !== userId) return t.sellerId
  return t.modifiedBy ?? ''
}

function statusLabel(s: v1OTCStatus | undefined): string {
  switch (s) {
    case v1OTCStatus.OTC_STATUS_OPEN: return 'otvorena'
    case v1OTCStatus.OTC_STATUS_SUPERSEDED: return 'zamenjena'
    case v1OTCStatus.OTC_STATUS_ACCEPTED: return 'prihvaćena'
    case v1OTCStatus.OTC_STATUS_WITHDRAWN: return 'povučena'
    case v1OTCStatus.OTC_STATUS_CANCELLED: return 'otkazana'
    case v1OTCStatus.OTC_STATUS_REJECTED: return 'odbijena'
    case v1OTCStatus.OTC_STATUS_EXPIRED: return 'istekla'
    default: return '—'
  }
}
