import { useMemo, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Dialog } from '@/components/ui/dialog'
import { ErrorBanner } from '@/components/ui/error'
import { listOTCContracts } from '@/lib/api/otc'
import { proofHeaders } from '@/lib/api/verification'
import { api } from '@/lib/api/client'
import { getSecurity } from '@/lib/api/securities'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { apiError } from '@/lib/api/error'
import { formatDate, formatMoney } from '@/lib/format'
import { v1OTCContractStatus } from '@/lib/api/generated/models/v1OTCContractStatus'
import type { v1OTCContract } from '@/lib/api/generated/models/v1OTCContract'
import type { v1ExerciseOTCContractResponse } from '@/lib/api/generated/models/v1ExerciseOTCContractResponse'
import { VerificationDialog } from '@/components/verification/verification-dialog'

// Spec p.69 "Sklopljeni ugovori". Profit per row is
// (listing.last_price − strike) × qty − premium_paid, computed
// client-side. Active rows with profit > 0 surface "Iskoristi"
// (gated by verification dialog).
export function OTCContractsPage() {
  const userId = useAuthStore((s) => s.userId) ?? ''
  const qc = useQueryClient()
  const [status, setStatus] = useState<'active' | 'any'>('active')
  const [exercising, setExercising] = useState<v1OTCContract | null>(null)
  const [showVerify, setShowVerify] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const contracts = useQuery({
    queryKey: keys.otc.contracts({ status }),
    queryFn: () => listOTCContracts({ status }),
    refetchInterval: 15_000,
  })

  const rows = useMemo(() => contracts.data?.contracts ?? [], [contracts.data])
  const securityIds = useMemo(
    () => Array.from(new Set(rows.map((c) => c.securityId).filter(Boolean) as string[])),
    [rows],
  )

  // Batch-fetch the security+listing for each unique security id so we
  // can render last_price → profit. 5-min staleTime since prices on
  // catalog refetch every 30s elsewhere and this page is read-mostly.
  const secs = useQueries({
    queries: securityIds.map((id) => ({
      queryKey: keys.security.detail(id),
      queryFn: () => getSecurity(id),
      staleTime: 5 * 60_000,
    })),
  })

  const priceById = new Map<string, string | undefined>()
  securityIds.forEach((id, i) => {
    priceById.set(id, secs[i].data?.listing?.price)
  })

  const exercise = useMutation({
    mutationFn: async (proof: { id: string; code: string }) => {
      if (!exercising?.id) throw new Error('no contract')
      const { data } = await api.post<v1ExerciseOTCContractResponse>(
        `/v1/otc/contracts/${encodeURIComponent(exercising.id)}/exercise`,
        {},
        { headers: proofHeaders(proof) },
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.otc.all })
      qc.invalidateQueries({ queryKey: keys.portfolio.all })
      setExercising(null)
      setShowVerify(false)
      setErr(null)
    },
    onError: (e) => setErr(apiError(e, 'Greška')),
  })

  return (
    <main className="container space-y-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold">Sklopljeni ugovori</h1>
        <p className="text-sm text-muted-foreground">
          Aktivni i istekli OTC ugovori u kojima ste kupac ili prodavac.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Label htmlFor="otc-contracts-status">Status</Label>
            <Select
              id="otc-contracts-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'any')}
              data-cy="otc-contracts-status"
            >
              <option value="active">Aktivni</option>
              <option value="any">Svi</option>
            </Select>
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
                <TH className="text-right">Strike</TH>
                <TH className="text-right">Premium plaćen</TH>
                <TH>Datum izvršenja</TH>
                <TH>Prodavac</TH>
                <TH className="text-right">Profit</TH>
                <TH>{/* actions */}</TH>
              </TR>
            </THead>
            <TBody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={8}>{contracts.isFetching ? 'Učitavanje…' : 'Nema ugovora.'}</EmptyRow>
              ) : (
                rows.map((c) => {
                  const last = c.securityId ? priceById.get(c.securityId) : undefined
                  const profit = computeProfit(last, c)
                  const exercisable =
                    c.status === v1OTCContractStatus.OTC_CONTRACT_STATUS_ACTIVE &&
                    c.buyerId === userId &&
                    profit !== null && profit > 0
                  return (
                    <TR key={c.id} data-cy={`otc-contract-${c.id}`}>
                      <TD className="font-mono">{c.securityTicker ?? '—'}</TD>
                      <TD className="text-right">{c.quantity ?? 0}</TD>
                      <TD className="text-right">{formatMoney(c.strikePrice, c.currency)}</TD>
                      <TD className="text-right">{formatMoney(c.premiumPaid, c.currency)}</TD>
                      <TD>{formatDate(c.settlementDate)}</TD>
                      <TD>{c.sellerId === userId ? 'ja' : (c.sellerDisplayName || c.sellerId?.slice(0, 8))}</TD>
                      <TD className={`text-right ${profit !== null && profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {profit === null ? '—' : formatMoney(profit.toFixed(2), c.currency)}
                      </TD>
                      <TD>
                        {exercisable && (
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            data-cy={`otc-exercise-${c.id}`}
                            onClick={() => {
                              setErr(null)
                              setExercising(c)
                            }}
                          >
                            Iskoristi
                          </Button>
                        )}
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
        open={Boolean(exercising) && !showVerify}
        onClose={() => setExercising(null)}
        title="Iskoristi opciju"
        footer={
          <>
            <Button variant="ghost" onClick={() => setExercising(null)}>Otkaži</Button>
            <Button variant="primary" onClick={() => setShowVerify(true)} data-cy="otc-exercise-confirm">
              Potvrdi
            </Button>
          </>
        }
      >
        {exercising && (
          <div className="space-y-2 text-sm">
            <p>
              Kupujete <span className="font-medium">{exercising.quantity}</span> komada{' '}
              <span className="font-mono">{exercising.securityTicker}</span> po strajk ceni{' '}
              <span className="font-medium">{formatMoney(exercising.strikePrice, exercising.currency)}</span>.
            </p>
            <p className="text-muted-foreground">
              Notional: {formatMoney(notional(exercising), exercising.currency)}
            </p>
            {err && <ErrorBanner>{err}</ErrorBanner>}
          </div>
        )}
      </Dialog>

      <VerificationDialog
        open={showVerify}
        kind="otc_exercise"
        title="Izvršenje OTC ugovora"
        description="Unesite šestocifreni kod da potvrdite izvršenje."
        onCancel={() => setShowVerify(false)}
        onConfirm={async (proof) => {
          await exercise.mutateAsync(proof)
        }}
      />
    </main>
  )
}

function notional(c: v1OTCContract): string {
  const q = c.quantity ?? 0
  const s = Number(c.strikePrice ?? '0')
  if (!Number.isFinite(s)) return '0'
  return (q * s).toFixed(2)
}

function computeProfit(lastPrice: string | undefined, c: v1OTCContract): number | null {
  if (!lastPrice) return null
  const last = Number(lastPrice)
  const strike = Number(c.strikePrice ?? '0')
  const premium = Number(c.premiumPaid ?? '0')
  const qty = c.quantity ?? 0
  if (!Number.isFinite(last) || !Number.isFinite(strike) || !Number.isFinite(premium)) return null
  return (last - strike) * qty - premium
}
