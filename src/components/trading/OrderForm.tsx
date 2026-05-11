// Spec p.53-56 order placement. Single component, branched off
// userKind+permissions. No verification — orders aren't on the
// spec p.11 list.

import { useEffect, useMemo, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listAccounts } from '@/lib/api/accounts'
import { quoteExchange } from '@/lib/api/payments'
import { placeOrder } from '@/lib/api/orders'
import { getActuaryInfo } from '@/lib/api/actuaries'
import { apiError } from '@/lib/api/error'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { deriveActor, projectLimit } from '@/lib/trading/actor'
import { FOREX_BOOK_OWNER_ID } from '@/lib/trading/sentinels'
import { v1Direction } from '@/lib/api/generated/models/v1Direction'
import { v1AccountStatus } from '@/lib/api/generated/models/v1AccountStatus'
import { v1AccountKind } from '@/lib/api/generated/models/v1AccountKind'
import { bankaBankV1Currency } from '@/lib/api/generated/models/bankaBankV1Currency'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
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
  // Spec p.50: futures/options past their settlement date are
  // server-rejected at create *and* approve. Surfacing locally so the
  // submit button disables before the round-trip.
  settlementDate?: string
  // Used when navigating from portfolio sell deep-link.
  initialDirection?: Side
  initialQuantity?: number
  // Spec p.57 / C3-tests scenario 45-47: pre-submit market-state notice
  // so the user is warned before clicking Pošalji nalog when the
  // exchange is closed or in after-hours. Resolved by ListingDetail
  // from the exchange list keyed by MIC; undefined means "not loaded
  // yet / unknown" — no notice rendered.
  marketState?: { isOpen?: boolean; isAfterHours?: boolean }
}

export function OrderForm({
  securityId,
  contractSize,
  currency,
  listing,
  settlementDate,
  initialDirection,
  initialQuantity,
  marketState,
}: OrderFormProps) {
  const qc = useQueryClient()
  const userId = useAuthStore((s) => s.userId)
  const perms = useAuthStore((s) => s.permissions)

  const actor = useMemo(() => deriveActor(perms), [perms])
  const { canMargin, isActuary, showLimitPanel } = actor

  // Spec p.55-56: clients trade from their own accounts, actuaries
  // (employees + admins via the role bundle) trade on behalf of the
  // bank using its per-currency forex_book accounts. The forex_book
  // owner_client_id is a sentinel; the bank service's trade_settle
  // refuses non-bank accounts when IsActuary, so this branch is the
  // only path that produces a working actuary order. Bank-side
  // ListAccounts hides forex_book from the default kind=UNSPECIFIED
  // path, so actuaries narrow to that kind explicitly.
  const ownerForList = isActuary ? FOREX_BOOK_OWNER_ID : (userId ?? undefined)
  const kindForList = isActuary ? v1AccountKind.ACCOUNT_KIND_FOREX_BOOK : undefined
  const accounts = useQuery({
    queryKey: keys.account.list({ ownerClientId: ownerForList ?? '', kind: kindForList ?? '' }),
    queryFn: () => listAccounts({ ownerClientId: ownerForList, kind: kindForList }),
    enabled: Boolean(ownerForList),
  })

  // For commission-cap conversion ($7/$12-eq → listing currency).
  // Skip the round-trip when the listing already trades in USD; the
  // server returns a tautological 1.0 either way.
  const isUsd = currency === bankaBankV1Currency.CURRENCY_USD
  const usdToCcy = useQuery({
    queryKey: ['trading-quote-usd', currency ?? ''],
    queryFn: () =>
      quoteExchange({
        from: bankaBankV1Currency.CURRENCY_USD,
        to: (currency ?? bankaBankV1Currency.CURRENCY_USD) as bankaBankV1Currency,
        amount: '1',
        includeCommission: false,
      }),
    enabled: Boolean(currency) && !isUsd,
  })

  // For agent limit panel: convert listing-ccy → RSD per spec p.38
  // (no commission). Quote 1 unit then multiply locally so we don't
  // refire on every keystroke.
  const isRsd = currency === bankaBankV1Currency.CURRENCY_RSD
  const ccyToRsd = useQuery({
    queryKey: ['trading-quote-rsd-1', currency ?? ''],
    queryFn: () =>
      quoteExchange({
        from: (currency ?? bankaBankV1Currency.CURRENCY_RSD) as bankaBankV1Currency,
        to: bankaBankV1Currency.CURRENCY_RSD,
        amount: '1',
        includeCommission: false,
      }),
    enabled: showLimitPanel && Boolean(currency) && !isRsd,
  })

  const actuary = useQuery({
    queryKey: keys.actuary.detail(userId ?? ''),
    queryFn: () => getActuaryInfo(userId!),
    enabled: showLimitPanel && Boolean(userId),
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
  const ppu = pricePerUnitForType(orderType, side, listing ?? {}, watched.limitPrice)
  const approx = ppu !== null && qty > 0 ? ppu * contractSize * qty : null

  const usdInCcy = isUsd ? 1 : usdToCcy.data ? Number(usdToCcy.data.toAmount ?? '0') : 0
  const commission = approx !== null && usdInCcy > 0 ? computeCommission(orderType, approx, usdInCcy) : null
  const totalDue = approx !== null && commission !== null ? approx + commission : null

  // Limit projection: convert approx (listing ccy) → RSD without
  // commission, add to current usedLimit, compare against dailyLimit.
  const rsdPerCcy = isRsd ? 1 : ccyToRsd.data ? Number(ccyToRsd.data.toAmount ?? '0') : null
  const projection = projectLimit({
    dailyLimit: Number(actuary.data?.dailyLimit ?? '0'),
    usedLimit: Number(actuary.data?.usedLimit ?? '0'),
    needApproval: Boolean(actuary.data?.needApproval),
    approxCcy: approx,
    rsdPerCcy,
  })
  const willNeedApproval = showLimitPanel && projection.willNeedApproval

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

  // Spec p.50: futures/options past their settlement date are
  // server-rejected. Snap to a date-only comparison so a security
  // settling later today still passes — the backend uses the same
  // "on/before today" semantics.
  const settlementPast = useMemo(() => {
    if (!settlementDate) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const sd = new Date(settlementDate)
    if (Number.isNaN(sd.getTime())) return false
    sd.setHours(0, 0, 0, 0)
    return sd.getTime() <= today.getTime()
  }, [settlementDate])

  // Spec p.56 "Uvek tražiti još jednu konfirmaciju od korisnika":
  // submit opens a Pregled kupovine modal; the mutation only fires
  // after the user clicks Potvrdi inside the dialog.
  const [pending, setPending] = useState<OrderFormValues | null>(null)
  // Spec p.57 "Obavestiti korisnika ako je berza zatvorena": the
  // server still places the order but flags exchange_closed. We hold
  // it here so the dialog can show one notice across the success
  // moment and the next render.
  const [exchangeClosedNotice, setExchangeClosedNotice] = useState(false)

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
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: keys.order.all })
      qc.invalidateQueries({ queryKey: keys.portfolio.all })
      qc.invalidateQueries({ queryKey: keys.actuary.detail(userId ?? '') })
      form.reset({ ...form.getValues(), quantity: '', limitPrice: '', stopPrice: '' })
      setPending(null)
      setExchangeClosedNotice(Boolean(resp.exchangeClosed))
    },
  })

  function closeConfirm() {
    if (place.isPending) return
    setPending(null)
    place.reset()
  }

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
            onSubmit={form.handleSubmit((v) => {
              // Belt-and-braces: re-validate against the eligible
              // accounts set at submit time. The select clears stale
              // ids on render, but a paste / programmatic value or a
              // race between BUY↔SELL flip and submit could otherwise
              // sneak past.
              if (!eligibleAccounts.find((a) => a.id === v.accountId)) {
                form.setError('accountId', { message: 'Račun nije među dozvoljenim za ovaj nalog.' })
                return
              }
              if (settlementPast) return
              place.reset()
              setExchangeClosedNotice(false)
              setPending(v)
            })}
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
              {canMargin && (
                <label className="flex items-center gap-2" data-cy="margin-toggle">
                  <input type="checkbox" {...form.register('margin')} />
                  Margin
                </label>
              )}
            </div>
            {canMargin && (
              <p className="text-xs text-muted-foreground">
                {isActuary
                  ? 'Margin nalog: potrebno je raspoloživo na računu bar IMC.'
                  : 'Margin nalog: potrebno je raspoloživo bar IMC ILI odobreni kredit s preostalim ≥ IMC.'}
              </p>
            )}

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

            {showLimitPanel && (
              <LimitUtilization
                used={projection.used}
                daily={projection.daily}
                projected={projection.projectedUsed}
                rsdEquivalent={projection.rsdEquivalent}
                isLoading={actuary.isLoading || ccyToRsd.isLoading}
              />
            )}
            {willNeedApproval && (
              <div data-cy="needs-approval">
                <Badge tone="yellow">⏳ Ovaj nalog ide na odobrenje supervizoru</Badge>
              </div>
            )}

            {settlementPast && (
              <div
                className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
                data-cy="settlement-past"
              >
                Datum izvršenja hartije je prošao — nalog se ne može plasirati.
              </div>
            )}

            {marketState?.isOpen === false && !marketState.isAfterHours && (
              <div
                className="rounded-md border border-warning/40 bg-warning-soft p-2 text-xs"
                data-cy="exchange-closed-warning"
              >
                Berza je trenutno zatvorena. Nalog možete poslati, ali biće izvršen tek kada se trgovina nastavi.
              </div>
            )}

            {marketState?.isAfterHours === true && (
              <div
                className="rounded-md border border-warning/40 bg-warning-soft p-2 text-xs"
                data-cy="exchange-after-hours-warning"
              >
                Berza je u after-hours periodu. Nalozi se izvršavaju sporije nego u redovnom radnom vremenu.
              </div>
            )}

            {exchangeClosedNotice && (
              <div
                className="rounded-md border border-warning/40 bg-warning-soft p-2 text-xs"
                data-cy="exchange-closed-notice"
              >
                Berza je trenutno zatvorena. Nalog je primljen i biće izvršen kada se trgovina nastavi.
              </div>
            )}

            <Button
              type="submit"
              data-cy="order-submit"
              disabled={settlementPast}
            >
              Pošalji nalog
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

      <Dialog
        open={pending !== null}
        onClose={closeConfirm}
        title="Pregled kupovine"
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={closeConfirm}
              disabled={place.isPending}
              data-cy="order-confirm-cancel"
            >
              Otkaži
            </Button>
            <Button
              type="button"
              onClick={() => pending && place.mutate(pending)}
              disabled={place.isPending}
              data-cy="order-confirm-submit"
            >
              {place.isPending ? 'Šaljem…' : 'Potvrdi'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm" data-cy="order-confirm-dialog">
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
          {pending && (
            <p className="text-xs text-muted-foreground">
              Smer: {pending.direction === v1Direction.DIRECTION_BUY ? 'Kupovina' : 'Prodaja'}
              {pending.allOrNone ? ' · AON' : ''}
              {pending.margin ? ' · Margin' : ''}
            </p>
          )}
          {willNeedApproval && (
            <Badge tone="yellow">⏳ Ovaj nalog ide na odobrenje supervizoru</Badge>
          )}
          {errMsg && <ErrorBanner>{errMsg}</ErrorBanner>}
        </div>
      </Dialog>
    </Card>
  )
}

function LimitUtilization({
  used,
  daily,
  projected,
  rsdEquivalent,
  isLoading,
}: {
  used: number
  daily: number
  projected: number
  rsdEquivalent: number | null
  isLoading: boolean
}) {
  const cap = daily > 0 ? Math.min(100, Math.round((projected / daily) * 100)) : 0
  const usedPct = daily > 0 ? Math.min(100, Math.round((used / daily) * 100)) : 0
  return (
    <div className="rounded-md border border-border bg-surface-muted/40 p-3 text-sm" data-cy="limit-panel">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Dnevni limit (agent)</span>
        <span className="font-mono text-xs">
          {isLoading ? '…' : `${used.toFixed(2)} / ${daily.toFixed(2)} RSD`}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary/30" style={{ width: `${usedPct}%` }} />
        <div className="-mt-2 h-2 bg-warning-soft" style={{ width: `${Math.max(0, cap - usedPct)}%`, marginLeft: `${usedPct}%` }} />
      </div>
      {rsdEquivalent !== null && (
        <p className="mt-2 text-xs text-muted-foreground">
          Ovaj nalog: ~{rsdEquivalent.toFixed(2)} RSD · projektovano iskorišćeno: {projected.toFixed(2)} RSD
        </p>
      )}
    </div>
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
