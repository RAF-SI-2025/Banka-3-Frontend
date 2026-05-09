// Shared listing-detail body. The route loader prefetches getSecurity
// + (for stocks) getOptionChain so the first paint has data.

import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getSecurity, getOptionChain } from '@/lib/api/securities'
import { getListingHistory } from '@/lib/api/listings'
import { keys } from '@/lib/query-keys'
import { v1SecurityType } from '@/lib/api/generated/models/v1SecurityType'
import { v1OptionType } from '@/lib/api/generated/models/v1OptionType'
import { optionTypeLabel, securityTypeLabel } from '@/lib/labels'
import { currencyLabel, formatDate, formatMoney } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has, hasAny } from '@/lib/permissions'
import { v1Direction } from '@/lib/api/generated/models/v1Direction'
import type { bankaBankV1Currency } from '@/lib/api/generated/models/bankaBankV1Currency'
import { PriceHistoryChart } from './PriceHistoryChart'
import { PriceOverrideDialog } from './PriceOverrideDialog'
import { OrderForm } from './OrderForm'

export interface ListingDetailProps {
  listingId: string
  // Where the option-chain underlying / strike clicks should land.
  basePath: '/portal/trgovina' | '/banking/trgovina'
  // Deep-link defaults for the order form (FE-8 portfolio sell jumps
  // here with ?direction=sell&qty=N).
  initialDirection?: v1Direction.DIRECTION_BUY | v1Direction.DIRECTION_SELL
  initialQuantity?: number
}

const RANGES: { label: string; days: number }[] = [
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: '1G', days: 365 },
]

function isoNDaysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

export function ListingDetail({ listingId, basePath, initialDirection, initialQuantity }: ListingDetailProps) {
  // The route param is the security id; the catalog passes it from
  // the listing-row's nested security.id. The response carries the
  // matching listing payload so history fetches don't need a second
  // round trip.
  const security = useQuery({
    queryKey: keys.security.detail(listingId),
    queryFn: () => getSecurity(listingId),
  })

  const sec = security.data?.security
  const lst = security.data?.listing
  const realListingId = lst?.id

  const [days, setDays] = useState(90)
  const historyArgs = { from: isoNDaysAgo(days), to: isoNDaysAgo(0) }
  const history = useQuery({
    queryKey: keys.listing.history(realListingId ?? listingId),
    queryFn: () => getListingHistory(realListingId!, historyArgs),
    enabled: Boolean(realListingId),
  })

  const isStock = sec?.type === v1SecurityType.SECURITY_TYPE_STOCK
  const perms = useAuthStore((s) => s.permissions)
  const canTrade = hasAny(perms, [Permissions.TradingClient, Permissions.Actuary, Permissions.ActuarySupervisor, Permissions.ActuaryAgent, Permissions.Admin])
  const tradable = sec?.type === v1SecurityType.SECURITY_TYPE_STOCK || sec?.type === v1SecurityType.SECURITY_TYPE_FUTURE
  const showOrderForm = canTrade && tradable && Boolean(sec?.id)
  const contractSize = sec?.contractSize ? Number(sec.contractSize) : (lst?.contractSize ? Number(lst.contractSize) : 1)

  return (
    <main className="container space-y-6 py-8">
      <Link to={basePath} className="text-sm text-muted-foreground hover:text-foreground">
        ← Nazad na katalog
      </Link>

      {security.isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Hartija nije pronađena.
        </div>
      )}

      {sec && (
        <div className="grid gap-6 md:grid-cols-2">
          <InstrumentCard
            security={sec}
            listing={lst}
            maintenanceMargin={security.data?.maintenanceMargin}
            initialMarginCost={security.data?.initialMarginCost}
          />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
              <CardTitle>Istorija cene</CardTitle>
              <div className="flex gap-1">
                {RANGES.map((r) => (
                  <Button
                    key={r.days}
                    type="button"
                    size="sm"
                    variant={days === r.days ? 'primary' : 'secondary'}
                    onClick={() => setDays(r.days)}
                  >
                    {r.label}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {history.isLoading || !realListingId ? (
                <p className="text-sm text-muted-foreground">Učitavanje istorije…</p>
              ) : (history.data?.rows ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nema istorije za izabrani period.</p>
              ) : (
                <PriceHistoryChart rows={history.data!.rows!} />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {showOrderForm && (
        <OrderForm
          securityId={sec!.id!}
          contractSize={Number.isFinite(contractSize) && contractSize > 0 ? contractSize : 1}
          currency={sec!.currency as bankaBankV1Currency | undefined}
          listing={lst}
          initialDirection={initialDirection}
          initialQuantity={initialQuantity}
        />
      )}

      {isStock && sec?.id && <OptionChainCard stockId={sec.id} basePath={basePath} currency={sec.currency} />}
    </main>
  )
}

function InstrumentCard({
  security,
  listing,
  maintenanceMargin,
  initialMarginCost,
}: {
  security: NonNullable<Awaited<ReturnType<typeof getSecurity>>['security']>
  listing?: NonNullable<Awaited<ReturnType<typeof getSecurity>>['listing']>
  maintenanceMargin?: string
  initialMarginCost?: string
}) {
  const ccy = security.currency
  const change = listing?.changeAmt
  const price = listing?.price
  const perms = useAuthStore((s) => s.permissions)
  const isAdmin = has(perms, Permissions.Admin)
  const [overrideOpen, setOverrideOpen] = useState(false)
  const canOverride = isAdmin && Boolean(security.id) && Boolean(listing?.exchangeMic ?? security.exchangeMic) && Boolean(listing?.id)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span className="font-mono">{security.ticker ?? '—'}</span>
          <div className="flex items-center gap-3">
            <span className="text-xs font-normal text-muted-foreground">
              {security.exchangeMic ?? ''}{ccy ? ` · ${currencyLabel(ccy)}` : ''}
            </span>
            {canOverride && (
              <Button type="button" variant="outline" size="sm" data-cy="open-price-override" onClick={() => setOverrideOpen(true)}>
                Izmeni cenu
              </Button>
            )}
          </div>
        </CardTitle>
        {security.name && <p className="text-sm text-muted-foreground">{security.name}</p>}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-semibold">{formatMoney(price, ccy)}</span>
          {change && <span className={Number(change) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{Number(change) >= 0 ? '+' : ''}{change}</span>}
        </div>

        <Row label="Tip">{securityTypeLabel[security.type ?? v1SecurityType.SECURITY_TYPE_UNSPECIFIED]}</Row>
        <Row label="Ask">{formatMoney(listing?.ask, ccy)}</Row>
        <Row label="Bid">{formatMoney(listing?.bid, ccy)}</Row>
        <Row label="Volumen">{listing?.volume ?? '—'}</Row>
        <Row label="Maintenance margin">{formatMoney(maintenanceMargin, ccy)}</Row>
        <Row label="Initial margin cost">{formatMoney(initialMarginCost, ccy)}</Row>

        {security.type === v1SecurityType.SECURITY_TYPE_STOCK && (
          <>
            <Row label="Tržišna kapitalizacija">{formatMoney(security.marketCap, ccy)}</Row>
            <Row label="Broj akcija">{security.outstandingShares ?? '—'}</Row>
            <Row label="Dividend yield">{security.dividendYield ?? '—'}</Row>
          </>
        )}
        {security.type === v1SecurityType.SECURITY_TYPE_FUTURE && (
          <>
            <Row label="Veličina ugovora">{security.contractSize ? `${security.contractSize} ${security.contractUnit ?? ''}`.trim() : '—'}</Row>
            <Row label="Datum izvršenja">{formatDate(security.settlementDate)}</Row>
          </>
        )}
        {security.type === v1SecurityType.SECURITY_TYPE_FOREX && (
          <>
            <Row label="Bazna valuta">{currencyLabel(security.baseCurrency ?? '')}</Row>
            <Row label="Kvotna valuta">{currencyLabel(security.quoteCurrency ?? '')}</Row>
            <Row label="Likvidnost">{security.liquidity ?? '—'}</Row>
          </>
        )}
        {security.type === v1SecurityType.SECURITY_TYPE_OPTION && (
          <>
            <Row label="Tip opcije">
              {security.optionType ? optionTypeLabel[security.optionType] : '—'}
            </Row>
            <Row label="Strike">{formatMoney(security.strikePrice, ccy)}</Row>
            <Row label="Premium">{formatMoney(security.premium, ccy)}</Row>
            <Row label="Implied volatility">{security.impliedVolatility ?? '—'}</Row>
            <Row label="Open interest">{security.openInterest ?? '—'}</Row>
            <Row label="Datum izvršenja">{formatDate(security.settlementDate)}</Row>
            {security.underlyingSecurityId && (
              <Row label="Bazna hartija">
                <UnderlyingLink securityId={security.underlyingSecurityId} />
              </Row>
            )}
          </>
        )}
      </CardContent>

      {canOverride && (
        <PriceOverrideDialog
          open={overrideOpen}
          onClose={() => setOverrideOpen(false)}
          securityId={security.id!}
          exchangeMic={(listing?.exchangeMic ?? security.exchangeMic)!}
          listingId={listing!.id!}
          initial={{ price: listing?.price, ask: listing?.ask, bid: listing?.bid }}
        />
      )}
    </Card>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/40 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  )
}

function UnderlyingLink({ securityId }: { securityId: string }) {
  const q = useQuery({
    queryKey: keys.security.detail(securityId),
    queryFn: () => getSecurity(securityId),
  })
  return <span className="font-mono">{q.data?.security?.ticker ?? securityId}</span>
}

function OptionChainCard({ stockId, basePath, currency }: { stockId: string; basePath: ListingDetailProps['basePath']; currency?: string }) {
  const chain = useQuery({
    queryKey: keys.security.optionChain(stockId, {}),
    queryFn: () => getOptionChain(stockId),
  })

  const groups = useMemo(() => chain.data?.groups ?? [], [chain.data])
  const [picked, setPicked] = useState<string>('')

  const settlementDates = useMemo(() => groups.map((g) => g.settlementDate ?? '').filter(Boolean), [groups])
  const activeDate = picked || settlementDates[0] || ''
  const activeGroup = groups.find((g) => g.settlementDate === activeDate)

  if (!chain.isLoading && groups.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Opcioni lanac</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Nema dostupnih opcija za ovu akciju.</p></CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
        <CardTitle>Opcioni lanac</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Datum izvršenja</span>
          <Select value={activeDate} onChange={(e) => setPicked(e.target.value)} className="w-44">
            {settlementDates.map((d) => (
              <option key={d} value={d}>{formatDate(d)}</option>
            ))}
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {activeGroup && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Cena bazne hartije: {formatMoney(activeGroup.sharedPrice, currency)}
            </p>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 text-left">CALL premium</th>
                  <th className="py-2 text-center">Strike</th>
                  <th className="py-2 text-right">PUT premium</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(activeGroup.rows ?? []).map((row, i) => (
                  <tr key={i}>
                    <td className="py-2 text-left">{row.call ? <OptionLink basePath={basePath} sec={row.call} /> : '—'}</td>
                    <td className="py-2 text-center font-mono">{formatMoney(row.strikePrice, currency)}</td>
                    <td className="py-2 text-right">{row.put ? <OptionLink basePath={basePath} sec={row.put} /> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function OptionLink({ basePath, sec }: { basePath: ListingDetailProps['basePath']; sec: { id?: string; premium?: string; optionType?: v1OptionType } }) {
  const id = sec.id ?? ''
  const text = formatMoney(sec.premium)
  if (basePath === '/portal/trgovina') {
    return <Link to="/portal/trgovina/$listingId" params={{ listingId: id }} className="text-primary hover:underline">{text}</Link>
  }
  return <Link to="/banking/trgovina/$listingId" params={{ listingId: id }} className="text-primary hover:underline">{text}</Link>
}
