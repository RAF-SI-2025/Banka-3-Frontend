import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorBanner } from '@/components/ui/error'
import { placeOrder } from '@/lib/api/orders'
import { listSecurities } from '@/lib/api/securities'
import { keys } from '@/lib/query-keys'
import { apiError } from '@/lib/api/error'
import { formatMoney } from '@/lib/format'
import { v1OrderType } from '@/lib/api/generated/models/v1OrderType'
import { v1Direction } from '@/lib/api/generated/models/v1Direction'
import type { v1Fund } from '@/lib/api/generated/models/v1Fund'

interface Props {
  open: boolean
  fund: v1Fund | null
  onClose: () => void
}

// Spec p.75 "Dodatak za: portal Hartije od vrednosti", case 2 —
// supervisor directs one of their funds to BUY a security. Mirrors
// FundSellHoldingDialog: a fund-actor MARKET order carrying
// `on_behalf_of_fund_id`, settled against the fund's bank account.
// The "fond mora imati dovoljno novca" check is enforced server-side
// (spec p.75); we surface the failure and show the fund's liquidity
// for context. Supervisor-only — gated by the caller (FundDetail).
export function FundBuyDialog({ open, fund, onClose }: Props) {
  const qc = useQueryClient()
  const [securityId, setSecurityId] = useState('')
  const [qty, setQty] = useState('')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setSecurityId('')
      setQty('')
      setErr(null)
    }
  }, [open])

  // Catalog for the picker. listSecurities returns (security, listing)
  // pairs so the supervisor sees the current price and can gauge cost
  // against the fund's liquidity before the server re-checks.
  const securitiesQ = useQuery({
    queryKey: keys.security.list({ ctx: 'fund-buy' }),
    queryFn: () => listSecurities({ sortBy: 'price' }),
    enabled: open,
  })

  const securities = useMemo(() => {
    const rows = (securitiesQ.data?.items ?? []).filter((it) => it.security?.id)
    rows.sort((a, b) =>
      (a.security?.ticker ?? '').localeCompare(b.security?.ticker ?? ''),
    )
    return rows
  }, [securitiesQ.data])

  const buy = useMutation({
    mutationFn: () => {
      if (!fund?.id) throw new Error('no fund')
      if (!securityId) throw new Error('Izaberite hartiju.')
      const n = Number(qty)
      if (!Number.isFinite(n) || n <= 0) throw new Error('Količina mora biti pozitivan ceo broj.')
      return placeOrder({
        securityId,
        orderType: v1OrderType.ORDER_TYPE_MARKET,
        direction: v1Direction.DIRECTION_BUY,
        quantity: Math.floor(n),
        accountId: fund.bankAccountId,
        onBehalfOfFundId: fund.id,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.funds.all })
      qc.invalidateQueries({ queryKey: keys.order.all })
      onClose()
    },
    onError: (e) => setErr(apiError(e, 'Greška prilikom kupovine hartije za fond.')),
  })

  const qtyN = Number(qty)
  const valid = Boolean(securityId) && Number.isFinite(qtyN) && qtyN > 0

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (buy.isPending) return
        onClose()
      }}
      title="Kupovina hartije za fond"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={buy.isPending}>
            Otkaži
          </Button>
          <Button
            variant="primary"
            disabled={!valid || buy.isPending}
            data-cy="fund-buy-confirm"
            onClick={() => {
              setErr(null)
              buy.mutate()
            }}
          >
            {buy.isPending ? 'Slanje…' : 'Kupi'}
          </Button>
        </>
      }
    >
      {fund && (
        <div className="space-y-3 text-sm">
          <p>
            Kupujete hartiju za fond <span className="font-medium">{fund.name}</span> kao MARKET
            nalog. Sredstva se povlače sa računa fonda.
          </p>

          <SecurityCombobox
            securities={securities}
            loading={securitiesQ.isPending}
            value={securityId}
            onChange={setSecurityId}
          />

          <div>
            <Label htmlFor="fund-buy-qty">Količina</Label>
            <Input
              id="fund-buy-qty"
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))}
              data-cy="fund-buy-qty"
            />
          </div>

          <p className="text-xs text-muted-foreground" data-cy="fund-buy-liquidity">
            Likvidnost fonda: {formatMoney(fund.liquidRsd, 'RSD')}. Sistem proverava da fond ima
            dovoljno sredstava pre izvršenja.
          </p>

          {err && <ErrorBanner>{err}</ErrorBanner>}
        </div>
      )}
    </Dialog>
  )
}

type SecurityRow = {
  security?: { id?: string; ticker?: string; name?: string; currency?: string }
  listing?: { price?: string }
}

// Searchable single-select over the already-loaded securities catalog.
// Filters client-side by ticker/name (the catalog is small and fully
// fetched), so no per-keystroke server round-trip — same visual shape
// as ActuaryPicker but without the debounced query. The search input
// keeps data-cy="fund-buy-security"; options are
// data-cy="fund-buy-security-option-<id>".
function SecurityCombobox({
  securities,
  loading,
  value,
  onChange,
}: {
  securities: SecurityRow[]
  loading: boolean
  value: string
  onChange: (id: string) => void
}) {
  const inputId = useId()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const selected = useMemo(
    () => securities.find((it) => it.security?.id === value) ?? null,
    [securities, value],
  )

  // Clear the typed query when the selection is reset externally (e.g.
  // the dialog reopened) so the input doesn't keep stale text.
  useEffect(() => {
    if (!value) setQuery('')
  }, [value])

  // Click-outside to close (mirrors ActuaryPicker).
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return securities
    return securities.filter((it) => {
      const s = it.security
      return (
        (s?.ticker ?? '').toLowerCase().includes(q) ||
        (s?.name ?? '').toLowerCase().includes(q)
      )
    })
  }, [securities, query])

  function labelFor(it: SecurityRow): string {
    const s = it.security
    const px = it.listing?.price
    const base = `${s?.ticker ?? ''} — ${s?.name ?? ''}`
    return px != null ? `${base} · ${formatMoney(px, s?.currency ?? '')}` : base
  }

  return (
    <div ref={wrapperRef} className="relative">
      <Label htmlFor={inputId}>Hartija</Label>
      {selected ? (
        <div
          className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm"
          data-cy="fund-buy-security-selected"
        >
          <span className="truncate">{labelFor(selected)}</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            data-cy="fund-buy-security-clear"
            onClick={() => {
              onChange('')
              setQuery('')
              setOpen(true)
            }}
          >
            ×
          </Button>
        </div>
      ) : (
        <>
          <Input
            id={inputId}
            data-cy="fund-buy-security"
            placeholder="Pretraga po tikeru ili nazivu"
            autoComplete="off"
            disabled={loading || securities.length === 0}
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
          />
          {open && (
            <div
              role="listbox"
              data-cy="fund-buy-security-list"
              className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-surface shadow"
            >
              {loading && (
                <div className="px-3 py-2 text-sm text-muted-foreground">Učitavanje…</div>
              )}
              {!loading && filtered.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  {securities.length === 0 ? 'Nema dostupnih hartija.' : 'Nema rezultata.'}
                </div>
              )}
              {filtered.map((it) => {
                const s = it.security!
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="option"
                    data-cy={`fund-buy-security-option-${s.id}`}
                    onClick={() => {
                      onChange(s.id ?? '')
                      setOpen(false)
                    }}
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span>
                      <span className="font-mono">{s.ticker}</span> — {s.name}
                    </span>
                    {it.listing?.price != null && (
                      <span className="text-xs text-muted-foreground">
                        {formatMoney(it.listing.price, s.currency ?? '')}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
