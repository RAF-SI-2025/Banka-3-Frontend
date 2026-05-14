import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listExchanges, setExchangeOverride, type ExchangeOverrideState } from '@/lib/api/exchanges'
import { apiError } from '@/lib/api/error'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ErrorBanner } from '@/components/ui/error'
import { currencyLabel, formatDateTime } from '@/lib/format'
import type { v1Exchange } from '@/lib/api/generated/models/v1Exchange'

export const Route = createFileRoute('/_authed/portal/berze/')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!has(perms, Permissions.Admin)) {
      throw redirect({ to: '/portal' })
    }
  },
  component: ExchangeCatalog,
})

function ExchangeCatalog() {
  const qc = useQueryClient()

  const list = useQuery({
    queryKey: keys.exchange.list(),
    queryFn: () => listExchanges(),
  })

  const override = useMutation({
    mutationFn: (args: { mic: string; state: ExchangeOverrideState | null }) =>
      setExchangeOverride(args.mic, args.state),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.exchange.all })
    },
  })

  const openAll = useMutation({
    mutationFn: async (mics: string[]) => {
      await Promise.all(mics.map((mic) => setExchangeOverride(mic, 'open')))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.exchange.all })
    },
  })

  const error =
    (override.error ? apiError(override.error, 'Greška pri menjanju statusa berze.') : null) ??
    (openAll.error ? apiError(openAll.error, 'Greška pri otvaranju svih berzi.') : null)
  const rows = list.data?.exchanges ?? []

  return (
    <main className="container space-y-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Berze</h1>
          <p className="text-sm text-muted-foreground">
            Pregled berzi i ručno forsiranje statusa rada (spec p.39).
          </p>
        </div>
        <Button
          data-cy="open-all-exchanges"
          disabled={openAll.isPending || rows.length === 0}
          onClick={() => openAll.mutate(rows.map((r) => r.mic ?? '').filter(Boolean))}
        >
          {openAll.isPending ? 'Otvaranje…' : 'Otvori sve berze'}
        </Button>
      </header>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {list.isLoading && <p className="text-muted-foreground">Učitavanje…</p>}
      {list.isError && <p className="text-danger">Greška pri učitavanju berzi.</p>}

      <Table>
        <THead>
          <TR>
            <TH>MIC</TH>
            <TH>Akronim</TH>
            <TH>Naziv</TH>
            <TH>Polity</TH>
            <TH>Valuta</TH>
            <TH>Radno vreme</TH>
            <TH>Status</TH>
            <TH>Ažurirano</TH>
            <TH className="text-right">Akcije</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={9}>{list.isFetching ? 'Učitavanje…' : 'Nema berzi.'}</EmptyRow>
          ) : (
            rows.map((e) => (
              <ExchangeRow
                key={e.mic}
                exchange={e}
                pending={override.isPending && override.variables?.mic === e.mic}
                onOverride={(state) => override.mutate({ mic: e.mic ?? '', state })}
              />
            ))
          )}
        </TBody>
      </Table>
    </main>
  )
}

function ExchangeRow({
  exchange,
  pending,
  onOverride,
}: {
  exchange: v1Exchange
  pending: boolean
  onOverride: (state: ExchangeOverrideState | null) => void
}) {
  const mic = exchange.mic ?? ''
  const current = (exchange.overrideState as ExchangeOverrideState | '' | undefined) ?? ''

  return (
    <TR>
      <TD className="font-mono text-xs" data-cy={`exchange-row-${mic}`}>
        {mic || '—'}
      </TD>
      <TD>{exchange.acronym || '—'}</TD>
      <TD>{exchange.name || '—'}</TD>
      <TD>{exchange.polity || '—'}</TD>
      <TD>{exchange.currency ? currencyLabel(exchange.currency) : '—'}</TD>
      <TD className="text-xs">
        {exchange.openLocal && exchange.closeLocal
          ? `${exchange.openLocal}–${exchange.closeLocal}${exchange.timezone ? ` (${exchange.timezone})` : ''}`
          : '—'}
      </TD>
      <TD data-cy={`exchange-status-${mic}`}>
        <ExchangeStatusBadge exchange={exchange} />
      </TD>
      <TD className="text-xs text-muted-foreground">{formatDateTime(exchange.updatedAt)}</TD>
      <TD className="text-right">
        <div className="inline-flex flex-wrap items-center justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            data-cy={`force-open-${mic}`}
            disabled={pending || current === 'open'}
            onClick={() => onOverride('open')}
          >
            Forsiraj otvoreno
          </Button>
          <Button
            size="sm"
            variant="secondary"
            data-cy={`force-closed-${mic}`}
            disabled={pending || current === 'closed'}
            onClick={() => onOverride('closed')}
          >
            Forsiraj zatvoreno
          </Button>
          <Button
            size="sm"
            variant="secondary"
            data-cy={`force-after-hours-${mic}`}
            disabled={pending || current === 'after_hours'}
            onClick={() => onOverride('after_hours')}
          >
            Forsiraj after-hours
          </Button>
          <Button
            size="sm"
            variant="ghost"
            data-cy={`clear-override-${mic}`}
            disabled={pending || current === ''}
            onClick={() => onOverride(null)}
          >
            Vrati na raspored
          </Button>
        </div>
      </TD>
    </TR>
  )
}

function ExchangeStatusBadge({ exchange }: { exchange: v1Exchange }) {
  switch (exchange.overrideState) {
    case 'open':
      return <Badge tone="yellow">Forsiran otvoren</Badge>
    case 'closed':
      return <Badge tone="yellow">Forsiran zatvoren</Badge>
    case 'after_hours':
      return <Badge tone="yellow">Forsiran after-hours</Badge>
  }
  if (exchange.isOpen) {
    return <Badge tone="green">Otvorena</Badge>
  }
  if (exchange.isAfterHours) {
    return <Badge tone="blue">After-hours</Badge>
  }
  return <Badge tone="neutral">Zatvorena</Badge>
}
