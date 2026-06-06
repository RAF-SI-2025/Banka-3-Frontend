import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { listPublicHoldings } from '@/lib/api/otc'
import { keys } from '@/lib/query-keys'
import { formatMoney, formatDateTime } from '@/lib/format'
import { securityTypeLabel } from '@/lib/labels'
import { v1SecurityType } from '@/lib/api/generated/models/v1SecurityType'
import { bankaTradingV1UserKind } from '@/lib/api/generated/models/bankaTradingV1UserKind'
import { CreateOTCOfferDialog } from './CreateOTCOfferDialog'
import { OTCSuggestionsPanel } from './OTCSuggestionsPanel'
import type { v1PublicHoldingItem } from '@/lib/api/generated/models/v1PublicHoldingItem'

// Shared OTC discovery board. Spec p.67 ("OTC portal"): the layout is
// "identičan kao u Portalu za Hartije od vrednosti" — Security / Name /
// Symbol / Amount / Price / Last updated / Owner / (Napravi ponudu).
//
// The backend scopes the rows by peer kind (clients see only client-side
// public holdings, supervisors only actuary/employee-side — spec p.79),
// so the only kind-dependent thing the FE renders is the Owner column:
// per spec p.67 an actuary holding is owned "in the name of the bank",
// so the supervisor view shows the bank there ("Za supervizore" →
// "Banka 1") while the client view shows the seller's name. The backend
// already resolves seller_display_name to the bank for employee-kind
// rows; this just picks the right value + a stable data-cy for tests.
function ownerLabel(it: v1PublicHoldingItem): string {
  const name = it.sellerDisplayName?.trim()
  if (name) return name
  // Defensive fallback if the resolver came back empty (minimal dev
  // stack with no user-service wiring): still distinguish the two
  // sides so the board is never ambiguous about whose offer it is.
  return it.sellerKind === bankaTradingV1UserKind.USER_KIND_EMPLOYEE
    ? 'Banka'
    : '—'
}

export function OTCDiscovery() {
  const [ticker, setTicker] = useState('')
  const [chosen, setChosen] = useState<v1PublicHoldingItem | null>(null)

  const args = useMemo(() => ({ ticker: ticker.trim() || undefined }), [ticker])
  const discovery = useQuery({
    queryKey: keys.otc.discovery(args),
    queryFn: () => listPublicHoldings(args),
    // The seller's reservation count shifts when others post offers
    // against the same holding; keep the board fresh.
    refetchInterval: 15_000,
  })

  const items = discovery.data?.items ?? []

  return (
    <main className="container space-y-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold">OTC trgovina</h1>
        <p className="text-sm text-muted-foreground">
          Hartije koje drugi korisnici nude vansistemski. Pošaljite ponudu da pokrenete pregovaranje.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="otc-discovery-ticker">Ticker</Label>
              <Input
                id="otc-discovery-ticker"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="npr. AAPL"
                data-cy="otc-discovery-ticker"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <OTCSuggestionsPanel onChoose={(it) => setChosen(it)} />

      <Card>
        <CardHeader>
          <CardTitle>Dostupne hartije</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Vrsta</TH>
                <TH>Naziv</TH>
                <TH>Oznaka</TH>
                <TH className="text-right">Dostupno</TH>
                <TH className="text-right">Cena</TH>
                <TH>Poslednja izmena</TH>
                <TH>Vlasnik</TH>
                <TH>{/* actions */}</TH>
              </TR>
            </THead>
            <TBody>
              {items.length === 0 ? (
                <EmptyRow colSpan={8}>
                  {discovery.isFetching ? 'Učitavanje…' : 'Nema dostupnih hartija.'}
                </EmptyRow>
              ) : (
                items.map((it) => (
                  <TR key={it.holdingId} data-cy={`otc-row-${it.holdingId}`}>
                    <TD>
                      {securityTypeLabel[it.security?.type ?? v1SecurityType.SECURITY_TYPE_UNSPECIFIED]}
                    </TD>
                    <TD>{it.security?.name ?? '—'}</TD>
                    <TD className="font-mono">{it.security?.ticker ?? '—'}</TD>
                    <TD className="text-right tabular-nums" data-cy={`otc-available-${it.holdingId}`}>
                      {it.availableCount ?? 0}
                    </TD>
                    <TD className="text-right">{formatMoney(it.currentPrice, it.security?.currency)}</TD>
                    <TD className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(it.lastUpdated)}
                    </TD>
                    <TD data-cy={`otc-owner-${it.holdingId}`}>{ownerLabel(it)}</TD>
                    <TD>
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        disabled={(it.availableCount ?? 0) === 0}
                        data-cy={`otc-make-offer-${it.holdingId}`}
                        onClick={() => setChosen(it)}
                      >
                        Napravi ponudu
                      </Button>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <CreateOTCOfferDialog open={Boolean(chosen)} item={chosen} onClose={() => setChosen(null)} />
    </main>
  )
}
