// Watchlist view (todoSpec C3 S36-S39). Shared by the portal + banking
// surfaces; only the order-form deep-link basePath differs. Renders the
// user's named watchlists (S36), each item with current price + daily
// change (S35), a per-item remove (S37), a quick-create-order link that
// lands on the security detail page with the order form prefilled (S38),
// and a security-type filter across all lists (S39).

import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listWatchlists,
  createWatchlist,
  deleteWatchlist,
  removeFromWatchlist,
  type WatchlistItem,
} from '@/lib/api/watchlist'
import { apiError } from '@/lib/api/error'
import { keys } from '@/lib/query-keys'
import { formatMoney } from '@/lib/format'
import { securityTypeLabel } from '@/lib/labels'
import { v1SecurityType } from '@/lib/api/generated/models/v1SecurityType'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ErrorBanner } from '@/components/ui/error'

// Security types a user can actually hold/track on a watchlist. Mirrors
// the catalog's tradable set; OPTION is included since it can appear via
// holdings even though it isn't ordered directly.
const FILTER_TYPES: v1SecurityType[] = [
  v1SecurityType.SECURITY_TYPE_STOCK,
  v1SecurityType.SECURITY_TYPE_FUTURE,
  v1SecurityType.SECURITY_TYPE_FOREX,
  v1SecurityType.SECURITY_TYPE_OPTION,
]

export function WatchlistPage({ basePath }: { basePath: '/portal/trgovina' | '/banking/trgovina' }) {
  const qc = useQueryClient()
  const [newName, setNewName] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')

  const lists = useQuery({
    queryKey: keys.watchlist.list(),
    queryFn: () => listWatchlists(),
  })
  const watchlists = lists.data?.watchlists ?? []

  const create = useMutation({
    mutationFn: (name: string) => createWatchlist(name),
    onSuccess: () => {
      setNewName('')
      qc.invalidateQueries({ queryKey: keys.watchlist.all })
    },
  })

  const removeList = useMutation({
    mutationFn: (id: string) => deleteWatchlist(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.watchlist.all }),
  })

  const removeItem = useMutation({
    mutationFn: ({ watchlistId, securityId }: { watchlistId: string; securityId: string }) =>
      removeFromWatchlist(watchlistId, securityId),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.watchlist.all }),
  })

  const errMsg = create.error ? apiError(create.error, 'Greška pri kreiranju liste.') : null

  function matchesFilter(it: WatchlistItem): boolean {
    if (!typeFilter) return true
    return it.securityType === typeFilter
  }

  return (
    <main className="container space-y-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Liste za praćenje</h1>
        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor="wl-type-filter">Filter po tipu</Label>
            <Select
              id="wl-type-filter"
              className="w-44"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              data-cy="watchlist-type-filter"
            >
              <option value="">Svi tipovi</option>
              {FILTER_TYPES.map((t) => (
                <option key={t} value={t}>{securityTypeLabel[t]}</option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nova lista</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              const name = newName.trim()
              if (name) create.mutate(name)
            }}
          >
            <div>
              <Label htmlFor="wl-create-name">Naziv</Label>
              <Input
                id="wl-create-name"
                className="w-56"
                placeholder="npr. Tech akcije"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                data-cy="watchlist-create-name"
              />
            </div>
            <Button type="submit" disabled={!newName.trim() || create.isPending} data-cy="watchlist-create-submit">
              {create.isPending ? 'Kreiram…' : 'Kreiraj listu'}
            </Button>
          </form>
          {errMsg && <div className="mt-3"><ErrorBanner>{errMsg}</ErrorBanner></div>}
        </CardContent>
      </Card>

      {lists.isLoading ? (
        <p className="text-sm text-muted-foreground">Učitavanje…</p>
      ) : watchlists.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-cy="watchlist-empty">
          Nemate nijednu listu za praćenje. Kreirajte je iznad ili sa stranice hartije.
        </p>
      ) : (
        <div className="space-y-6">
          {watchlists.map((w) => {
            const items = (w.items ?? []).filter(matchesFilter)
            return (
              <Card key={w.id} data-cy="watchlist">
                <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
                  <CardTitle data-cy="watchlist-name">{w.name}</CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={removeList.isPending}
                    onClick={() => removeList.mutate(w.id)}
                    data-cy="watchlist-delete"
                  >
                    Obriši listu
                  </Button>
                </CardHeader>
                <CardContent>
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {(w.items ?? []).length === 0 ? 'Lista je prazna.' : 'Nema hartija za izabrani filter.'}
                    </p>
                  ) : (
                    <ul className="divide-y divide-border/40" data-cy="watchlist-items">
                      {items.map((it) => (
                        <li key={it.id} className="flex flex-wrap items-center justify-between gap-3 py-2" data-cy="watchlist-item">
                          <div className="min-w-0">
                            <span className="font-mono font-semibold">{it.ticker ?? it.securityId}</span>
                            {it.name && <span className="ml-2 text-sm text-muted-foreground">{it.name}</span>}
                            {it.securityType && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                {securityTypeLabel[it.securityType]}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="font-semibold">{formatMoney(it.price, it.currency)}</div>
                              {it.dailyChange && (
                                <div className={Number(it.dailyChange) >= 0 ? 'text-xs text-emerald-600' : 'text-xs text-rose-600'}>
                                  {Number(it.dailyChange) >= 0 ? '+' : ''}{it.dailyChange}
                                </div>
                              )}
                            </div>
                            <QuickOrderLink basePath={basePath} securityId={it.securityId} />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={removeItem.isPending}
                              onClick={() => removeItem.mutate({ watchlistId: w.id, securityId: it.securityId })}
                              data-cy="watchlist-item-remove"
                            >
                              Ukloni
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </main>
  )
}

// QuickOrderLink lands on the security detail page with the order form
// prefilled for a BUY (S38). The detail page hosts the full OrderForm
// keyed to that security, so the ticker is effectively pre-filled.
function QuickOrderLink({
  basePath,
  securityId,
}: {
  basePath: '/portal/trgovina' | '/banking/trgovina'
  securityId: string
}) {
  const to = basePath === '/portal/trgovina' ? '/portal/trgovina/$securityId' : '/banking/trgovina/$securityId'
  return (
    <Link
      to={to}
      params={{ securityId }}
      search={{ direction: 'buy' as const }}
      className="text-sm text-primary hover:underline"
      data-cy="watchlist-quick-order"
    >
      Brzi nalog
    </Link>
  )
}
