import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ErrorBanner } from '@/components/ui/error'
import { listAccounts } from '@/lib/api/accounts'
import { createOTCOffer } from '@/lib/api/otc'
import { useAuthStore } from '@/lib/auth/store'
import { apiError } from '@/lib/api/error'
import { keys } from '@/lib/query-keys'
import type { v1PublicHoldingItem } from '@/lib/api/generated/models/v1PublicHoldingItem'
import type { bankaBankV1Currency } from '@/lib/api/generated/models/bankaBankV1Currency'
import { v1AccountStatus } from '@/lib/api/generated/models/v1AccountStatus'
import { currencyLabel, formatMoney } from '@/lib/format'

// Buyer-side OTC offer dialog. The discovery item gives us
// everything we need to anchor the trade — the seller's account, the
// holding id, the security and its currency. The buyer picks an own
// account in the same currency and dials in qty / price / premium /
// settlement date.
export function CreateOTCOfferDialog({
  open,
  item,
  onClose,
}: {
  open: boolean
  item: v1PublicHoldingItem | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const userId = useAuthStore((s) => s.userId) ?? ''
  const sec = item?.security
  const currency = sec?.currency as unknown as bankaBankV1Currency | undefined

  // The buyer-side account: own checking accounts in the security's
  // currency. The server validates currency match anyway.
  const accounts = useQuery({
    queryKey: keys.account.list({ owner: userId, currency, otc: 'buyer' }),
    queryFn: () =>
      listAccounts({
        ownerClientId: userId,
        currency,
        status: v1AccountStatus.ACCOUNT_STATUS_ACTIVE,
      }),
    enabled: open && Boolean(userId) && Boolean(currency),
  })

  const eligible = useMemo(() => accounts.data?.accounts ?? [], [accounts.data])
  const max = item?.availableCount ?? 0

  const [buyerAccountId, setBuyerAccountId] = useState('')
  const [qty, setQty] = useState('')
  const [pricePerUnit, setPricePerUnit] = useState('')
  const [premium, setPremium] = useState('')
  const [settlementDate, setSettlementDate] = useState('')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setBuyerAccountId('')
      setQty('')
      setPricePerUnit(item?.currentPrice ?? '')
      setPremium('')
      setSettlementDate('')
      setErr(null)
    }
  }, [open, item?.currentPrice])

  useEffect(() => {
    if (!buyerAccountId && eligible.length > 0 && eligible[0].id) {
      setBuyerAccountId(eligible[0].id)
    }
  }, [buyerAccountId, eligible])

  const totalCost = useMemo(() => {
    const q = Number(qty)
    const p = Number(pricePerUnit)
    if (!Number.isFinite(q) || !Number.isFinite(p)) return undefined
    return (q * p).toFixed(2)
  }, [qty, pricePerUnit])

  const mut = useMutation({
    mutationFn: () =>
      createOTCOffer({
        sellerHoldingId: item?.holdingId,
        buyerAccountId,
        sellerAccountId: item?.sellerAccountId,
        quantity: Number(qty),
        pricePerUnit,
        premium,
        // The form is <input type="date"> → "YYYY-MM-DD"; the backend's
        // proto.Timestamp requires RFC3339, so pin to midnight UTC.
        settlementDate: settlementDate ? `${settlementDate}T00:00:00Z` : '',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.otc.all })
      onClose()
    },
    onError: (e) => setErr(apiError(e, 'Greška')),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!item) return
    const q = Number(qty)
    if (!Number.isInteger(q) || q <= 0 || q > max) {
      setErr(`Količina mora biti između 1 i ${max}.`)
      return
    }
    if (!buyerAccountId) {
      setErr('Izaberite Vaš račun.')
      return
    }
    if (!settlementDate) {
      setErr('Izaberite datum izvršenja.')
      return
    }
    mut.mutate()
  }

  return (
    <Dialog
      open={open && Boolean(item)}
      onClose={onClose}
      title={`Napravi ponudu — ${sec?.ticker ?? ''}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mut.isPending}>Otkaži</Button>
          <Button
            type="submit"
            form="otc-create-offer-form"
            variant="primary"
            disabled={mut.isPending}
            data-cy="otc-create-offer-submit"
          >
            {mut.isPending ? 'Slanje…' : 'Pošalji ponudu'}
          </Button>
        </>
      }
    >
      <form id="otc-create-offer-form" className="space-y-3" onSubmit={submit}>
        <p className="text-sm text-muted-foreground">
          Prodavac: <span className="font-medium">{item?.sellerDisplayName ?? '—'}</span>
          {' · '}
          Dostupno: <span className="tabular-nums">{max}</span>
          {' · '}
          Tržišna cena: {formatMoney(item?.currentPrice, sec?.currency)}
        </p>

        <div>
          <Label htmlFor="otc-buyer-account">Račun za premium i izvršenje</Label>
          <Select
            id="otc-buyer-account"
            value={buyerAccountId}
            onChange={(e) => setBuyerAccountId(e.target.value)}
            data-cy="otc-buyer-account"
          >
            <option value="">— izaberite —</option>
            {eligible.map((a) => (
              <option key={a.id} value={a.id ?? ''}>
                {a.number} ({currencyLabel(a.currency ?? '')}) · {formatMoney(a.availableBalance, a.currency)}
              </option>
            ))}
          </Select>
          {accounts.isFetched && eligible.length === 0 && (
            <p className="mt-1 text-xs text-rose-600">
              Nemate aktivan račun u valuti {currencyLabel((currency as string) ?? '')}.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="otc-qty">Količina</Label>
            <Input
              id="otc-qty"
              type="number"
              min={1}
              max={max}
              step={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              data-cy="otc-qty"
            />
          </div>
          <div>
            <Label htmlFor="otc-ppu">Cena po komadu ({currencyLabel((currency as string) ?? '')})</Label>
            <Input
              id="otc-ppu"
              type="number"
              min="0"
              step="0.01"
              value={pricePerUnit}
              onChange={(e) => setPricePerUnit(e.target.value)}
              data-cy="otc-ppu"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="otc-premium">Premium ({currencyLabel((currency as string) ?? '')})</Label>
            <Input
              id="otc-premium"
              type="number"
              min="0"
              step="0.01"
              value={premium}
              onChange={(e) => setPremium(e.target.value)}
              data-cy="otc-premium"
            />
          </div>
          <div>
            <Label htmlFor="otc-settlement">Datum izvršenja</Label>
            <Input
              id="otc-settlement"
              type="date"
              value={settlementDate}
              onChange={(e) => setSettlementDate(e.target.value)}
              data-cy="otc-settlement"
            />
          </div>
        </div>

        {totalCost !== undefined && (
          <p className="text-xs text-muted-foreground">
            Notional (qty × cena): {formatMoney(totalCost, currency as string)}
          </p>
        )}

        {err && <ErrorBanner>{err}</ErrorBanner>}
      </form>
    </Dialog>
  )
}
