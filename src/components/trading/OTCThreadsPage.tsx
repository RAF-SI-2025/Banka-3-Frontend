import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { listOTCThreads } from '@/lib/api/otc'
import { keys } from '@/lib/query-keys'
import { formatDate, formatMoney } from '@/lib/format'
import { useAuthStore } from '@/lib/auth/store'
import { v1OTCStatus } from '@/lib/api/generated/models/v1OTCStatus'
import { OTCThreadModal } from './OTCThreadModal'

// Spec p.69 "Aktivne ponude" — every thread the caller participates
// in. Unread badge: status open + last modifier wasn't me. Clicking
// a row opens the iteration-history modal.
export function OTCThreadsPage() {
  const userId = useAuthStore((s) => s.userId) ?? ''
  const [open, setOpen] = useState<string | null>(null)

  const threads = useQuery({
    queryKey: keys.otc.threads({}),
    queryFn: () => listOTCThreads({}),
    refetchInterval: 15_000,
  })

  const rows = threads.data?.threads ?? []
  const unread = rows.filter(
    (t) => t.status === v1OTCStatus.OTC_STATUS_OPEN && t.modifiedBy && t.modifiedBy !== userId,
  ).length

  return (
    <main className="container space-y-6 py-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Aktivne ponude</h1>
          <p className="text-sm text-muted-foreground">Vansistemska pregovaranja u kojima učestvujete.</p>
        </div>
        {unread > 0 && <Badge tone="yellow" data-cy="otc-unread-count">{unread} nepročitano</Badge>}
      </header>

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
                <TH>Poslednje uredio</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={7}>{threads.isFetching ? 'Učitavanje…' : 'Nema aktivnih ponuda.'}</EmptyRow>
              ) : (
                rows.map((t) => {
                  const mine = t.modifiedBy === userId
                  const isUnread = t.status === v1OTCStatus.OTC_STATUS_OPEN && !mine
                  return (
                    <TR
                      key={t.id}
                      data-cy={`otc-thread-${t.threadId}`}
                      onClick={() => t.threadId && setOpen(t.threadId)}
                    >
                      <TD className="font-mono">
                        {t.securityTicker ?? '—'}
                        {isUnread && <Badge tone="yellow" className="ml-2">novo</Badge>}
                      </TD>
                      <TD className="text-right">{t.quantity ?? 0}</TD>
                      <TD className="text-right">{formatMoney(t.pricePerUnit, t.currency)}</TD>
                      <TD className="text-right">{formatMoney(t.premium, t.currency)}</TD>
                      <TD>{formatDate(t.settlementDate)}</TD>
                      <TD>{mine ? 'ja' : 'druga strana'}</TD>
                      <TD>{statusLabel(t.status)}</TD>
                    </TR>
                  )
                })
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <OTCThreadModal threadId={open} onClose={() => setOpen(null)} />
    </main>
  )
}

function statusLabel(s: v1OTCStatus | undefined): string {
  switch (s) {
    case v1OTCStatus.OTC_STATUS_OPEN: return 'otvorena'
    case v1OTCStatus.OTC_STATUS_SUPERSEDED: return 'zamenjena'
    case v1OTCStatus.OTC_STATUS_ACCEPTED: return 'prihvaćena'
    case v1OTCStatus.OTC_STATUS_WITHDRAWN: return 'povučena'
    case v1OTCStatus.OTC_STATUS_EXPIRED: return 'istekla'
    default: return '—'
  }
}
