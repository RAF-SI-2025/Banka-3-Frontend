import { useState } from 'react'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listRealizedPnL, listTaxPositions, runTaxJob, type RealizedPnLRow } from '@/lib/api/tax'
import { apiError } from '@/lib/api/error'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'
import { bankaTradingV1UserKind } from '@/lib/api/generated/models/bankaTradingV1UserKind'
import { formatDateTime, formatMoney, currencyLabel } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { ErrorBanner } from '@/components/ui/error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

const GATE = [Permissions.Admin, Permissions.ActuarySupervisor] as const

type Search = { kind?: bankaTradingV1UserKind }

export const Route = createFileRoute('/_authed/portal/porez/$userId')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!hasAny(perms, [...GATE])) {
      throw redirect({ to: '/portal' })
    }
  },
  validateSearch: (s: Record<string, unknown>): Search => {
    const k = typeof s.kind === 'string' ? s.kind : ''
    const allowed: bankaTradingV1UserKind[] = [
      bankaTradingV1UserKind.USER_KIND_CLIENT,
      bankaTradingV1UserKind.USER_KIND_EMPLOYEE,
    ]
    return {
      kind: allowed.includes(k as bankaTradingV1UserKind)
        ? (k as bankaTradingV1UserKind)
        : undefined,
    }
  },
  component: TaxDetail,
})

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function isoMinusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function TaxDetail() {
  const { userId } = Route.useParams()
  const { kind } = Route.useSearch()
  const qc = useQueryClient()

  const [confirmRun, setConfirmRun] = useState(false)
  const [lastResult, setLastResult] = useState<{ users: number; total: string } | null>(null)

  // Scoped tax run: passes {userId, userKind} so the backend's RunTax
  // limits the candidate set to this one user (tax.go:195). Lets a
  // supervisor settle one user's debt without sweeping every other
  // unpaid position on the board.
  const run = useMutation({
    mutationFn: () =>
      runTaxJob({
        userId,
        ...(kind ? { userKind: kind } : {}),
      }),
    onSuccess: (res) => {
      setLastResult({
        users: Number(res.usersTaxed ?? 0),
        total: String(res.totalCollectedRsd ?? '0'),
      })
      setConfirmRun(false)
      qc.invalidateQueries({ queryKey: keys.tax.all })
    },
  })

  // Default range: last 365 days. Spec p.62 capital-gains rolls over by
  // calendar year, but supervisors will want to see history beyond the
  // YTD window when investigating, so a year window is the more useful
  // default.
  const [from, setFrom] = useState(isoMinusDays(365))
  const [to, setTo] = useState(todayIso())

  // Standings come from the same listTaxPositions endpoint as the
  // board: filter by kind (cheap server-side narrow) and pick out the
  // matching userId. Saves adding a second RPC for one row.
  const standingsArgs = { userKind: kind }
  const standings = useQuery({
    queryKey: keys.tax.board(standingsArgs),
    queryFn: () => listTaxPositions(standingsArgs),
    enabled: !!kind,
  })
  const me = standings.data?.positions?.find((p) => p.userId === userId)

  // Convert YYYY-MM-DD picker values to RFC3339 timestamps that the
  // backend's tax/realized handler expects. `from` is start-of-day,
  // `to` is end-of-day so the picker's inclusive feel matches the
  // SQL.
  const realizedArgs = {
    userId,
    userKind: kind,
    from: from ? `${from}T00:00:00Z` : undefined,
    to: to ? `${to}T23:59:59Z` : undefined,
  }
  const realized = useQuery({
    queryKey: keys.tax.realized(realizedArgs),
    queryFn: () => listRealizedPnL(realizedArgs),
    enabled: !!kind,
  })

  const rows: RealizedPnLRow[] = realized.data?.rows ?? []
  const runError = apiError(run.error, '') || null

  return (
    <main className="container space-y-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {me?.displayName || 'Korisnik'}
        </h1>
        <div className="flex items-center gap-3">
          <Button
            data-cy="run-tax-user"
            onClick={() => setConfirmRun(true)}
            disabled={run.isPending}
          >
            {run.isPending ? 'Obračun…' : 'Pokreni obračun za korisnika'}
          </Button>
          <Link to="/portal/porez" className="text-primary hover:underline">
            ← Nazad na listu
          </Link>
        </div>
      </div>

      {runError && <ErrorBanner>{runError}</ErrorBanner>}

      {lastResult && (
        <div
          data-cy="run-tax-user-result"
          className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-900"
        >
          Obračun završen: {lastResult.users} korisnika, ukupno {formatMoney(lastResult.total)} RSD.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Stanja</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-3">
          <div>
            <Label>Tip korisnika</Label>
            <p className="text-base">
              {kind === bankaTradingV1UserKind.USER_KIND_CLIENT
                ? 'Klijent'
                : kind === bankaTradingV1UserKind.USER_KIND_EMPLOYEE
                  ? 'Zaposleni'
                  : '—'}
            </p>
          </div>
          <div>
            <Label>Neuplaćeno (RSD)</Label>
            <p className="text-base font-medium" data-cy="standings-unpaid">
              {formatMoney(me?.unpaidTaxRsd)}
            </p>
          </div>
          <div>
            <Label>Plaćeno YTD (RSD)</Label>
            <p className="text-base font-medium" data-cy="standings-paid-ytd">
              {formatMoney(me?.paidTaxYtdRsd)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Realizovani dobici i gubici</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="from">Od</Label>
              <Input
                id="from"
                type="date"
                data-cy="filter-from"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="to">Do</Label>
              <Input
                id="to"
                type="date"
                data-cy="filter-to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>

          {realized.isLoading && <p className="text-muted-foreground">Učitavanje…</p>}
          {realized.isError && <p className="text-danger">Greška pri učitavanju.</p>}

          <Table>
            <THead>
              <TR>
                <TH>Datum prodaje</TH>
                <TH>Tiker</TH>
                <TH className="text-right">Količina</TH>
                <TH className="text-right">Prihod</TH>
                <TH className="text-right">Osnovica</TH>
                <TH className="text-right">Profit (val.)</TH>
                <TH className="text-right">Profit (RSD)</TH>
                <TH>Oporezovan</TH>
                <TH className="text-right">Porez (RSD)</TH>
              </TR>
            </THead>
            <TBody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={9}>
                  {realized.isFetching ? 'Učitavanje…' : 'Nema prodaja u izabranom periodu.'}
                </EmptyRow>
              ) : (
                rows.map((r) => {
                  const profitNum = Number(r.profitNative ?? '0')
                  const isLoss = profitNum < 0
                  return (
                    <TR
                      key={r.id ?? `${r.saleAt}-${r.securityId}`}
                      className={isLoss ? 'text-muted-foreground' : ''}
                    >
                      <TD data-cy={`pnl-row-${r.id ?? ''}`}>{formatDateTime(r.saleAt)}</TD>
                      <TD>{r.ticker || '—'}</TD>
                      <TD className="text-right">{r.quantity ?? 0}</TD>
                      <TD className="text-right">
                        {formatMoney(r.proceedsAmt)} {currencyLabel(r.currency ?? '')}
                      </TD>
                      <TD className="text-right">
                        {formatMoney(r.costBasisAmt)} {currencyLabel(r.currency ?? '')}
                      </TD>
                      <TD className="text-right">
                        {formatMoney(r.profitNative)} {currencyLabel(r.currency ?? '')}
                      </TD>
                      <TD className="text-right">{formatMoney(r.profitRsd)}</TD>
                      <TD>
                        {isLoss ? (
                          <Badge tone="neutral">—</Badge>
                        ) : r.taxed ? (
                          <Badge tone="green">Da</Badge>
                        ) : (
                          <Badge tone="yellow">Ne</Badge>
                        )}
                      </TD>
                      <TD className="text-right" data-cy="cell-tax">
                        {isLoss ? formatMoney('0') : formatMoney(r.taxAmountRsd)}
                      </TD>
                    </TR>
                  )
                })
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={confirmRun}
        onClose={() => setConfirmRun(false)}
        title="Pokretanje obračuna poreza"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmRun(false)}>
              Otkaži
            </Button>
            <Button
              data-cy="confirm-run-tax-user"
              disabled={run.isPending}
              onClick={() => run.mutate()}
            >
              {run.isPending ? 'Obračun…' : 'Pokreni'}
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Sa korisnika <b>{me?.displayName || 'Korisnik'}</b> biće naplaćeno 15%
          neuplaćenog dobitka iz računa povezanog sa prodajom u RSD ekvivalentu
          (spec p.62). Akcija je idempotentna — već oporezovani redovi se
          preskaču.
        </p>
      </Dialog>
    </main>
  )
}
