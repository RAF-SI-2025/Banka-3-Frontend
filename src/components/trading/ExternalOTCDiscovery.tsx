// Celina 5 — cross-bank OTC discovery board. Aggregates partner banks'
// /otc/public feeds; the gateway fans out across INTERBANK_ROUTES on
// the backend so this component just calls one endpoint.

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { listExternalPublicHoldings } from '@/lib/api/external-otc'
import { keys } from '@/lib/query-keys'
import { securityTypeLabel } from '@/lib/labels'
import { v1SecurityType } from '@/lib/api/generated/models/v1SecurityType'
import { ExternalCreateOTCOfferDialog } from './ExternalCreateOTCOfferDialog'
import type { v1ExternalPublicHolding } from '@/lib/api/generated/models/v1ExternalPublicHolding'

export function ExternalOTCDiscovery() {
  const [bankCode, setBankCode] = useState('')
  const [ticker, setTicker] = useState('')
  const [chosen, setChosen] = useState<v1ExternalPublicHolding | null>(null)

  const args = useMemo(
    () => ({
      bankCode: bankCode.trim() || undefined,
      ticker: ticker.trim() || undefined,
    }),
    [bankCode, ticker],
  )
  const discovery = useQuery({
    queryKey: keys.externalOtc.discovery(args),
    queryFn: () => listExternalPublicHoldings(args),
    refetchInterval: 15_000,
  })

  const items = discovery.data?.items ?? []

  return (
    <main className="container space-y-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold">Eksterna OTC trgovina</h1>
        <p className="text-sm text-muted-foreground">
          Hartije koje nude korisnici drugih banaka. Pošaljite ponudu —
          pregovaranje teče preko gateway-a do partnerske banke.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="ext-bank-code">Šifra banke</Label>
              <Input
                id="ext-bank-code"
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                placeholder="npr. 222"
                data-cy="ext-otc-bank-code"
              />
            </div>
            <div>
              <Label htmlFor="ext-ticker">Ticker</Label>
              <Input
                id="ext-ticker"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="npr. AAPL"
                data-cy="ext-otc-ticker"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dostupne hartije (sve banke)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Banka</TH>
                <TH>Vrsta</TH>
                <TH>Oznaka</TH>
                <TH className="text-right">Količina</TH>
                <TH className="text-right">ASK</TH>
                <TH className="text-right">Premija</TH>
                <TH>Prodavac</TH>
                <TH>{/* actions */}</TH>
              </TR>
            </THead>
            <TBody>
              {items.length === 0 ? (
                <EmptyRow colSpan={8}>
                  {discovery.isFetching
                    ? 'Učitavanje…'
                    : 'Nijedna partnerska banka trenutno ne nudi hartije.'}
                </EmptyRow>
              ) : (
                items.map((it) => (
                  <TR
                    key={`${it.bankCode}-${it.sellerHoldingId}`}
                    data-cy={`ext-otc-row-${it.bankCode}-${it.sellerHoldingId}`}
                  >
                    <TD className="font-mono">{it.bankCode}</TD>
                    <TD>
                      {securityTypeLabel[it.securityType ?? v1SecurityType.SECURITY_TYPE_UNSPECIFIED]}
                    </TD>
                    <TD className="font-mono">{it.securityTicker ?? '—'}</TD>
                    <TD className="text-right tabular-nums">{it.quantity ?? 0}</TD>
                    <TD className="text-right tabular-nums">{it.askPrice || '—'}</TD>
                    <TD className="text-right tabular-nums">{it.premium || '—'}</TD>
                    <TD>{it.sellerDisplay || it.sellerUserRef || '—'}</TD>
                    <TD>
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        disabled={(it.quantity ?? 0) === 0}
                        data-cy={`ext-otc-make-offer-${it.bankCode}-${it.sellerHoldingId}`}
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

      <ExternalCreateOTCOfferDialog
        open={Boolean(chosen)}
        item={chosen}
        onClose={() => setChosen(null)}
      />
    </main>
  )
}
