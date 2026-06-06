import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { suggestOTCMatches } from '@/lib/api/otc'
import { listSecurities } from '@/lib/api/securities'
import { keys } from '@/lib/query-keys'
import { formatMoney } from '@/lib/format'
import { v1SecurityType } from '@/lib/api/generated/models/v1SecurityType'
import type { v1OTCMatchSuggestion } from '@/lib/api/generated/models/v1OTCMatchSuggestion'
import type { v1PublicHoldingItem } from '@/lib/api/generated/models/v1PublicHoldingItem'

// "Predloženi ugovori" — the OTC matching engine (todoSpec C4). The buyer
// states a security + quantity + desired price (+ optional ±tolerance);
// the backend returns public seller holdings whose ask price sits inside
// the band and whose inventory can satisfy the request (fully or
// partially), cheapest-first. Picking a suggestion prefills the existing
// CreateOTCOffer dialog. Read-only suggestion path — no offer is created
// here until the user confirms in the dialog.
//
// `onChoose` hands the parent a v1PublicHoldingItem-shaped value so it can
// reuse the same CreateOTCOfferDialog the discovery board uses. The buyer's
// desired unit price (not the seller ask) is carried so the dialog prefills
// the price the buyer actually wants to offer.
function suggestionToItem(
  s: v1OTCMatchSuggestion,
  buyerPrice: string,
): v1PublicHoldingItem {
  return {
    holdingId: s.holdingId,
    sellerId: s.sellerId,
    sellerKind: s.sellerKind,
    sellerAccountId: s.sellerAccountId,
    sellerDisplayName: s.sellerDisplayName,
    security: s.security,
    availableCount: s.availableCount,
    publicCount: s.availableCount,
    reservedCount: 0,
    currentPrice: buyerPrice,
    currency: s.currency,
  }
}

function deltaLabel(pct: number | undefined): string {
  if (pct === undefined) return '—'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

export function OTCSuggestionsPanel({
  onChoose,
}: {
  onChoose: (item: v1PublicHoldingItem) => void
}) {
  const [securityId, setSecurityId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [tolerance, setTolerance] = useState('5')
  const [submitted, setSubmitted] = useState<{
    securityId: string
    quantity: number
    price: string
    tolerancePct: number
  } | null>(null)
  const [formErr, setFormErr] = useState<string | null>(null)

  // Stocks + futures only — those are the OTC-tradable instruments
  // (spec p.58 / p.79). One catalog fetch backs the security picker.
  const securities = useQuery({
    queryKey: keys.security.list({ otcSuggest: true }),
    queryFn: () =>
      listSecurities({ type: v1SecurityType.SECURITY_TYPE_STOCK, pageSize: 200 }),
  })
  const futures = useQuery({
    queryKey: keys.security.list({ otcSuggest: 'future' }),
    queryFn: () =>
      listSecurities({ type: v1SecurityType.SECURITY_TYPE_FUTURE, pageSize: 200 }),
  })
  const securityOptions = useMemo(() => {
    const rows = [...(securities.data?.items ?? []), ...(futures.data?.items ?? [])]
    return rows.map((r) => r.security).filter((s): s is NonNullable<typeof s> => Boolean(s))
  }, [securities.data, futures.data])

  const suggestions = useQuery({
    queryKey: keys.otc.suggestions(submitted ?? {}),
    queryFn: () => suggestOTCMatches(submitted!),
    enabled: Boolean(submitted),
  })

  const items = suggestions.data?.suggestions ?? []
  const effectiveTol = suggestions.data?.tolerancePct

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormErr(null)
    const q = Number(quantity)
    const p = Number(price)
    const t = tolerance.trim() === '' ? 0 : Number(tolerance)
    if (!securityId) {
      setFormErr('Izaberite hartiju.')
      return
    }
    if (!Number.isInteger(q) || q <= 0) {
      setFormErr('Količina mora biti ceo pozitivan broj.')
      return
    }
    if (!Number.isFinite(p) || p <= 0) {
      setFormErr('Cena mora biti pozitivan broj.')
      return
    }
    if (!Number.isFinite(t) || t < 0) {
      setFormErr('Tolerancija mora biti nenegativan broj.')
      return
    }
    setSubmitted({ securityId, quantity: q, price, tolerancePct: t })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Predloženi ugovori</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Unesite šta želite da kupite i po kojoj ceni — sistem predlaže prodavce
          čija je cena u zadatom opsegu (podrazumevano ±5%) i koji imaju dovoljno
          akcija.
        </p>

        <form
          className="grid grid-cols-1 gap-3 md:grid-cols-5"
          onSubmit={submit}
          data-cy="otc-suggest-form"
        >
          <div className="md:col-span-2">
            <Label htmlFor="otc-suggest-security">Hartija</Label>
            <Select
              id="otc-suggest-security"
              value={securityId}
              onChange={(e) => setSecurityId(e.target.value)}
              data-cy="otc-suggest-security"
            >
              <option value="">— izaberite —</option>
              {securityOptions.map((s) => (
                <option key={s.id} value={s.id ?? ''}>
                  {s.ticker} — {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="otc-suggest-qty">Količina</Label>
            <Input
              id="otc-suggest-qty"
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              data-cy="otc-suggest-qty"
            />
          </div>
          <div>
            <Label htmlFor="otc-suggest-price">Željena cena</Label>
            <Input
              id="otc-suggest-price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              data-cy="otc-suggest-price"
            />
          </div>
          <div>
            <Label htmlFor="otc-suggest-tolerance">Tolerancija (%)</Label>
            <Input
              id="otc-suggest-tolerance"
              type="number"
              min="0"
              step="0.5"
              value={tolerance}
              onChange={(e) => setTolerance(e.target.value)}
              placeholder="5"
              data-cy="otc-suggest-tolerance"
            />
          </div>
          <div className="md:col-span-5">
            <Button type="submit" variant="primary" data-cy="otc-suggest-submit">
              Pronađi predloge
            </Button>
            {formErr && <span className="ml-3 text-sm text-rose-600">{formErr}</span>}
          </div>
        </form>

        {submitted && (
          <div>
            {effectiveTol !== undefined && items.length > 0 && (
              <p className="mb-2 text-xs text-muted-foreground">
                Opseg cene: ±{effectiveTol}% oko {formatMoney(submitted.price)}
              </p>
            )}
            <Table>
              <THead>
                <TR>
                  <TH>Oznaka</TH>
                  <TH>Prodavac</TH>
                  <TH className="text-right">Cena prodavca</TH>
                  <TH className="text-right">Razlika</TH>
                  <TH className="text-right">Dostupno</TH>
                  <TH className="text-right">Predlog</TH>
                  <TH>{/* actions */}</TH>
                </TR>
              </THead>
              <TBody>
                {items.length === 0 ? (
                  <EmptyRow colSpan={7}>
                    {suggestions.isFetching
                      ? 'Učitavanje…'
                      : 'Nema predloga u zadatom opsegu.'}
                  </EmptyRow>
                ) : (
                  items.map((s) => (
                    <TR key={s.holdingId} data-cy={`otc-suggest-row-${s.holdingId}`}>
                      <TD className="font-mono">{s.security?.ticker ?? '—'}</TD>
                      <TD>{s.sellerDisplayName ?? '—'}</TD>
                      <TD className="text-right">
                        {formatMoney(s.unitPrice, s.security?.currency)}
                      </TD>
                      <TD
                        className="text-right tabular-nums"
                        data-cy={`otc-suggest-delta-${s.holdingId}`}
                      >
                        {deltaLabel(s.priceDeltaPct)}
                      </TD>
                      <TD className="text-right tabular-nums">{s.availableCount ?? 0}</TD>
                      <TD
                        className="text-right tabular-nums"
                        data-cy={`otc-suggest-qty-${s.holdingId}`}
                      >
                        {s.suggestedQuantity ?? 0}
                        {s.fullySatisfies === false && (
                          <span
                            className="ml-1 text-xs text-amber-600"
                            title="Prodavac nema celu traženu količinu"
                          >
                            (delimično)
                          </span>
                        )}
                      </TD>
                      <TD>
                        <Button
                          type="button"
                          size="sm"
                          variant="primary"
                          data-cy={`otc-suggest-offer-${s.holdingId}`}
                          onClick={() => onChoose(suggestionToItem(s, submitted.price))}
                        >
                          Napravi ponudu
                        </Button>
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
