// Shared catalog body for /portal/trgovina and /banking/trgovina.
// Drives v1/securities (with-listing join) — has the rich filter/sort
// surface the spec asks for. Tabs map to v1SecurityType. Client surface
// hides the Forex + Opcije tabs by passing showForexAndOptions=false;
// gateway also enforces, so this is a UX-only soft gate.

import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { listSecurities } from '@/lib/api/securities'
import { listExchanges } from '@/lib/api/exchanges'
import { keys } from '@/lib/query-keys'
import { v1SecurityType } from '@/lib/api/generated/models/v1SecurityType'
import { optionTypeLabel, securityTypeLabel } from '@/lib/labels'
import { currencyLabel, formatDate, formatMoney } from '@/lib/format'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { DEFAULT_FILTERS, filtersToQuery, type CatalogFilters } from './listings-filters'

export interface ListingsTableProps {
  // Where row clicks land. Same path layout under both portal + banking.
  basePath: '/portal/trgovina' | '/banking/trgovina'
  // Clients can't see Forex / Opcije in the spec.
  showForexAndOptions: boolean
}

const ALL_TABS: { kind: v1SecurityType; label: string }[] = [
  { kind: v1SecurityType.SECURITY_TYPE_STOCK, label: 'Akcije' },
  { kind: v1SecurityType.SECURITY_TYPE_FUTURE, label: 'Futures' },
  { kind: v1SecurityType.SECURITY_TYPE_FOREX, label: 'Forex' },
  { kind: v1SecurityType.SECURITY_TYPE_OPTION, label: 'Opcije' },
]

export function ListingsTable({ basePath, showForexAndOptions }: ListingsTableProps) {
  const navigate = useNavigate()
  const tabs = useMemo(
    () => (showForexAndOptions ? ALL_TABS : ALL_TABS.filter((t) => t.kind === v1SecurityType.SECURITY_TYPE_STOCK || t.kind === v1SecurityType.SECURITY_TYPE_FUTURE)),
    [showForexAndOptions],
  )

  const [filters, setFilters] = useState<CatalogFilters>({
    type: tabs[0].kind,
    ...DEFAULT_FILTERS,
  })

  const exchanges = useQuery({ queryKey: keys.exchange.list(), queryFn: listExchanges })

  const args = filtersToQuery(filters)
  const securities = useQuery({
    queryKey: keys.security.list(args),
    queryFn: () => listSecurities(args),
  })

  const setKind = (k: v1SecurityType) => {
    // Reset paging and kind-specific filters when switching tabs; preserves
    // the sort/exchange/search the user typed.
    setFilters((prev) => ({
      ...prev,
      type: k,
      page: 1,
      minSettlement: '',
      maxSettlement: '',
    }))
  }

  const update = <K extends keyof CatalogFilters>(key: K, value: CatalogFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }

  const showSettlement =
    filters.type === v1SecurityType.SECURITY_TYPE_FUTURE ||
    filters.type === v1SecurityType.SECURITY_TYPE_OPTION
  // Ask/Bid columns only exist on the listing rows the catalog joins
  // in (stocks/futures/forex have a listing). Options carry only
  // premium on the security row, so the spec p.58 ask/bid range
  // filters are inert for them — hide rather than mislead.
  const showAskBid = filters.type !== v1SecurityType.SECURITY_TYPE_OPTION

  const items = securities.data?.items ?? []

  return (
    <main className="container space-y-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold">Trgovina</h1>
        <p className="text-sm text-muted-foreground">
          Berze, hartije, kursevi i likvidnost.
        </p>
      </header>

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.kind}
            type="button"
            data-cy={`tab-${t.kind}`}
            onClick={() => setKind(t.kind)}
            className={
              'rounded-t-md px-4 py-2 text-sm transition-colors ' +
              (filters.type === t.kind
                ? 'bg-surface text-foreground border-b-2 border-primary font-medium'
                : 'text-muted-foreground hover:text-foreground')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-6">
        <div className="md:col-span-2">
          <Label>Pretraga</Label>
          <Input
            data-cy="filter-search"
            placeholder="Ticker ili naziv"
            value={filters.search}
            onChange={(e) => update('search', e.target.value)}
          />
        </div>
        <div>
          <Label>Berza</Label>
          <Select
            data-cy="filter-exchange"
            value={filters.exchangeMic}
            onChange={(e) => update('exchangeMic', e.target.value)}
          >
            <option value="">Sve</option>
            {(exchanges.data?.exchanges ?? []).map((x) => (
              <option key={x.mic} value={x.mic}>
                {x.acronym ?? x.mic}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Sortiraj po</Label>
          <Select
            data-cy="filter-sort"
            value={filters.sortBy}
            onChange={(e) => update('sortBy', e.target.value as CatalogFilters['sortBy'])}
          >
            <option value="price">Cena</option>
            <option value="volume">Volumen</option>
            <option value="maintenance_margin">Maint. margin</option>
          </Select>
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            variant="secondary"
            data-cy="filter-sort-dir"
            onClick={() => update('sortDesc', !filters.sortDesc)}
          >
            {filters.sortDesc ? '↓ Opadajuće' : '↑ Rastuće'}
          </Button>
        </div>

        <div>
          <Label>Min. cena</Label>
          <Input
            type="number"
            value={filters.minPrice}
            onChange={(e) => update('minPrice', e.target.value)}
          />
        </div>
        <div>
          <Label>Max. cena</Label>
          <Input
            type="number"
            value={filters.maxPrice}
            onChange={(e) => update('maxPrice', e.target.value)}
          />
        </div>
        <div>
          <Label>Min. volumen</Label>
          <Input
            type="number"
            value={filters.minVolume}
            onChange={(e) => update('minVolume', e.target.value)}
          />
        </div>
        <div>
          <Label>Max. volumen</Label>
          <Input
            type="number"
            value={filters.maxVolume}
            onChange={(e) => update('maxVolume', e.target.value)}
          />
        </div>
        {showAskBid && (
          <>
            <div>
              <Label>Min. ask</Label>
              <Input
                type="number"
                data-cy="filter-min-ask"
                value={filters.minAsk}
                onChange={(e) => update('minAsk', e.target.value)}
              />
            </div>
            <div>
              <Label>Max. ask</Label>
              <Input
                type="number"
                data-cy="filter-max-ask"
                value={filters.maxAsk}
                onChange={(e) => update('maxAsk', e.target.value)}
              />
            </div>
            <div>
              <Label>Min. bid</Label>
              <Input
                type="number"
                data-cy="filter-min-bid"
                value={filters.minBid}
                onChange={(e) => update('minBid', e.target.value)}
              />
            </div>
            <div>
              <Label>Max. bid</Label>
              <Input
                type="number"
                data-cy="filter-max-bid"
                value={filters.maxBid}
                onChange={(e) => update('maxBid', e.target.value)}
              />
            </div>
          </>
        )}
        {showSettlement && (
          <>
            <div>
              <Label>Datum od</Label>
              <Input
                type="date"
                value={filters.minSettlement}
                onChange={(e) => update('minSettlement', e.target.value)}
              />
            </div>
            <div>
              <Label>Datum do</Label>
              <Input
                type="date"
                value={filters.maxSettlement}
                onChange={(e) => update('maxSettlement', e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      {securities.isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Greška pri učitavanju kataloga.
        </div>
      )}

      <Table>
        <THead>
          <TR>{columnsForKind(filters.type).map((c) => <TH key={c}>{c}</TH>)}</TR>
        </THead>
        <TBody>
          {items.length === 0 ? (
            <EmptyRow colSpan={columnsForKind(filters.type).length}>
              {securities.isFetching ? 'Učitavanje…' : 'Nema rezultata'}
            </EmptyRow>
          ) : (
            items.map((row) => {
              const sec = row.security!
              // Route param feeds GetSecurity, which is keyed by
              // security id. The matching listing comes back inside
              // the envelope so the detail page doesn't need a second
              // round trip.
              const id = sec.id!
              const goDetail = () => {
                if (basePath === '/portal/trgovina') {
                  navigate({ to: '/portal/trgovina/$listingId', params: { listingId: id } })
                } else {
                  navigate({ to: '/banking/trgovina/$listingId', params: { listingId: id } })
                }
              }
              return (
                <TR key={sec.id} onClick={goDetail}>
                  {renderCells(filters.type, row)}
                </TR>
              )
            })
          )}
        </TBody>
      </Table>

      <Pager
        page={filters.page}
        pageSize={filters.pageSize}
        total={Number(securities.data?.total ?? 0)}
        onChange={(p) => setFilters((prev) => ({ ...prev, page: p }))}
      />
    </main>
  )
}

function columnsForKind(k: v1SecurityType): string[] {
  switch (k) {
    case v1SecurityType.SECURITY_TYPE_STOCK:
      return ['Ticker', 'Naziv', 'Cena', 'Volumen', 'Tržišna kap.', 'Maint. margin']
    case v1SecurityType.SECURITY_TYPE_FUTURE:
      return ['Ticker', 'Naziv', 'Cena', 'Volumen', 'Veličina ugovora', 'Datum izvršenja']
    case v1SecurityType.SECURITY_TYPE_FOREX:
      return ['Par', 'Cena', 'Ask', 'Bid', 'Likvidnost']
    case v1SecurityType.SECURITY_TYPE_OPTION:
      return ['Ticker', 'Tip', 'Strike', 'Premium', 'IV', 'Datum izvršenja']
    default:
      return ['—']
  }
}

function renderCells(k: v1SecurityType, row: { security?: { ticker?: string; name?: string; type?: v1SecurityType; baseCurrency?: string; quoteCurrency?: string; contractSize?: string; contractUnit?: string; settlementDate?: string; marketCap?: string; currency?: string; liquidity?: string; optionType?: string; strikePrice?: string; premium?: string; impliedVolatility?: string }; listing?: { price?: string; ask?: string; bid?: string; volume?: string }; maintenanceMargin?: string }) {
  const sec = row.security ?? {}
  const lst = row.listing ?? {}
  const ccy = sec.currency
  switch (k) {
    case v1SecurityType.SECURITY_TYPE_STOCK:
      return (
        <>
          <TD className="font-mono font-medium">{sec.ticker ?? '—'}</TD>
          <TD>{sec.name ?? '—'}</TD>
          <TD>{formatMoney(lst.price, ccy)}</TD>
          <TD>{lst.volume ?? '—'}</TD>
          <TD>{formatMoney(sec.marketCap, ccy)}</TD>
          <TD>{formatMoney(row.maintenanceMargin, ccy)}</TD>
        </>
      )
    case v1SecurityType.SECURITY_TYPE_FUTURE:
      return (
        <>
          <TD className="font-mono font-medium">{sec.ticker ?? '—'}</TD>
          <TD>{sec.name ?? '—'}</TD>
          <TD>{formatMoney(lst.price, ccy)}</TD>
          <TD>{lst.volume ?? '—'}</TD>
          <TD>{sec.contractSize ? `${sec.contractSize} ${sec.contractUnit ?? ''}`.trim() : '—'}</TD>
          <TD>{formatDate(sec.settlementDate)}</TD>
        </>
      )
    case v1SecurityType.SECURITY_TYPE_FOREX:
      return (
        <>
          <TD className="font-mono font-medium">
            {currencyLabel(sec.baseCurrency ?? '')}/{currencyLabel(sec.quoteCurrency ?? '')}
          </TD>
          <TD>{formatMoney(lst.price)}</TD>
          <TD>{formatMoney(lst.ask)}</TD>
          <TD>{formatMoney(lst.bid)}</TD>
          <TD>{sec.liquidity ?? '—'}</TD>
        </>
      )
    case v1SecurityType.SECURITY_TYPE_OPTION:
      return (
        <>
          <TD className="font-mono font-medium">{sec.ticker ?? '—'}</TD>
          <TD>{sec.optionType ? optionTypeLabel[sec.optionType as keyof typeof optionTypeLabel] : '—'}</TD>
          <TD>{formatMoney(sec.strikePrice, ccy)}</TD>
          <TD>{formatMoney(sec.premium, ccy)}</TD>
          <TD>{sec.impliedVolatility ?? '—'}</TD>
          <TD>{formatDate(sec.settlementDate)}</TD>
        </>
      )
    default:
      return <TD>{securityTypeLabel[k]}</TD>
  }
}

function Pager({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number
  pageSize: number
  total: number
  onChange: (p: number) => void
}) {
  const last = Math.max(1, Math.ceil(total / pageSize))
  if (last <= 1) return null
  return (
    <div className="flex items-center justify-end gap-3 text-sm">
      <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Prethodna
      </Button>
      <span className="text-muted-foreground">
        Strana {page} / {last}
      </span>
      <Button type="button" variant="secondary" disabled={page >= last} onClick={() => onChange(page + 1)}>
        Sledeća
      </Button>
    </div>
  )
}
