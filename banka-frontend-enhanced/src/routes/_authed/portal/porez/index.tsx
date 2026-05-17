import { useState } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listTaxPositions, runTaxJob } from '@/lib/api/tax'
import { apiError } from '@/lib/api/error'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'
import { bankaTradingV1UserKind } from '@/lib/api/generated/models/bankaTradingV1UserKind'
import { formatMoney } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { SkeletonTable } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { ErrorBanner } from '@/components/ui/error'

const GATE = [Permissions.Admin, Permissions.ActuarySupervisor] as const

type KindFilter = '' | bankaTradingV1UserKind.USER_KIND_CLIENT | bankaTradingV1UserKind.USER_KIND_EMPLOYEE

export const Route = createFileRoute('/_authed/portal/porez/')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!hasAny(perms, [...GATE])) {
      throw redirect({ to: '/portal' })
    }
  },
  component: TaxBoard,
})

function TaxBoard() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [kind, setKind] = useState<KindFilter>('')
  const [name, setName] = useState('')
  const [confirmRun, setConfirmRun] = useState(false)
  const [lastResult, setLastResult] = useState<{ users: number; total: string } | null>(null)

  const queryArgs = { userKind: kind || undefined, nameQuery: name || undefined }
  const board = useQuery({
    queryKey: keys.tax.board(queryArgs),
    queryFn: () => listTaxPositions(queryArgs),
  })

  const run = useMutation({
    mutationFn: () => runTaxJob({}),
    onSuccess: (res) => {
      setLastResult({
        users: Number(res.usersTaxed ?? 0),
        total: String(res.totalCollectedRsd ?? '0'),
      })
      setConfirmRun(false)
      qc.invalidateQueries({ queryKey: keys.tax.all })
    },
  })

  const rows = board.data?.positions ?? []
  const error = apiError(run.error, '') || null

  return (
    <main className="container space-y-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Porez na kapitalni dobitak</h1>
          <p className="text-sm text-muted-foreground">
            Pregled neuplaćenog poreza po korisniku (15% od realizovanog dobitka u RSD).
          </p>
        </div>
        <Button data-cy="run-tax" onClick={() => setConfirmRun(true)} disabled={run.isPending}>
          {run.isPending ? 'Obračun…' : 'Pokreni obračun'}
        </Button>
      </header>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {lastResult && (
        <div
          data-cy="run-tax-result"
          className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-900"
        >
          Obračun završen: {lastResult.users} korisnika, ukupno {formatMoney(lastResult.total)} RSD.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <Label htmlFor="filter-kind">Tip korisnika</Label>
          <Select
            id="filter-kind"
            data-cy="filter-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as KindFilter)}
          >
            <option value="">Svi</option>
            <option value={bankaTradingV1UserKind.USER_KIND_CLIENT}>Klijenti</option>
            <option value={bankaTradingV1UserKind.USER_KIND_EMPLOYEE}>Zaposleni</option>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="filter-name">Pretraga po imenu</Label>
          <Input
            id="filter-name"
            data-cy="filter-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ime ili prezime"
          />
        </div>
      </div>

      {board.isLoading && <SkeletonTable rows={5} cols={4} />}
      {board.isError && <p className="text-danger">Greška pri učitavanju liste.</p>}

      <Table>
        <THead>
          <TR>
            <TH>Korisnik</TH>
            <TH>Tip</TH>
            <TH className="text-right">Neuplaćeno (RSD)</TH>
            <TH className="text-right">Plaćeno YTD (RSD)</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={4}>{board.isFetching ? 'Učitavanje…' : 'Nema stavki.'}</EmptyRow>
          ) : (
            rows.map((p) => {
              const id = p.userId ?? ''
              const kindStr = p.userKind ?? bankaTradingV1UserKind.USER_KIND_UNSPECIFIED
              const isClient = kindStr === bankaTradingV1UserKind.USER_KIND_CLIENT
              const unpaid = Number(p.unpaidTaxRsd ?? '0')
              return (
                <TR
                  key={`${kindStr}-${id}`}
                  onClick={() =>
                    navigate({
                      to: '/portal/porez/$userId',
                      params: { userId: id },
                      search: { kind: kindStr },
                    })
                  }
                >
                  <TD data-cy={`tax-row-${id}`}>{p.displayName || <span className="text-muted-foreground">—</span>}</TD>
                  <TD>
                    <Badge tone={isClient ? 'blue' : 'neutral'}>
                      {isClient ? 'Klijent' : 'Zaposleni'}
                    </Badge>
                  </TD>
                  <TD className="text-right" data-cy="cell-unpaid">
                    <span className={unpaid > 0 ? 'font-medium text-amber-700' : ''}>
                      {formatMoney(p.unpaidTaxRsd)}
                    </span>
                  </TD>
                  <TD className="text-right" data-cy="cell-paid-ytd">
                    {formatMoney(p.paidTaxYtdRsd)}
                  </TD>
                </TR>
              )
            })
          )}
        </TBody>
      </Table>

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
              data-cy="confirm-run-tax"
              disabled={run.isPending}
              onClick={() => run.mutate()}
            >
              {run.isPending ? 'Obračun…' : 'Pokreni'}
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Sa svakog korisnika koji ima neuplaćeni dobitak biće naplaćeno 15% iz
          računa povezanog sa prodajom u RSD ekvivalentu (spec p.62). Akcija je
          idempotentna — već oporezovani redovi se preskaču.
        </p>
      </Dialog>
    </main>
  )
}
