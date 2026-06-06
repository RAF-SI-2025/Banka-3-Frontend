// Recurring orders / "Trajni nalog" (DCA — todoSpec C3 S47-S53). Client
// surface: a creation form (security, mode BYAMOUNT/BYQUANTITY,
// amount/qty, interval, account) plus the user's recurring orders with
// pause/resume/cancel.

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listRecurringOrders,
  createRecurringOrder,
  pauseRecurringOrder,
  resumeRecurringOrder,
  cancelRecurringOrder,
  type RecurringMode,
  type RecurringCadence,
  type RecurringOrder,
} from '@/lib/api/recurringOrders'
import { listListings } from '@/lib/api/listings'
import { listAccounts } from '@/lib/api/accounts'
import { apiError } from '@/lib/api/error'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { formatMoney, formatDateTime } from '@/lib/format'
import { v1SecurityType } from '@/lib/api/generated/models/v1SecurityType'
import { v1AccountStatus } from '@/lib/api/generated/models/v1AccountStatus'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ErrorBanner } from '@/components/ui/error'

const MODE_LABEL: Record<RecurringMode, string> = {
  RECURRING_MODE_BYAMOUNT: 'Po iznosu (RSD)',
  RECURRING_MODE_BYQUANTITY: 'Po količini',
}

const CADENCE_LABEL: Record<RecurringCadence, string> = {
  DAILY: 'Dnevno',
  WEEKLY: 'Nedeljno',
  MONTHLY: 'Mesečno',
}

const CADENCES: RecurringCadence[] = ['DAILY', 'WEEKLY', 'MONTHLY']

export function RecurringOrdersPage() {
  const qc = useQueryClient()
  const userId = useAuthStore((s) => s.userId)

  const [securityId, setSecurityId] = useState('')
  const [mode, setMode] = useState<RecurringMode>('RECURRING_MODE_BYAMOUNT')
  const [amountRsd, setAmountRsd] = useState('')
  const [quantity, setQuantity] = useState('')
  const [cadence, setCadence] = useState<RecurringCadence>('MONTHLY')
  const [accountId, setAccountId] = useState('')

  // Clients can only recur stocks + futures (spec p.58); the catalog
  // listing endpoint already filters forex/options for clients, but we
  // pull the tradable set explicitly so the picker is stable.
  const stocks = useQuery({
    queryKey: keys.listing.list({ type: v1SecurityType.SECURITY_TYPE_STOCK }),
    queryFn: () => listListings({ type: v1SecurityType.SECURITY_TYPE_STOCK }),
  })
  const futures = useQuery({
    queryKey: keys.listing.list({ type: v1SecurityType.SECURITY_TYPE_FUTURE }),
    queryFn: () => listListings({ type: v1SecurityType.SECURITY_TYPE_FUTURE }),
  })
  const securities = [...(stocks.data?.items ?? []), ...(futures.data?.items ?? [])]

  const accounts = useQuery({
    queryKey: keys.account.list({ ownerClientId: userId ?? '' }),
    queryFn: () => listAccounts({ ownerClientId: userId ?? undefined }),
    enabled: Boolean(userId),
  })
  const activeAccounts = (accounts.data?.accounts ?? []).filter(
    (a) => a.status === v1AccountStatus.ACCOUNT_STATUS_ACTIVE,
  )

  const list = useQuery({
    queryKey: keys.recurringOrder.list(),
    queryFn: () => listRecurringOrders(),
  })
  const orders = list.data?.recurringOrders ?? []

  const create = useMutation({
    mutationFn: () =>
      createRecurringOrder({
        securityId,
        mode,
        amountRsd: mode === 'RECURRING_MODE_BYAMOUNT' ? amountRsd.trim() : undefined,
        quantity: mode === 'RECURRING_MODE_BYQUANTITY' ? Number(quantity) : undefined,
        accountId,
        cadence,
      }),
    onSuccess: () => {
      setSecurityId('')
      setAmountRsd('')
      setQuantity('')
      setAccountId('')
      qc.invalidateQueries({ queryKey: keys.recurringOrder.all })
    },
  })

  const pause = useMutation({
    mutationFn: (id: string) => pauseRecurringOrder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.recurringOrder.all }),
  })
  const resume = useMutation({
    mutationFn: (id: string) => resumeRecurringOrder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.recurringOrder.all }),
  })
  const cancel = useMutation({
    mutationFn: (id: string) => cancelRecurringOrder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.recurringOrder.all }),
  })

  const sizingValid =
    mode === 'RECURRING_MODE_BYAMOUNT'
      ? Number(amountRsd) > 0
      : Number.isInteger(Number(quantity)) && Number(quantity) > 0
  const formValid = Boolean(securityId) && Boolean(accountId) && sizingValid

  const errMsg = create.error ? apiError(create.error, 'Greška pri kreiranju trajnog naloga.') : null

  function tickerFor(secId: string): string {
    const swl = securities.find((s) => s.security?.id === secId)
    return swl?.security?.ticker ?? secId
  }

  return (
    <main className="container space-y-6 py-8">
      <h1 className="text-2xl font-semibold">Trajni nalog</h1>
      <p className="text-sm text-muted-foreground">
        Automatska periodična kupovina hartije (DCA). Na svaki termin sistem
        kreira tržišni nalog za kupovinu; ako nema dovoljno sredstava, kupovina
        se preskače i bićete obavešteni.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Novi trajni nalog</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (formValid) create.mutate()
            }}
          >
            <div>
              <Label htmlFor="ro-security">Hartija</Label>
              <Select
                id="ro-security"
                className="w-56"
                value={securityId}
                onChange={(e) => setSecurityId(e.target.value)}
                data-cy="recurring-security"
              >
                <option value="">Izaberite hartiju</option>
                {securities.map((s) => (
                  <option key={s.security?.id} value={s.security?.id}>
                    {s.security?.ticker} — {s.security?.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="ro-mode">Način</Label>
              <Select
                id="ro-mode"
                className="w-44"
                value={mode}
                onChange={(e) => setMode(e.target.value as RecurringMode)}
                data-cy="recurring-mode"
              >
                <option value="RECURRING_MODE_BYAMOUNT">{MODE_LABEL.RECURRING_MODE_BYAMOUNT}</option>
                <option value="RECURRING_MODE_BYQUANTITY">{MODE_LABEL.RECURRING_MODE_BYQUANTITY}</option>
              </Select>
            </div>

            {mode === 'RECURRING_MODE_BYAMOUNT' ? (
              <div>
                <Label htmlFor="ro-amount">Iznos (RSD)</Label>
                <Input
                  id="ro-amount"
                  className="w-36"
                  inputMode="decimal"
                  placeholder="10000"
                  value={amountRsd}
                  onChange={(e) => setAmountRsd(e.target.value)}
                  data-cy="recurring-amount"
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="ro-qty">Količina</Label>
                <Input
                  id="ro-qty"
                  className="w-28"
                  inputMode="numeric"
                  placeholder="5"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  data-cy="recurring-quantity"
                />
              </div>
            )}

            <div>
              <Label htmlFor="ro-cadence">Učestalost</Label>
              <Select
                id="ro-cadence"
                className="w-36"
                value={cadence}
                onChange={(e) => setCadence(e.target.value as RecurringCadence)}
                data-cy="recurring-cadence"
              >
                {CADENCES.map((c) => (
                  <option key={c} value={c}>{CADENCE_LABEL[c]}</option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="ro-account">Račun</Label>
              <Select
                id="ro-account"
                className="w-56"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                data-cy="recurring-account"
              >
                <option value="">Izaberite račun</option>
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.number} ({a.currency})
                  </option>
                ))}
              </Select>
            </div>

            <Button type="submit" disabled={!formValid || create.isPending} data-cy="recurring-submit">
              {create.isPending ? 'Kreiram…' : 'Kreiraj trajni nalog'}
            </Button>
          </form>
          {errMsg && <div className="mt-3"><ErrorBanner>{errMsg}</ErrorBanner></div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Moji trajni nalozi</CardTitle>
        </CardHeader>
        <CardContent>
          {list.isLoading ? (
            <p className="text-sm text-muted-foreground">Učitavanje…</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-cy="recurring-empty">
              Nemate nijedan trajni nalog.
            </p>
          ) : (
            <ul className="divide-y divide-border/40" data-cy="recurring-list">
              {orders.map((r) => (
                <RecurringRow
                  key={r.id}
                  order={r}
                  ticker={tickerFor(r.securityId)}
                  onPause={() => pause.mutate(r.id)}
                  onResume={() => resume.mutate(r.id)}
                  onCancel={() => cancel.mutate(r.id)}
                  busy={pause.isPending || resume.isPending || cancel.isPending}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

function RecurringRow({
  order,
  ticker,
  onPause,
  onResume,
  onCancel,
  busy,
}: {
  order: RecurringOrder
  ticker: string
  onPause: () => void
  onResume: () => void
  onCancel: () => void
  busy: boolean
}) {
  const sizing =
    order.mode === 'RECURRING_MODE_BYAMOUNT'
      ? formatMoney(order.amountRsd, 'RSD')
      : `${order.quantity} kom.`
  const cadenceLabel = CADENCE_LABEL[order.cadence as RecurringCadence] ?? order.cadence
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3" data-cy="recurring-item">
      <div className="min-w-0">
        <span className="font-mono font-semibold" data-cy="recurring-item-ticker">{ticker}</span>
        <span className="ml-2 text-sm text-muted-foreground">
          {sizing} · {cadenceLabel}
        </span>
        {order.nextRun && (
          <span className="ml-2 text-xs text-muted-foreground">
            Sledeće: {formatDateTime(order.nextRun)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span data-cy="recurring-item-status">
          <Badge tone={order.active ? 'green' : 'neutral'}>
            {order.active ? 'Aktivan' : 'Pauziran'}
          </Badge>
        </span>
        {order.active ? (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onPause} data-cy="recurring-pause">
            Pauziraj
          </Button>
        ) : (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onResume} data-cy="recurring-resume">
            Nastavi
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onCancel} data-cy="recurring-cancel">
          Otkaži
        </Button>
      </div>
    </li>
  )
}
