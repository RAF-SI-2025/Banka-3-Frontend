import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { listExternalOTCThreads } from '@/lib/api/external-otc'
import { keys } from '@/lib/query-keys'
import { formatDate, formatMoney } from '@/lib/format'
import { v1ExternalOTCThreadStatus } from '@/lib/api/generated/models/v1ExternalOTCThreadStatus'
import { v1ExternalOTCSide } from '@/lib/api/generated/models/v1ExternalOTCSide'
import { v1ExternalOTCDirection } from '@/lib/api/generated/models/v1ExternalOTCDirection'
import { ExternalOTCThreadModal } from './ExternalOTCThreadModal'

// Cross-bank counterpart of OTCThreadsPage. Unread = thread is open
// and the partner moved last (modifiedBySide=REMOTE).
export function ExternalOTCThreadsPage() {
  const [open, setOpen] = useState<string | null>(null)

  const threads = useQuery({
    queryKey: keys.externalOtc.threads({}),
    queryFn: () => listExternalOTCThreads({}),
    refetchInterval: 15_000,
  })

  const rows = threads.data?.threads ?? []
  const unread = rows.filter(
    (t) =>
      t.status === v1ExternalOTCThreadStatus.EXTERNAL_OTC_THREAD_STATUS_OPEN &&
      t.modifiedBySide === v1ExternalOTCSide.EXTERNAL_OTC_SIDE_REMOTE,
  ).length

  return (
    <main className="container space-y-6 py-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Aktivne eksterne ponude</h1>
          <p className="text-sm text-muted-foreground">
            Cross-bank pregovaranja u kojima učestvujete.
          </p>
        </div>
        {unread > 0 && (
          <Badge tone="yellow" data-cy="ext-otc-unread-count">
            {unread} nepročitano
          </Badge>
        )}
      </header>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <THead>
              <TR>
                <TH>Banka</TH>
                <TH>Ticker</TH>
                <TH>Smer</TH>
                <TH className="text-right">Količina</TH>
                <TH className="text-right">Cena</TH>
                <TH className="text-right">Premija</TH>
                <TH>Izvršenje</TH>
                <TH>Na potezu</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={9}>
                  {threads.isFetching ? 'Učitavanje…' : 'Nema aktivnih eksternih ponuda.'}
                </EmptyRow>
              ) : (
                rows.map((t) => {
                  const isUnread =
                    t.status === v1ExternalOTCThreadStatus.EXTERNAL_OTC_THREAD_STATUS_OPEN &&
                    t.modifiedBySide === v1ExternalOTCSide.EXTERNAL_OTC_SIDE_REMOTE
                  return (
                    <TR
                      key={t.id}
                      data-cy={`ext-otc-thread-${t.id}`}
                      onClick={() => t.id && setOpen(t.id)}
                    >
                      <TD className="font-mono">{t.remoteBankCode ?? '—'}</TD>
                      <TD className="font-mono">
                        {t.securityTicker ?? '—'}
                        {isUnread && (
                          <Badge tone="yellow" className="ml-2">
                            novo
                          </Badge>
                        )}
                      </TD>
                      <TD>{directionLabel(t.direction)}</TD>
                      <TD className="text-right">{t.quantity ?? 0}</TD>
                      <TD className="text-right">{formatMoney(t.pricePerUnit, t.currency)}</TD>
                      <TD className="text-right">{formatMoney(t.premium, t.currency)}</TD>
                      <TD>{formatDate(t.settlementDate)}</TD>
                      <TD>{sideLabel(t.modifiedBySide)}</TD>
                      <TD>{statusLabel(t.status)}</TD>
                    </TR>
                  )
                })
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <ExternalOTCThreadModal threadId={open} onClose={() => setOpen(null)} />
    </main>
  )
}

function statusLabel(s: v1ExternalOTCThreadStatus | undefined): string {
  switch (s) {
    case v1ExternalOTCThreadStatus.EXTERNAL_OTC_THREAD_STATUS_OPEN: return 'otvorena'
    case v1ExternalOTCThreadStatus.EXTERNAL_OTC_THREAD_STATUS_SUPERSEDED: return 'zamenjena'
    case v1ExternalOTCThreadStatus.EXTERNAL_OTC_THREAD_STATUS_ACCEPTED: return 'prihvaćena'
    case v1ExternalOTCThreadStatus.EXTERNAL_OTC_THREAD_STATUS_WITHDRAWN: return 'povučena'
    case v1ExternalOTCThreadStatus.EXTERNAL_OTC_THREAD_STATUS_EXPIRED: return 'istekla'
    case v1ExternalOTCThreadStatus.EXTERNAL_OTC_THREAD_STATUS_REJECTED: return 'odbijena'
    default: return '—'
  }
}

function sideLabel(s: v1ExternalOTCSide | undefined): string {
  switch (s) {
    case v1ExternalOTCSide.EXTERNAL_OTC_SIDE_LOCAL: return 'mi'
    case v1ExternalOTCSide.EXTERNAL_OTC_SIDE_REMOTE: return 'partner'
    default: return '—'
  }
}

function directionLabel(d: v1ExternalOTCDirection | undefined): string {
  switch (d) {
    case v1ExternalOTCDirection.EXTERNAL_OTC_DIRECTION_OUTGOING: return 'mi → partner'
    case v1ExternalOTCDirection.EXTERNAL_OTC_DIRECTION_INCOMING: return 'partner → mi'
    default: return '—'
  }
}
