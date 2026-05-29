import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { v1Holding } from '@/lib/api/generated/models/v1Holding'
import { setPublicCount } from '@/lib/api/portfolio'
import { apiError } from '@/lib/api/error'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { keys } from '@/lib/query-keys'

// Spec p.68: a holding's `public_count` is the share count its owner
// has volunteered to OTC discovery. The actual board-visible quantity
// is `public_count − reserved_count` (reserved = open offers + active
// contracts on this holding). Editor clamps to `[0, quantity −
// reserved_count]` — anything higher would mean publicly offering shares
// already committed elsewhere.
export function PublicCountEditor({ holding }: { holding: v1Holding }) {
  const qc = useQueryClient()
  const qty = holding.quantity ?? 0
  const reserved = holding.reservedCount ?? 0
  const max = Math.max(0, qty - reserved)
  const current = holding.publicCount ?? 0

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(current))
  const [err, setErr] = useState<string | null>(null)

  const mut = useMutation({
    mutationFn: (n: number) => setPublicCount(holding.id ?? '', n),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.portfolio.all })
      qc.invalidateQueries({ queryKey: keys.otc.all })
      setEditing(false)
      setErr(null)
    },
    onError: (e) => setErr(apiError(e, 'Greška')),
  })

  if (!editing) {
    return (
      <div className="flex items-center justify-end gap-2">
        <span className="tabular-nums" data-cy={`public-count-${holding.id}`}>
          {current}
          {reserved > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">(−{reserved} rez.)</span>
          )}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!holding.id || qty === 0}
          data-cy={`public-count-edit-${holding.id}`}
          onClick={(e) => {
            e.stopPropagation()
            setDraft(String(current))
            setErr(null)
            setEditing(true)
          }}
        >
          Izmeni
        </Button>
      </div>
    )
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const n = Number(draft)
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      setErr('Neispravna vrednost')
      return
    }
    if (n > max) {
      setErr(`Najviše ${max} (preostalo nakon rezervacija)`)
      return
    }
    mut.mutate(n)
  }

  return (
    <form className="flex items-center justify-end gap-1" onSubmit={onSubmit} onClick={(e) => e.stopPropagation()}>
      <Input
        type="number"
        min={0}
        max={max}
        step={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="h-8 w-20 text-right tabular-nums"
        data-cy={`public-count-input-${holding.id}`}
        autoFocus
      />
      <Button type="submit" size="sm" variant="primary" disabled={mut.isPending} data-cy={`public-count-save-${holding.id}`}>
        Sačuvaj
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => {
          setEditing(false)
          setErr(null)
        }}
      >
        Otkaži
      </Button>
      {err && <span className="ml-1 text-xs text-rose-600">{err}</span>}
    </form>
  )
}
