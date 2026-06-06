import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorBanner } from '@/components/ui/error'
import { Badge } from '@/components/ui/badge'
import {
  counterOTCOffer,
  getOTCThread,
  withdrawOTCOffer,
} from '@/lib/api/otc'
import { proofHeaders } from '@/lib/api/verification'
import { api } from '@/lib/api/client'
import { getSecurity } from '@/lib/api/securities'
import { useAuthStore } from '@/lib/auth/store'
import { apiError } from '@/lib/api/error'
import { keys } from '@/lib/query-keys'
import { formatDate, formatDateTime, formatMoney } from '@/lib/format'
import { deviationClass, deviationLevel } from '@/lib/trading/otc-deviation'
import { v1OTCStatus } from '@/lib/api/generated/models/v1OTCStatus'
import type { v1OTCOffer } from '@/lib/api/generated/models/v1OTCOffer'
import type { v1AcceptOTCOfferResponse } from '@/lib/api/generated/models/v1AcceptOTCOfferResponse'
import { VerificationDialog } from '@/components/verification/verification-dialog'

// Iteration history modal. Drives the spec p.69 thread detail — shows
// every iteration in oldest-first order, lets the waiting party
// accept / counter / withdraw. The counter form mirrors the offer
// dialog. Verification dialog gates Prihvati.
export function OTCThreadModal({
  threadId,
  onClose,
}: {
  threadId: string | null
  onClose: () => void
}) {
  const open = Boolean(threadId)
  const userId = useAuthStore((s) => s.userId) ?? ''
  const qc = useQueryClient()

  const thread = useQuery({
    queryKey: keys.otc.thread(threadId ?? ''),
    queryFn: () => getOTCThread(threadId!),
    enabled: open,
    refetchInterval: 10_000,
  })

  const iterations = thread.data?.iterations ?? []
  const latest: v1OTCOffer | undefined = iterations[iterations.length - 1]
  const securityId = latest?.securityId

  const sec = useQuery({
    queryKey: keys.security.detail(securityId ?? ''),
    queryFn: () => getSecurity(securityId!),
    enabled: open && Boolean(securityId),
  })
  const reference = sec.data?.listing?.price

  // The counterparty is whoever didn't last edit. Only that side can
  // accept / counter / withdraw productively (server enforces too).
  const waitingOnMe =
    latest?.status === v1OTCStatus.OTC_STATUS_OPEN && latest?.modifiedBy !== userId

  // Counter form state — initialized from the last iteration so the
  // user only has to edit what they want to change.
  const [qty, setQty] = useState('')
  const [pricePerUnit, setPricePerUnit] = useState('')
  const [premium, setPremium] = useState('')
  const [settlementDate, setSettlementDate] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [showVerify, setShowVerify] = useState(false)

  const latestId = latest?.id
  useEffect(() => {
    if (latest) {
      setQty(latest.quantity != null ? String(latest.quantity) : '')
      setPricePerUnit(latest.pricePerUnit ?? '')
      setPremium(latest.premium ?? '')
      setSettlementDate(latest.settlementDate ? latest.settlementDate.slice(0, 10) : '')
      setErr(null)
    }
    // We reset form fields when the underlying iteration row changes;
    // depending on `latest` directly would refire after every poll even
    // when the row content hasn't actually rotated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestId])

  const counter = useMutation({
    mutationFn: () =>
      counterOTCOffer(threadId!, {
        quantity: Number(qty),
        pricePerUnit,
        premium,
        // The form is <input type="date"> → "YYYY-MM-DD"; the backend's
        // proto.Timestamp requires RFC3339, so pin to midnight UTC.
        settlementDate: settlementDate ? `${settlementDate}T00:00:00Z` : '',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.otc.all })
    },
    onError: (e) => setErr(apiError(e, 'Greška')),
  })

  const withdraw = useMutation({
    mutationFn: () => withdrawOTCOffer(threadId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.otc.all })
      onClose()
    },
    onError: (e) => setErr(apiError(e, 'Greška')),
  })

  // Accept goes through the verification dialog — spec p.11 +
  // FOUND-9. The dialog returns proof headers that we pin to one POST.
  const accept = useMutation({
    mutationFn: async (proof: { id: string; code: string }) => {
      const { data } = await api.post<v1AcceptOTCOfferResponse>(
        `/v1/otc/offers/${encodeURIComponent(threadId!)}/accept`,
        {},
        { headers: proofHeaders(proof) },
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.otc.all })
      setShowVerify(false)
      onClose()
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

  const title = useMemo(() => {
    const t = latest?.securityTicker ?? ''
    return `Pregovaranje — ${t}`
  }, [latest?.securityTicker])

  return (
    <>
      <Dialog open={open} onClose={onClose} title={title} panelClassName="max-w-3xl">
        {!latest ? (
          <p className="text-sm text-muted-foreground">Učitavanje…</p>
        ) : (
          <div className="space-y-4">
            <section>
              <h3 className="mb-2 text-sm font-semibold">Iteracije</h3>
              <div className="space-y-2">
                {iterations.map((it, i) => {
                  const lvl = deviationLevel(it.pricePerUnit, reference)
                  const me = it.modifiedBy === userId
                  return (
                    <div
                      key={it.id}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                      data-cy={`otc-iter-${i}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">#{i + 1}</span>
                        <Badge tone={me ? 'neutral' : 'blue'}>{me ? 'ja' : 'druga strana'}</Badge>
                        <span className="tabular-nums">
                          {it.quantity} × {formatMoney(it.pricePerUnit, it.currency)}
                        </span>
                        <span className={lvl ? deviationClass[lvl] : ''}>
                          {lvl === 'green' && '✓ blizu tržišne cene'}
                          {lvl === 'yellow' && '⚠ odstupanje 5–20%'}
                          {lvl === 'red' && '⚠ odstupanje > 20%'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Premium: {formatMoney(it.premium, it.currency)}</span>
                        <span>Izvršenje: {formatDate(it.settlementDate)}</span>
                        <span>Vreme: {formatDateTime(it.createdAt)}</span>
                        <span>Status: {statusLabel(it.status)}</span>
                      </div>
                    </div>
                  )
                })}
                {thread.data?.contract && (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                    Sklopljen ugovor #{thread.data.contract.id?.slice(0, 8)}
                  </div>
                )}
              </div>
            </section>

            {waitingOnMe && (
              <>
                <section className="rounded-md border border-border p-3">
                  <h3 className="mb-1 text-sm font-semibold">Prihvati ponudu druge strane</h3>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Prihvatanjem se sklapa ugovor sa ovim uslovima — vrednosti ispod u kontraponudi se ne koriste.
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm tabular-nums">
                      {latest.quantity} × {formatMoney(latest.pricePerUnit, latest.currency)}{' '}
                      <span className="text-muted-foreground">
                        · premium {formatMoney(latest.premium, latest.currency)} · izvršenje {formatDate(latest.settlementDate)}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => setShowVerify(true)}
                      disabled={accept.isPending}
                      data-cy="otc-accept"
                    >
                      Prihvati
                    </Button>
                  </div>
                </section>

                <section className="rounded-md border border-border p-3">
                  <h3 className="mb-1 text-sm font-semibold">Pošalji kontraponudu</h3>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Izmeni vrednosti i pošalji — druga strana može ponovo da odgovori.
                  </p>
                  <form className="space-y-3" onSubmit={submitCounter}>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="otc-counter-qty">Količina</Label>
                        <Input id="otc-counter-qty" type="number" min={1} step={1} value={qty} onChange={(e) => setQty(e.target.value)} data-cy="otc-counter-qty" />
                      </div>
                      <div>
                        <Label htmlFor="otc-counter-ppu">Cena po komadu</Label>
                        <Input id="otc-counter-ppu" type="number" min="0" step="0.01" value={pricePerUnit} onChange={(e) => setPricePerUnit(e.target.value)} data-cy="otc-counter-ppu" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="otc-counter-premium">Premium</Label>
                        <Input id="otc-counter-premium" type="number" min="0" step="0.01" value={premium} onChange={(e) => setPremium(e.target.value)} data-cy="otc-counter-premium" />
                      </div>
                      <div>
                        <Label htmlFor="otc-counter-settlement">Datum izvršenja</Label>
                        <Input id="otc-counter-settlement" type="date" value={settlementDate} onChange={(e) => setSettlementDate(e.target.value)} data-cy="otc-counter-settlement" />
                      </div>
                    </div>
                    {err && <ErrorBanner>{err}</ErrorBanner>}
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => withdraw.mutate()}
                        disabled={withdraw.isPending}
                        data-cy="otc-withdraw"
                      >
                        Odustani
                      </Button>
                      <Button type="submit" variant="primary" disabled={counter.isPending} data-cy="otc-counter-submit">
                        Pošalji kontraponudu
                      </Button>
                    </div>
                  </form>
                </section>
              </>
            )}

            {!waitingOnMe && latest.status === v1OTCStatus.OTC_STATUS_OPEN && (
              <p className="text-xs text-muted-foreground">
                Čeka se odgovor druge strane. Možete povući ponudu.
              </p>
            )}

            {latest.status === v1OTCStatus.OTC_STATUS_OPEN && !waitingOnMe && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => withdraw.mutate()}
                  disabled={withdraw.isPending}
                  data-cy="otc-withdraw"
                >
                  Odustani
                </Button>
              </div>
            )}
          </div>
        )}
      </Dialog>

      <VerificationDialog
        open={showVerify}
        kind="otc_accept"
        title="Prihvatanje OTC ponude"
        description="Unesite šestocifreni kod da potvrdite prihvatanje."
        onCancel={() => setShowVerify(false)}
        onConfirm={async (proof) => {
          await accept.mutateAsync(proof)
        }}
      />
    </>
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
