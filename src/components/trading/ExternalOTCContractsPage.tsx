import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Dialog } from '@/components/ui/dialog'
import { ErrorBanner } from '@/components/ui/error'
import { listExternalOTCContracts } from '@/lib/api/external-otc'
import { proofHeaders } from '@/lib/api/verification'
import { api } from '@/lib/api/client'
import { keys } from '@/lib/query-keys'
import { apiError } from '@/lib/api/error'
import { formatDate, formatMoney } from '@/lib/format'
import { v1ExternalOTCContractStatus } from '@/lib/api/generated/models/v1ExternalOTCContractStatus'
import { v1ExternalOTCRole } from '@/lib/api/generated/models/v1ExternalOTCRole'
import type { v1ExternalOTCContract } from '@/lib/api/generated/models/v1ExternalOTCContract'
import type { v1ExerciseExternalOTCContractResponse } from '@/lib/api/generated/models/v1ExerciseExternalOTCContractResponse'
import { VerificationDialog } from '@/components/verification/verification-dialog'

// Cross-bank "Sklopljeni ugovori". Only outgoing-buyer rows are
// exercisable from our side — incoming-seller rows wait for the
// partner's exercise notice (handled by ReceiveExternalOTCExerciseNotice).
export function ExternalOTCContractsPage() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<'active' | 'any'>('active')
  const [exercising, setExercising] = useState<v1ExternalOTCContract | null>(null)
  const [showVerify, setShowVerify] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const statusArg =
    filter === 'active'
      ? v1ExternalOTCContractStatus.EXTERNAL_OTC_CONTRACT_STATUS_ACTIVE
      : undefined

  const contracts = useQuery({
    queryKey: keys.externalOtc.contracts({ status: statusArg }),
    queryFn: () => listExternalOTCContracts({ status: statusArg }),
    refetchInterval: 15_000,
  })

  const rows = contracts.data?.contracts ?? []

  const exercise = useMutation({
    mutationFn: async (proof: { id: string; code: string }) => {
      if (!exercising?.id || !exercising.remoteBankCode) throw new Error('contract missing')
      const { data } = await api.post<v1ExerciseExternalOTCContractResponse>(
        `/v1/otc/external-contracts/${encodeURIComponent(exercising.remoteBankCode)}/${encodeURIComponent(exercising.id)}/exercise`,
        {},
        { headers: proofHeaders(proof) },
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.externalOtc.all })
      setExercising(null)
      setShowVerify(false)
      setErr(null)
    },
    onError: (e) => {
      setShowVerify(false)
      setErr(apiError(e, 'Izvršenje nije uspelo'))
    },
  })

  return (
    <main className="container space-y-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold">Eksterni ugovori</h1>
        <p className="text-sm text-muted-foreground">
          Cross-bank OTC ugovori u kojima ste kupac ili prodavac.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Label htmlFor="ext-otc-contracts-status">Status</Label>
            <Select
              id="ext-otc-contracts-status"
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'active' | 'any')}
              data-cy="ext-otc-contracts-status"
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
                <TH>Banka</TH>
                <TH>Ticker</TH>
                <TH>Naša uloga</TH>
                <TH className="text-right">Količina</TH>
                <TH className="text-right">Strike</TH>
                <TH className="text-right">Premija</TH>
                <TH>Izvršenje</TH>
                <TH>Status</TH>
                <TH>{/* actions */}</TH>
              </TR>
            </THead>
            <TBody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={9}>
                  {contracts.isFetching ? 'Učitavanje…' : 'Nema eksternih ugovora.'}
                </EmptyRow>
              ) : (
                rows.map((c) => {
                  const exercisable =
                    c.status === v1ExternalOTCContractStatus.EXTERNAL_OTC_CONTRACT_STATUS_ACTIVE &&
                    c.localRole === v1ExternalOTCRole.EXTERNAL_OTC_ROLE_BUYER
                  return (
                    <TR key={c.id} data-cy={`ext-otc-contract-${c.id}`}>
                      <TD className="font-mono">{c.remoteBankCode ?? '—'}</TD>
                      <TD className="font-mono">{c.securityTicker ?? '—'}</TD>
                      <TD>{roleLabel(c.localRole)}</TD>
                      <TD className="text-right">{c.quantity ?? 0}</TD>
                      <TD className="text-right">{formatMoney(c.strikePrice, c.currency)}</TD>
                      <TD className="text-right">{formatMoney(c.premiumPaid, c.currency)}</TD>
                      <TD>{formatDate(c.settlementDate)}</TD>
                      <TD>{statusLabel(c.status)}</TD>
                      <TD>
                        {exercisable && (
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            data-cy={`ext-otc-exercise-${c.id}`}
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
        title="Iskoristi eksternu opciju"
        footer={
          <>
            <Button variant="ghost" onClick={() => setExercising(null)}>Otkaži</Button>
            <Button variant="primary" onClick={() => setShowVerify(true)} data-cy="ext-otc-exercise-confirm">
              Potvrdi
            </Button>
          </>
        }
      >
        {exercising && (
          <div className="space-y-2 text-sm">
            <p>
              Iskorišćavate ugovor — {exercising.quantity} kom{' '}
              <span className="font-mono">{exercising.securityTicker}</span> po{' '}
              {formatMoney(exercising.strikePrice, exercising.currency)} po komadu.
              Banka {exercising.remoteBankCode} je druga strana.
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
        kind="external_otc_exercise"
        title="Izvršenje eksternog OTC ugovora"
        description="Unesite šestocifreni kod da potvrdite cross-bank izvršenje."
        onCancel={() => setShowVerify(false)}
        onConfirm={async (proof) => {
          await exercise.mutateAsync(proof)
        }}
      />
    </main>
  )
}

function notional(c: v1ExternalOTCContract): string {
  const q = c.quantity ?? 0
  const s = Number(c.strikePrice ?? '0')
  if (!Number.isFinite(s)) return '0'
  return (q * s).toFixed(2)
}

function roleLabel(r: v1ExternalOTCRole | undefined): string {
  switch (r) {
    case v1ExternalOTCRole.EXTERNAL_OTC_ROLE_BUYER: return 'kupac'
    case v1ExternalOTCRole.EXTERNAL_OTC_ROLE_SELLER: return 'prodavac'
    default: return '—'
  }
}

function statusLabel(s: v1ExternalOTCContractStatus | undefined): string {
  switch (s) {
    case v1ExternalOTCContractStatus.EXTERNAL_OTC_CONTRACT_STATUS_ACTIVE: return 'aktivan'
    case v1ExternalOTCContractStatus.EXTERNAL_OTC_CONTRACT_STATUS_EXERCISED: return 'iskorišćen'
    case v1ExternalOTCContractStatus.EXTERNAL_OTC_CONTRACT_STATUS_EXPIRED: return 'istekao'
    case v1ExternalOTCContractStatus.EXTERNAL_OTC_CONTRACT_STATUS_SETTLING: return 'u izvršenju'
    default: return '—'
  }
}
