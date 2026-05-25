import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ErrorBanner } from '@/components/ui/error'
import { listAccounts } from '@/lib/api/accounts'
import { createExternalOTCOffer } from '@/lib/api/external-otc'
import { useAuthStore } from '@/lib/auth/store'
import { apiError } from '@/lib/api/error'
import { keys } from '@/lib/query-keys'
import { v1AccountStatus } from '@/lib/api/generated/models/v1AccountStatus'
import { v1SecurityType } from '@/lib/api/generated/models/v1SecurityType'
import type { v1ExternalPublicHolding } from '@/lib/api/generated/models/v1ExternalPublicHolding'
import type { bankaBankV1Currency } from '@/lib/api/generated/models/bankaBankV1Currency'
import { bankaTradingV1Currency } from '@/lib/api/generated/models/bankaTradingV1Currency'
import { currencyLabel, formatMoney } from '@/lib/format'

// Buyer-side cross-bank OTC offer dialog. Discovery row from a partner
// gives us bank_code + seller_user_ref + ticker + currency. We pick our
// account in the matching currency and dial in qty / price / premium /
// settlement.
export function ExternalCreateOTCOfferDialog({
  open,
  item,
  onClose,
}: {
  open: boolean
  item: v1ExternalPublicHolding | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const userId = useAuthStore((s) => s.userId) ?? ''
  // The discovery row uses the trading enum; account list uses the bank
  // enum — both serialize as the same string ("USD" etc), cast across.
  const currency = item?.currency as unknown as bankaBankV1Currency | undefined

  const accounts = useQuery({
    queryKey: keys.account.list({ owner: userId, currency, otc: 'ext-buyer' }),
    queryFn: () =>
      listAccounts({
        ownerClientId: userId,
        currency,
        status: v1AccountStatus.ACCOUNT_STATUS_ACTIVE,
      }),
    enabled: open && Boolean(userId) && Boolean(currency),
  })

  const eligible = useMemo(() => accounts.data?.accounts ?? [], [accounts.data])
  const max = item?.quantity ?? 0

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
      setPricePerUnit(item?.askPrice ?? '')
      setPremium(item?.premium ?? '')
      setSettlementDate('')
      setErr(null)
    }
  }, [open, item?.askPrice, item?.premium])

  useEffect(() => {
    if (!buyerAccountId && eligible.length > 0 && eligible[0].id) {
      setBuyerAccountId(eligible[0].id)
    }
  }, [buyerAccountId, eligible])

  const mut = useMutation({
    mutationFn: () =>
      createExternalOTCOffer({
        remoteBankCode: item?.bankCode ?? '',
        remoteUserRef: item?.sellerUserRef ?? '',
        remoteDisplayName: item?.sellerDisplay ?? '',
        buyerAccountId,
        sellerHoldingId: item?.sellerHoldingId ?? '',
        securityTicker: item?.securityTicker ?? '',
        securityType: item?.securityType ?? v1SecurityType.SECURITY_TYPE_STOCK,
        currency: (item?.currency as unknown as bankaTradingV1Currency) ?? bankaTradingV1Currency.CURRENCY_USD,
        quantity: Number(qty),
        pricePerUnit,
        premium,
        // Pin midnight UTC — see [[yyyymmdd-proto-timestamp]].
        settlementDate: settlementDate ? `${settlementDate}T00:00:00Z` : '',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.externalOtc.all })
      onClose()
    },
    onError: (e) => setErr(apiError(e, 'Greška pri slanju ponude')),
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
      title={`Eksterna ponuda — Banka ${item?.bankCode ?? ''}, ${item?.securityTicker ?? ''}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mut.isPending}>Otkaži</Button>
          <Button
            type="submit"
            form="ext-otc-create-offer-form"
            variant="primary"
            disabled={mut.isPending}
            data-cy="ext-otc-create-offer-submit"
          >
            {mut.isPending ? 'Slanje…' : 'Pošalji ponudu'}
          </Button>
        </>
      }
    >
      <form id="ext-otc-create-offer-form" className="space-y-3" onSubmit={submit}>
        <p className="text-sm text-muted-foreground">
          Prodavac: <span className="font-medium">{item?.sellerDisplay || item?.sellerUserRef || '—'}</span>
          {' · '}
          Dostupno: <span className="tabular-nums">{max}</span>
          {' · '}
          Partner ASK: {formatMoney(item?.askPrice, item?.currency as string)}
        </p>

        <div>
          <Label htmlFor="ext-otc-buyer-account">Račun (za premium i izvršenje)</Label>
          <Select
            id="ext-otc-buyer-account"
            value={buyerAccountId}
            onChange={(e) => setBuyerAccountId(e.target.value)}
            data-cy="ext-otc-buyer-account"
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
            <Label htmlFor="ext-otc-qty">Količina</Label>
            <Input
              id="ext-otc-qty"
              type="number"
              min={1}
              max={max}
              step={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              data-cy="ext-otc-qty"
            />
          </div>
          <div>
            <Label htmlFor="ext-otc-ppu">Cena po komadu</Label>
            <Input
              id="ext-otc-ppu"
              type="number"
              min="0"
              step="0.01"
              value={pricePerUnit}
              onChange={(e) => setPricePerUnit(e.target.value)}
              data-cy="ext-otc-ppu"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ext-otc-premium">Premija</Label>
            <Input
              id="ext-otc-premium"
              type="number"
              min="0"
              step="0.01"
              value={premium}
              onChange={(e) => setPremium(e.target.value)}
              data-cy="ext-otc-premium"
            />
          </div>
          <div>
            <Label htmlFor="ext-otc-settlement">Datum izvršenja</Label>
            <Input
              id="ext-otc-settlement"
              type="date"
              value={settlementDate}
              onChange={(e) => setSettlementDate(e.target.value)}
              data-cy="ext-otc-settlement"
            />
          </div>
        </div>

        {err && <ErrorBanner>{err}</ErrorBanner>}
      </form>
    </Dialog>
  )
}
