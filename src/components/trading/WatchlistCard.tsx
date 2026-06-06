// Watchlist add control (todoSpec C3 S35-S36). Embeds in the shared
// listing detail page (portal + banking). The user picks one of their
// named watchlists (or creates a new one, S36) and adds the security on
// screen to it (S35). The full watchlist view + removal lives on the
// dedicated watchlist page.

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listWatchlists,
  createWatchlist,
  addToWatchlist,
} from '@/lib/api/watchlist'
import { apiError } from '@/lib/api/error'
import { keys } from '@/lib/query-keys'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ErrorBanner } from '@/components/ui/error'

export function WatchlistCard({ securityId }: { securityId: string }) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<string>('')
  const [newName, setNewName] = useState<string>('')
  const [creating, setCreating] = useState(false)

  const lists = useQuery({
    queryKey: keys.watchlist.list(),
    queryFn: () => listWatchlists(),
  })
  const watchlists = lists.data?.watchlists ?? []

  // Default the picker to the first list once loaded.
  const activeId = selected || watchlists[0]?.id || ''

  const add = useMutation({
    mutationFn: (watchlistId: string) => addToWatchlist(watchlistId, securityId),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.watchlist.all }),
  })

  const create = useMutation({
    mutationFn: (name: string) => createWatchlist(name),
    onSuccess: async (wl) => {
      setNewName('')
      setCreating(false)
      setSelected(wl.id)
      await qc.invalidateQueries({ queryKey: keys.watchlist.all })
      // Add the security straight onto the freshly created list (S35+S36).
      add.mutate(wl.id)
    },
  })

  // Which lists already contain this security (so we can flag "added").
  const onLists = watchlists.filter((w) => (w.items ?? []).some((it) => it.securityId === securityId))

  const errMsg =
    add.error ? apiError(add.error, 'Greška pri dodavanju na listu.') :
    create.error ? apiError(create.error, 'Greška pri kreiranju liste.') : null

  return (
    <Card data-cy="watchlist-add-card">
      <CardHeader>
        <CardTitle>Lista za praćenje</CardTitle>
        <p className="text-sm text-muted-foreground">
          Dodajte hartiju na jednu od svojih lista za praćenje.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!creating ? (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="wl-select">Lista</Label>
              <Select
                id="wl-select"
                className="w-56"
                value={activeId}
                onChange={(e) => setSelected(e.target.value)}
                disabled={watchlists.length === 0}
                data-cy="watchlist-select"
              >
                {watchlists.length === 0 && <option value="">Nemate liste</option>}
                {watchlists.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </Select>
            </div>
            <Button
              type="button"
              disabled={!activeId || add.isPending}
              onClick={() => add.mutate(activeId)}
              data-cy="watchlist-add-submit"
            >
              {add.isPending ? 'Dodajem…' : 'Dodaj na watchlist'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setCreating(true)} data-cy="watchlist-new-toggle">
              Nova lista
            </Button>
          </div>
        ) : (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              const name = newName.trim()
              if (name) create.mutate(name)
            }}
          >
            <div>
              <Label htmlFor="wl-name">Naziv liste</Label>
              <Input
                id="wl-name"
                className="w-56"
                placeholder="npr. Tech akcije"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                data-cy="watchlist-new-name"
              />
            </div>
            <Button type="submit" disabled={!newName.trim() || create.isPending} data-cy="watchlist-new-submit">
              {create.isPending ? 'Kreiram…' : 'Kreiraj i dodaj'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setCreating(false); setNewName('') }}>
              Otkaži
            </Button>
          </form>
        )}
        {errMsg && <ErrorBanner>{errMsg}</ErrorBanner>}

        {onLists.length > 0 && (
          <p className="text-xs text-muted-foreground" data-cy="watchlist-membership">
            Već na listama: {onLists.map((w) => w.name).join(', ')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
