import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { listPublicHoldings } from '@/lib/api/otc'
import { keys } from '@/lib/query-keys'
import { formatMoney } from '@/lib/format'
import { CreateOTCOfferDialog } from './CreateOTCOfferDialog'
import type { v1PublicHoldingItem } from '@/lib/api/generated/models/v1PublicHoldingItem'

// Shared OTC discovery board. Spec p.67: "OTC trgovina" — list of
// holdings owned by other users with available shares public for
// negotiation. Filter by ticker; one "Napravi ponudu" button per row.
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

      <Card>
        <CardHeader>
          <CardTitle>Dostupne hartije</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Ticker</TH>
                <TH>Prodavac</TH>
                <TH className="text-right">Dostupno</TH>
                <TH className="text-right">Tržišna cena</TH>
                <TH>{/* actions */}</TH>
              </TR>
            </THead>
            <TBody>
              {items.length === 0 ? (
                <EmptyRow colSpan={5}>
                  {discovery.isFetching ? 'Učitavanje…' : 'Nema dostupnih hartija.'}
                </EmptyRow>
              ) : (
                items.map((it) => (
                  <TR key={it.holdingId}>
                    <TD className="font-mono">{it.security?.ticker ?? '—'}</TD>
                    <TD>{it.sellerDisplayName ?? '—'}</TD>
                    <TD className="text-right tabular-nums" data-cy={`otc-available-${it.holdingId}`}>
                      {it.availableCount ?? 0}
                    </TD>
                    <TD className="text-right">{formatMoney(it.currentPrice, it.security?.currency)}</TD>
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
