import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { listPublicHoldings, listExternalPublicHoldings } from '@/lib/api/otc'
import { keys } from '@/lib/query-keys'
import { formatMoney } from '@/lib/format'
import { bankNameFromPrefix, OWN_BANK_PREFIX } from '@/lib/interbank'
import { CreateOTCOfferDialog } from './CreateOTCOfferDialog'
import type { v1PublicHoldingItem } from '@/lib/api/generated/models/v1PublicHoldingItem'
import type { ExternalPublicHoldingItem } from '@/lib/api/otc'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog } from '@/components/ui/dialog'
import { useAuthStore } from '@/lib/auth/store'
import { listAccounts } from '@/lib/api/accounts'
import { createExternalOTCOffer } from '@/lib/api/otc'
import { Select } from '@/components/ui/select'
import { apiError } from '@/lib/api/error'
import { toast } from '@/components/ui/toast'
import { ErrorBanner } from '@/components/ui/error'

// ─── Unified row type ────────────────────────────────────────────────────────

type OTCDiscoveryRow =
  | { kind: 'local'; item: v1PublicHoldingItem }
  | { kind: 'external'; item: ExternalPublicHoldingItem }

function rowTicker(r: OTCDiscoveryRow): string {
  return r.kind === 'local'
    ? (r.item.security?.ticker ?? '—')
    : (r.item.securityTicker ?? '—')
}

function rowAvailable(r: OTCDiscoveryRow): number {
  return r.item.availableCount ?? 0
}

function rowPrice(r: OTCDiscoveryRow): string {
  return r.kind === 'local'
    ? formatMoney(r.item.currentPrice, r.item.security?.currency)
    : formatMoney(r.item.currentPrice, r.item.currency as string | undefined)
}

function rowKey(r: OTCDiscoveryRow): string {
  return r.kind === 'local'
    ? (r.item.holdingId ?? '')
    : `ext-${r.item.holdingId ?? ''}-${r.item.sellerBankPrefix ?? ''}`
}

// ─── Component ───────────────────────────────────────────────────────────────

export function OTCDiscovery() {
  const [ticker, setTicker] = useState('')
  const [chosen, setChosen] = useState<OTCDiscoveryRow | null>(null)

  const args = useMemo(() => ({ ticker: ticker.trim() || undefined }), [ticker])

  // Local bank holdings
  const localQ = useQuery({
    queryKey: keys.otc.discovery(args),
    queryFn: () => listPublicHoldings(args),
    refetchInterval: 15_000,
  })

  // Other banks' holdings (Celina 5)
  const externalQ = useQuery({
    queryKey: ['otc', 'external-discovery', args],
    queryFn: () => listExternalPublicHoldings(args),
    refetchInterval: 30_000,
    retry: 1, // endpoint may not be deployed yet
  })

  const rows = useMemo((): OTCDiscoveryRow[] => {
    const local: OTCDiscoveryRow[] = (localQ.data?.items ?? []).map((item) => ({
      kind: 'local',
      item,
    }))
    const external: OTCDiscoveryRow[] = (externalQ.data?.items ?? []).map((item) => ({
      kind: 'external',
      item,
    }))
    return [...local, ...external]
  }, [localQ.data, externalQ.data])

  const filtered = ticker.trim()
    ? rows.filter((r) => rowTicker(r).toLowerCase().includes(ticker.trim().toLowerCase()))
    : rows

  const isFetching = localQ.isFetching || externalQ.isFetching

  return (
    <main className="container space-y-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold">OTC trgovina</h1>
        <p className="text-sm text-muted-foreground">
          Hartije koje korisnici nude vansistemski — iz naše i ostalih banaka.
          Pošaljite ponudu da pokrenete pregovaranje.
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
          <div className="flex items-center justify-between">
            <CardTitle>Dostupne hartije</CardTitle>
            {externalQ.isError && (
              <span className="text-xs text-muted-foreground">
                Ponude iz ostalih banaka trenutno nisu dostupne.
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Ticker</TH>
                <TH>Banka prodavca</TH>
                <TH>Prodavac</TH>
                <TH className="text-right">Dostupno</TH>
                <TH className="text-right">Tržišna cena</TH>
                <TH>{/* actions */}</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.length === 0 ? (
                <EmptyRow colSpan={6}>
                  {isFetching ? 'Učitavanje…' : 'Nema dostupnih hartija.'}
                </EmptyRow>
              ) : (
                filtered.map((row) => {
                  const isExternal = row.kind === 'external'
                  const bankPrefix = isExternal
                    ? (row.item as ExternalPublicHoldingItem).sellerBankPrefix ?? ''
                    : OWN_BANK_PREFIX
                  const bankName = bankNameFromPrefix(bankPrefix)
                  const sellerName = isExternal
                    ? (row.item as ExternalPublicHoldingItem).sellerDisplayName
                    : (row.item as v1PublicHoldingItem).sellerDisplayName
                  const holdingId = row.item.holdingId ?? ''
                  const available = rowAvailable(row)

                  return (
                    <TR key={rowKey(row)}>
                      <TD className="font-mono font-medium">{rowTicker(row)}</TD>
                      <TD>
                        {isExternal ? (
                          <Badge tone="yellow">{bankName}</Badge>
                        ) : (
                          <Badge tone="blue">Naša banka</Badge>
                        )}
                      </TD>
                      <TD className="text-sm text-muted-foreground">
                        {sellerName || '—'}
                      </TD>
                      <TD
                        className="text-right tabular-nums"
                        data-cy={`otc-available-${holdingId}`}
                      >
                        {available}
                      </TD>
                      <TD className="text-right">{rowPrice(row)}</TD>
                      <TD>
                        <Button
                          type="button"
                          size="sm"
                          variant="primary"
                          disabled={available === 0}
                          data-cy={`otc-make-offer-${holdingId}`}
                          onClick={() => setChosen(row)}
                        >
                          Napravi ponudu
                        </Button>
                      </TD>
                    </TR>
                  )
                })
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {/* Local OTC offer dialog */}
      <CreateOTCOfferDialog
        open={chosen?.kind === 'local'}
        item={chosen?.kind === 'local' ? chosen.item : null}
        onClose={() => setChosen(null)}
      />

      {/* External OTC offer dialog */}
      {chosen?.kind === 'external' && (
        <ExternalOTCOfferDialog
          open
          item={chosen.item}
          onClose={() => setChosen(null)}
        />
      )}
    </main>
  )
}

// ─── External OTC offer dialog ───────────────────────────────────────────────



function ExternalOTCOfferDialog({
  open,
  item,
  onClose,
}: {
  open: boolean
  item: ExternalPublicHoldingItem
  onClose: () => void
}) {
  const qc = useQueryClient()
  const userId = useAuthStore((s) => s.userId)

  const [qty, setQty] = useState('')
  const [ppu, setPpu] = useState('')
  const [premium, setPremium] = useState('')
  const [settlement, setSettlement] = useState('')
  const [buyerAccountId, setBuyerAccountId] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const accountsQ = useQuery({
    queryKey: keys.account.list({ ownerClientId: userId }),
    queryFn: () => listAccounts({ ownerClientId: userId ?? undefined }),
    enabled: Boolean(userId),
  })
  const accounts = accountsQ.data?.accounts ?? []

  const mut = useMutation({
    mutationFn: () =>
      createExternalOTCOffer({
        sellerHoldingId: item.holdingId,
        sellerBankPrefix: item.sellerBankPrefix,
        buyerAccountId,
        quantity: Number(qty),
        pricePerUnit: ppu,
        premium,
        settlementDate: settlement ? `${settlement}T00:00:00Z` : '',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.otc.all })
      toast.success('Ponuda je uspešno poslata.')
      onClose()
    },
    onError: (e) => {
      const msg = apiError(e, 'Greška pri slanju ponude.')
      setErr(msg)
      toast.error(msg)
    },
  })

  const max = item.availableCount ?? 0
  const qtyNum = Number(qty)
  const canSubmit =
    buyerAccountId &&
    Number.isInteger(qtyNum) &&
    qtyNum > 0 &&
    qtyNum <= max &&
    Number(ppu) > 0 &&
    Number(premium) >= 0 &&
    settlement

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Ponuda za ${item.securityTicker ?? 'hartiju'} — ${bankNameFromPrefix(item.sellerBankPrefix ?? '')}`}
    >
      <div className="space-y-4">
        {err && <ErrorBanner>{err}</ErrorBanner>}

        <div className="rounded-md border border-warning-soft bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
          Ponuda za hartije iz druge banke. Pregovaranje i izvršenje se odvijaju
          po međubankarskom SAGA protokolu.
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Ticker</span>
            <div className="font-mono font-medium">{item.securityTicker ?? '—'}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Banka prodavca</span>
            <div>{bankNameFromPrefix(item.sellerBankPrefix ?? '')}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Dostupno</span>
            <div>{max}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Tržišna cena</span>
            <div>{formatMoney(item.currentPrice, item.currency as string | undefined)}</div>
          </div>
        </div>

        <div>
          <Label htmlFor="ext-buyer-account">Vaš račun (kupca)</Label>
          <Select
            id="ext-buyer-account"
            value={buyerAccountId}
            onChange={(e) => setBuyerAccountId(e.target.value)}
            data-cy="otc-buyer-account"
          >
            <option value="">— Izaberi račun —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id ?? ''}>
                {a.name || a.number} ({a.currency})
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ext-qty">Količina (max {max})</Label>
            <Input
              id="ext-qty"
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              data-cy="otc-qty"
            />
          </div>
          <div>
            <Label htmlFor="ext-ppu">Cena po akciji</Label>
            <Input
              id="ext-ppu"
              inputMode="decimal"
              value={ppu}
              onChange={(e) => setPpu(e.target.value)}
              data-cy="otc-ppu"
            />
          </div>
          <div>
            <Label htmlFor="ext-premium">Premija</Label>
            <Input
              id="ext-premium"
              inputMode="decimal"
              value={premium}
              onChange={(e) => setPremium(e.target.value)}
              data-cy="otc-premium"
            />
          </div>
          <div>
            <Label htmlFor="ext-settlement">Settlement datum</Label>
            <Input
              id="ext-settlement"
              type="date"
              value={settlement}
              onChange={(e) => setSettlement(e.target.value)}
              data-cy="otc-settlement"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={mut.isPending}>
            Odustani
          </Button>
          <Button
            onClick={() => { setErr(null); mut.mutate() }}
            disabled={!canSubmit || mut.isPending}
            data-cy="otc-create-offer-submit"
          >
            {mut.isPending ? 'Slanje…' : 'Pošalji ponudu'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
