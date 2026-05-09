// Spec p.53-56 order placement. Single component, branched off
// userKind+permissions; FE-10 extends it for actuaries rather than
// forking. No verification — orders aren't on the spec p.11 list.

import { useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listAccounts } from '@/lib/api/accounts'
import { quoteExchange } from '@/lib/api/payments'
import { placeOrder } from '@/lib/api/orders'
import { apiError } from '@/lib/api/error'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { v1Direction } from '@/lib/api/generated/models/v1Direction'
import { v1AccountStatus } from '@/lib/api/generated/models/v1AccountStatus'
import { bankaBankV1Currency } from '@/lib/api/generated/models/bankaBankV1Currency'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ErrorBanner } from '@/components/ui/error'
import { currencyLabel, formatMoney } from '@/lib/format'
import { deriveOrderType } from '@/lib/trading/order-type'
import { computeCommission, pricePerUnitForType } from '@/lib/trading/commission'
import { orderFormSchema, type OrderFormValues } from './order-form-schema'

type Side = v1Direction.DIRECTION_BUY | v1Direction.DIRECTION_SELL

interface OrderFormProps {
  securityId: string
  contractSize: number
  currency: bankaBankV1Currency | string | undefined
  listing: { price?: string; ask?: string; bid?: string } | undefined
  // Used when navigating from portfolio sell deep-link.
  initialDirection?: Side
  initialQuantity?: number
}

export function OrderForm({
  securityId,
  contractSize,
  currency,
  listing,
  initialDirection,
  initialQuantity,
}: OrderFormProps) {
  const qc = useQueryClient()
  const userId = useAuthStore((s) => s.userId)

  const accounts = useQuery({
    queryKey: keys.account.list({ ownerClientId: userId }),
    queryFn: () => listAccounts({ ownerClientId: userId ?? undefined }),
    enabled: Boolean(userId),
  })

  // For commission-cap conversion ($7/$12-eq → listing currency).
  const usdToCcy = useQuery({
    queryKey: ['trading-quote-usd', currency ?? ''],
    queryFn: () =>
      quoteExchange({
        from: bankaBankV1Currency.CURRENCY_USD,
        to: (currency ?? bankaBankV1Currency.CURRENCY_USD) as bankaBankV1Currency,
        amount: '1',
        includeCommission: false,
      }),
    enabled: Boolean(currency),
  })

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      direction: initialDirection ?? v1Direction.DIRECTION_BUY,
      quantity: initialQuantity ? String(initialQuantity) : '',
      limitPrice: '',
      stopPrice: '',
      allOrNone: false,
      margin: false,
      accountId: '',
    },
  })

  const watched = form.watch()
  const direction = watched.direction
  const side: 'buy' | 'sell' = direction === v1Direction.DIRECTION_SELL ? 'sell' : 'buy'
  const orderType = deriveOrderType(watched.limitPrice, watched.stopPrice)
  const qty = Number(watched.quantity || 0)
  const ppu = pricePerUnitForType(orderType, side, listing ?? {}, watched.limitPrice, watched.stopPrice)
  const approx = ppu !== null && qty > 0 ? ppu * contractSize * qty : null

  const usdInCcy = usdToCcy.data ? Number(usdToCcy.data.toAmount ?? '0') : 0
  const commission = approx !== null && usdInCcy > 0 ? computeCommission(orderType, approx, usdInCcy) : null
  const totalDue = approx !== null && commission !== null ? approx + commission : null

  // Filter the source-account list per spec p.55: SELL only allows
  // accounts in the listing currency; BUY allows any active account
  // (cross-currency previewed against approx via listing-ccy
  // conversion at fill commit, not at placement).
  const eligibleAccounts = useMemo(() => {
    const items = accounts.data?.accounts ?? []
    return items.filter((a) => {
      if (a.status !== v1AccountStatus.ACCOUNT_STATUS_ACTIVE) return false
      if (side === 'sell') return a.currency === currency
      return true
    })
  }, [accounts.data, side, currency])

  // Reset accountId when the eligible set changes (e.g. user flips
  // BUY ↔ SELL and the previously selected account becomes ineligible).
  useEffect(() => {
    const cur = form.getValues('accountId')
    if (cur && !eligibleAccounts.find((a) => a.id === cur)) {
      form.setValue('accountId', '')
    }
  }, [eligibleAccounts, form])

  const place = useMutation({
    mutationFn: (v: OrderFormValues) =>
      placeOrder({
        securityId,
        direction: v.direction,
        orderType: deriveOrderType(v.limitPrice, v.stopPrice),
        quantity: Number(v.quantity),
        limitPrice: v.limitPrice || undefined,
        stopPrice: v.stopPrice || undefined,
        allOrNone: v.allOrNone,
        margin: v.margin,
        accountId: v.accountId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.order.all })
      qc.invalidateQueries({ queryKey: keys.portfolio.all })
      form.reset({ ...form.getValues(), quantity: '', limitPrice: '', stopPrice: '' })
    },
  })

  const errMsg = place.error ? apiError(place.error, 'Greška pri slanju naloga.') : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trgovina</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          <form
            id="order-form"
            className="space-y-3"
            onSubmit={form.handleSubmit((v) => place.mutate(v))}
          >
            <div>
              <Label>Smer</Label>
              <Controller
                control={form.control}
                name="direction"
                render={({ field }) => (
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        value={v1Direction.DIRECTION_BUY}
                        checked={field.value === v1Direction.DIRECTION_BUY}
                        onChange={() => field.onChange(v1Direction.DIRECTION_BUY)}
                      />
                      Kupovina
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        value={v1Direction.DIRECTION_SELL}
                        checked={field.value === v1Direction.DIRECTION_SELL}
                        onChange={() => field.onChange(v1Direction.DIRECTION_SELL)}
                      />
                      Prodaja
                    </label>
                  </div>
                )}
              />
            </div>

            <div>
              <Label htmlFor="of-qty">Količina</Label>
              <Input id="of-qty" inputMode="numeric" {...form.register('quantity')} />
              {form.formState.errors.quantity && (
                <p className="mt-1 text-xs text-destructive">{form.formState.errors.quantity.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="of-limit">Limit cena (opc.)</Label>
                <Input id="of-limit" inputMode="decimal" {...form.register('limitPrice')} />
              </div>
              <div>
                <Label htmlFor="of-stop">Stop cena (opc.)</Label>
                <Input id="of-stop" inputMode="decimal" {...form.register('stopPrice')} />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" {...form.register('allOrNone')} />
                AON (sve ili ništa)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" {...form.register('margin')} />
                Margin
              </label>
            </div>

            <div>
              <Label htmlFor="of-acct">Račun</Label>
              <Select id="of-acct" {...form.register('accountId')}>
                <option value="">— izaberi —</option>
                {eligibleAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.number ?? a.id} · {currencyLabel(a.currency ?? '')} · raspoloživo {a.availableBalance ?? '0'}
                  </option>
                ))}
              </Select>
              {form.formState.errors.accountId && (
                <p className="mt-1 text-xs text-destructive">{form.formState.errors.accountId.message}</p>
              )}
              {side === 'sell' && eligibleAccounts.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Nemate aktivan račun u valuti hartije ({currencyLabel(currency ?? '')}). Promenite smer ili otvorite račun.
                </p>
              )}
            </div>

            {errMsg && <ErrorBanner>{errMsg}</ErrorBanner>}

            <Button
              type="submit"
              disabled={place.isPending}
              data-cy="order-submit"
            >
              {place.isPending ? 'Šaljem…' : 'Pošalji nalog'}
            </Button>
          </form>

          <PreviewPanel
            ppu={ppu}
            qty={qty}
            contractSize={contractSize}
            approx={approx}
            commission={commission}
            totalDue={totalDue}
            currency={currency}
            orderType={orderType}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function PreviewPanel({
  ppu,
  qty,
  contractSize,
  approx,
  commission,
  totalDue,
  currency,
  orderType,
}: {
  ppu: number | null
  qty: number
  contractSize: number
  approx: number | null
  commission: number | null
  totalDue: number | null
  currency: OrderFormProps['currency']
  orderType: ReturnType<typeof deriveOrderType>
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted/40 p-4 text-sm">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pregled</h4>
      <dl className="mt-2 space-y-2">
        <Item label="Tip naloga">{shortType(orderType)}</Item>
        <Item label="Cena po jedinici">{ppu !== null ? formatMoney(String(ppu), currency) : '—'}</Item>
        <Item label="Veličina ugovora">{contractSize}</Item>
        <Item label="Količina">{qty || '—'}</Item>
        <Item label="Approx. vrednost">{approx !== null ? formatMoney(String(approx), currency) : '—'}</Item>
        <Item label="Provizija">{commission !== null ? formatMoney(String(commission), currency) : '—'}</Item>
        <Item label="Ukupno">{totalDue !== null ? formatMoney(String(totalDue), currency) : '—'}</Item>
      </dl>
    </div>
  )
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}

function shortType(t: ReturnType<typeof deriveOrderType>): string {
  switch (t) {
    case 'ORDER_TYPE_MARKET': return 'Tržišni'
    case 'ORDER_TYPE_LIMIT': return 'Limit'
    case 'ORDER_TYPE_STOP': return 'Stop'
    case 'ORDER_TYPE_STOP_LIMIT': return 'Stop-Limit'
    default: return '—'
  }
}
