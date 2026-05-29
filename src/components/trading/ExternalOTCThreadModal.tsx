import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorBanner } from '@/components/ui/error'
import { Badge } from '@/components/ui/badge'
import {
  counterExternalOTCOffer,
  getExternalOTCThread,
  withdrawExternalOTCOffer,
} from '@/lib/api/external-otc'
import { proofHeaders } from '@/lib/api/verification'
import { api } from '@/lib/api/client'
import { apiError } from '@/lib/api/error'
import { keys } from '@/lib/query-keys'
import { formatDate, formatMoney } from '@/lib/format'
import { v1ExternalOTCThreadStatus } from '@/lib/api/generated/models/v1ExternalOTCThreadStatus'
import { v1ExternalOTCSide } from '@/lib/api/generated/models/v1ExternalOTCSide'
import { v1ExternalOTCDirection } from '@/lib/api/generated/models/v1ExternalOTCDirection'
import { v1ExternalOTCRole } from '@/lib/api/generated/models/v1ExternalOTCRole'
import type { v1AcceptExternalOTCOfferResponse } from '@/lib/api/generated/models/v1AcceptExternalOTCOfferResponse'
import { VerificationDialog } from '@/components/verification/verification-dialog'

// Cross-bank counterpart of OTCThreadModal. The buyer side (LocalRole=
// BUYER) drives accept via the 4-step SAGA on the backend; counter +
// withdraw work for either side.
export function ExternalOTCThreadModal({
  threadId,
  onClose,
}: {
  threadId: string | null
  onClose: () => void
}) {
  const open = Boolean(threadId)
  const qc = useQueryClient()

  const thread = useQuery({
    queryKey: keys.externalOtc.thread(threadId ?? ''),
    queryFn: () => getExternalOTCThread(threadId!),
    enabled: open,
    refetchInterval: 10_000,
  })

  const t = thread.data?.thread
  const iterations = thread.data?.iterations ?? []
  const contract = thread.data?.contract

  const isOpen = t?.status === v1ExternalOTCThreadStatus.EXTERNAL_OTC_THREAD_STATUS_OPEN
  const waitingOnMe =
    isOpen && t?.modifiedBySide === v1ExternalOTCSide.EXTERNAL_OTC_SIDE_REMOTE
  const canAccept = waitingOnMe && t?.localRole === v1ExternalOTCRole.EXTERNAL_OTC_ROLE_BUYER

  const [qty, setQty] = useState('')
  const [pricePerUnit, setPricePerUnit] = useState('')
  const [premium, setPremium] = useState('')
  const [settlementDate, setSettlementDate] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [showVerify, setShowVerify] = useState(false)

  const tId = t?.id
  useEffect(() => {
    if (t) {
      setQty(t.quantity != null ? String(t.quantity) : '')
      setPricePerUnit(t.pricePerUnit ?? '')
      setPremium(t.premium ?? '')
      setSettlementDate(t.settlementDate ? t.settlementDate.slice(0, 10) : '')
      setErr(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tId])

  const counter = useMutation({
    mutationFn: () =>
      counterExternalOTCOffer(t?.remoteBankCode ?? '', threadId!, {
        quantity: Number(qty),
        pricePerUnit,
        premium,
        // Pin midnight UTC — see [[yyyymmdd-proto-timestamp]].
        settlementDate: settlementDate ? `${settlementDate}T00:00:00Z` : '',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.externalOtc.all })
    },
    onError: (e) => setErr(apiError(e, 'Greška')),
  })

  const withdraw = useMutation({
    mutationFn: () =>
      withdrawExternalOTCOffer(t?.remoteBankCode ?? '', threadId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.externalOtc.all })
      onClose()
    },
    onError: (e) => setErr(apiError(e, 'Greška')),
  })

  const accept = useMutation({
    mutationFn: async (proof: { id: string; code: string }) => {
      const { data } = await api.post<v1AcceptExternalOTCOfferResponse>(
        `/v1/otc/external-offers/${encodeURIComponent(t?.remoteBankCode ?? '')}/${encodeURIComponent(threadId!)}/accept`,
        {},
        { headers: proofHeaders(proof) },
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.externalOtc.all })
      setShowVerify(false)
      onClose()
    },
    onError: (e) => {
      setShowVerify(false)
      setErr(apiError(e, 'Prihvatanje nije uspelo'))
    },
  })

  const submitCounter = (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    const q = Number(qty)
    if (!Number.isInteger(q) || q <= 0) {
      setErr('Količina mora biti pozitivan ceo broj.')
      return
    }
    if (!settlementDate) {
      setErr('Izaberite datum izvršenja.')
      return
    }
    counter.mutate()
  }

  const title = t?.securityTicker
    ? `Eksterno pregovaranje — ${t.securityTicker} (Banka ${t.remoteBankCode})`
    : 'Eksterno pregovaranje'

  return (
    <>
      <Dialog open={open} onClose={onClose} title={title}>
        {thread.isFetching && !t ? (
          <p className="text-sm text-muted-foreground">Učitavanje…</p>
        ) : (
          t && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Smer</p>
                  <p className="font-medium">
                    {t.direction === v1ExternalOTCDirection.EXTERNAL_OTC_DIRECTION_OUTGOING
                      ? 'mi → partner'
                      : 'partner → mi'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Naša uloga</p>
                  <p className="font-medium">
                    {t.localRole === v1ExternalOTCRole.EXTERNAL_OTC_ROLE_BUYER ? 'kupac' : 'prodavac'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-medium">{statusLabel(t.status)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Partner</p>
                  <p className="font-medium">{t.remoteDisplayName || t.remoteUserRef || '—'}</p>
                </div>
              </div>

              <section>
                <h3 className="mb-2 font-medium">Istorija iteracija</h3>
                <ul className="divide-y rounded border bg-muted/30">
                  {iterations.map((it) => (
                    <li
                      key={it.id}
                      className="grid grid-cols-5 gap-2 px-3 py-2 text-sm"
                      data-cy={`ext-otc-iteration-${it.id}`}
                    >
                      <span>
                        <Badge tone={it.proposedBySide === v1ExternalOTCSide.EXTERNAL_OTC_SIDE_LOCAL ? 'blue' : 'neutral'}>
                          {it.proposedBySide === v1ExternalOTCSide.EXTERNAL_OTC_SIDE_LOCAL ? 'mi' : 'partner'}
                        </Badge>
                      </span>
                      <span className="tabular-nums">{it.quantity ?? 0} kom</span>
                      <span className="tabular-nums">{formatMoney(it.pricePerUnit, t.currency)}</span>
                      <span className="tabular-nums">prem. {formatMoney(it.premium, t.currency)}</span>
                      <span>{formatDate(it.settlementDate)}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {contract && (
                <section className="rounded border bg-emerald-50/60 p-3 text-sm">
                  <p className="mb-1 font-medium text-emerald-900">Sklopljen ugovor</p>
                  <p>
                    {contract.quantity} kom · strike {formatMoney(contract.strikePrice, contract.currency)} ·
                    premija {formatMoney(contract.premiumPaid, contract.currency)} · izvršenje{' '}
                    {formatDate(contract.settlementDate)}
                  </p>
                </section>
              )}

              {isOpen && (
                <section>
                  <h3 className="mb-2 font-medium">
                    {waitingOnMe ? 'Vaš odgovor' : 'Čekanje odgovora druge strane'}
                  </h3>
                  {waitingOnMe ? (
                    <form className="space-y-3" onSubmit={submitCounter}>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="ext-otc-counter-qty">Količina</Label>
                          <Input
                            id="ext-otc-counter-qty"
                            type="number"
                            min={1}
                            step={1}
                            value={qty}
                            onChange={(e) => setQty(e.target.value)}
                            data-cy="ext-otc-counter-qty"
                          />
                        </div>
                        <div>
                          <Label htmlFor="ext-otc-counter-ppu">Cena</Label>
                          <Input
                            id="ext-otc-counter-ppu"
                            type="number"
                            min="0"
                            step="0.01"
                            value={pricePerUnit}
                            onChange={(e) => setPricePerUnit(e.target.value)}
                            data-cy="ext-otc-counter-ppu"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="ext-otc-counter-premium">Premija</Label>
                          <Input
                            id="ext-otc-counter-premium"
                            type="number"
                            min="0"
                            step="0.01"
                            value={premium}
                            onChange={(e) => setPremium(e.target.value)}
                            data-cy="ext-otc-counter-premium"
                          />
                        </div>
                        <div>
                          <Label htmlFor="ext-otc-counter-settle">Izvršenje</Label>
                          <Input
                            id="ext-otc-counter-settle"
                            type="date"
                            value={settlementDate}
                            onChange={(e) => setSettlementDate(e.target.value)}
                            data-cy="ext-otc-counter-settle"
                          />
                        </div>
                      </div>
                      {err && <ErrorBanner>{err}</ErrorBanner>}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="submit"
                          variant="primary"
                          disabled={counter.isPending}
                          data-cy="ext-otc-counter-submit"
                        >
                          {counter.isPending ? 'Šalje se…' : 'Pošalji kontraponudu'}
                        </Button>
                        {canAccept && (
                          <Button
                            type="button"
                            variant="primary"
                            onClick={() => setShowVerify(true)}
                            data-cy="ext-otc-accept"
                          >
                            Prihvati
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="danger"
                          onClick={() => withdraw.mutate()}
                          disabled={withdraw.isPending}
                          data-cy="ext-otc-withdraw"
                        >
                          Odustani
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => withdraw.mutate()}
                      disabled={withdraw.isPending}
                      data-cy="ext-otc-withdraw"
                    >
                      Odustani
                    </Button>
                  )}
                </section>
              )}
            </div>
          )
        )}
      </Dialog>

      <VerificationDialog
        open={showVerify}
        kind="external_otc_accept"
        title="Prihvatanje eksterne ponude"
        description="Unesite šestocifreni kod da potvrdite prihvatanje cross-bank ponude."
        onCancel={() => setShowVerify(false)}
        onConfirm={async (proof) => {
          await accept.mutateAsync(proof)
        }}
      />
    </>
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
