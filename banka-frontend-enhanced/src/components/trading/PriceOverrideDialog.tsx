// Spec p.37 "ručna validacija i korekcija podataka". Admin-only edit
// of (price, ask, bid) for a listing keyed by (securityId, exchangeMic).
// No verification per the c3 verification scope.

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { upsertListing } from '@/lib/api/listings'
import { apiError } from '@/lib/api/error'
import { keys } from '@/lib/query-keys'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorBanner } from '@/components/ui/error'
import { priceOverrideSchema, type PriceOverrideValues } from './price-override-schema'

interface PriceOverrideDialogProps {
  open: boolean
  onClose: () => void
  securityId: string
  exchangeMic: string
  listingId: string
  initial: { price?: string; ask?: string; bid?: string }
}

export function PriceOverrideDialog({ open, onClose, securityId, exchangeMic, listingId, initial }: PriceOverrideDialogProps) {
  const qc = useQueryClient()
  const form = useForm<PriceOverrideValues>({
    resolver: zodResolver(priceOverrideSchema),
    defaultValues: { price: initial.price ?? '', ask: initial.ask ?? '', bid: initial.bid ?? '' },
  })

  const mut = useMutation({
    mutationFn: (v: PriceOverrideValues) =>
      upsertListing({ securityId, exchangeMic, ...v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.security.detail(securityId) })
      qc.invalidateQueries({ queryKey: keys.listing.detail(listingId) })
      qc.invalidateQueries({ queryKey: keys.security.all })
      qc.invalidateQueries({ queryKey: keys.listing.all })
      onClose()
    },
  })

  const errMsg = mut.error ? apiError(mut.error, 'Greška pri izmeni cene.') : null

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Izmeni cenu"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>Otkaži</Button>
          <Button
            type="submit"
            form="price-override-form"
            disabled={mut.isPending}
          >
            {mut.isPending ? 'Šaljem…' : 'Sačuvaj'}
          </Button>
        </>
      }
    >
      <form
        id="price-override-form"
        className="space-y-3"
        onSubmit={form.handleSubmit((v) => mut.mutate(v))}
      >
        <div>
          <Label htmlFor="po-price">Cena</Label>
          <Input id="po-price" inputMode="decimal" {...form.register('price')} />
          {form.formState.errors.price && (
            <p className="mt-1 text-xs text-destructive">{form.formState.errors.price.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="po-ask">Ask</Label>
          <Input id="po-ask" inputMode="decimal" {...form.register('ask')} />
          {form.formState.errors.ask && (
            <p className="mt-1 text-xs text-destructive">{form.formState.errors.ask.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="po-bid">Bid</Label>
          <Input id="po-bid" inputMode="decimal" {...form.register('bid')} />
          {form.formState.errors.bid && (
            <p className="mt-1 text-xs text-destructive">{form.formState.errors.bid.message}</p>
          )}
        </div>
        {errMsg && <ErrorBanner>{errMsg}</ErrorBanner>}
      </form>
    </Dialog>
  )
}
