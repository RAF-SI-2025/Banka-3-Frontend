// ExerciseOptionDialog (FE-4 / spec p.61.d). Confirm-flow for an
// actuary's option holding. Fetches the underlying's listing on open
// to render the ITM check; gates Potvrdi on settlementDate + ITM
// status; routes confirms through portfolio.exerciseOption.

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { exerciseOption } from '@/lib/api/portfolio'
import { getSecurity } from '@/lib/api/securities'
import { apiError } from '@/lib/api/error'
import { keys } from '@/lib/query-keys'
import { itmStatus } from '@/lib/trading/option-itm'
import type { v1Holding } from '@/lib/api/generated/models/v1Holding'
import { v1OptionType } from '@/lib/api/generated/models/v1OptionType'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ErrorBanner } from '@/components/ui/error'
import { formatDate, formatMoney } from '@/lib/format'

export interface ExerciseOptionDialogProps {
  open: boolean
  onClose: () => void
  holding: v1Holding
}

export function ExerciseOptionDialog({ open, onClose, holding }: ExerciseOptionDialogProps) {
  const qc = useQueryClient()
  const sec = holding.security
  const maxQty = holding.quantity ?? 0
  // Default to the full held position; the user can dial it down to a
  // partial quantity (min 1) for a partial exercise (spec p.61.d).
  const [qty, setQty] = useState<string>(String(maxQty || 1))

  // Reset qty whenever the dialog opens against a new holding.
  useEffect(() => {
    if (open) setQty(String(maxQty || 1))
  }, [open, holding.id, maxQty])

  // Underlying price for the ITM check. Skip fetch when not open.
  const underlyingId = sec?.underlyingSecurityId
  const underlying = useQuery({
    queryKey: keys.security.detail(underlyingId ?? ''),
    queryFn: () => getSecurity(underlyingId!),
    enabled: open && Boolean(underlyingId),
  })
  const underlyingPrice = underlying.data?.listing?.price

  const settlementPast = useMemo(() => {
    if (!sec?.settlementDate) return false
    return new Date(sec.settlementDate) <= new Date()
  }, [sec?.settlementDate])

  const itm = useMemo(
    () => itmStatus(sec?.optionType, underlyingPrice, sec?.strikePrice),
    [sec?.optionType, sec?.strikePrice, underlyingPrice],
  )

  const qtyNum = Number(qty)
  const qtyValid = Number.isInteger(qtyNum) && qtyNum >= 1 && qtyNum <= maxQty

  const mutation = useMutation({
    mutationFn: () => exerciseOption(holding.id!, qtyNum),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.portfolio.all })
      onClose()
    },
  })

  const blocked =
    settlementPast || itm === 'oom' || !qtyValid || maxQty === 0 || mutation.isPending
  const blockedReason = settlementPast
    ? 'Opcija je istekla — nema iskorišćavanja.'
    : itm === 'oom'
      ? 'Opcija je out-of-the-money — iskorišćavanje nema smisla.'
      : maxQty === 0
        ? 'Pozicija je prazna.'
        : null

  const optionTypeLabel =
    sec?.optionType === v1OptionType.OPTION_TYPE_CALL
      ? 'CALL'
      : sec?.optionType === v1OptionType.OPTION_TYPE_PUT
        ? 'PUT'
        : '—'

  return (
    <Dialog
      open={open}
      onClose={mutation.isPending ? () => {} : onClose}
      title={`Iskoristi opciju ${sec?.ticker ?? ''}`}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Otkaži
          </Button>
          <Button
            type="button"
            variant="primary"
            data-cy="exercise-confirm"
            disabled={blocked}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Slanje…' : 'Potvrdi'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tip">
            <Badge tone={sec?.optionType === v1OptionType.OPTION_TYPE_CALL ? 'green' : 'blue'}>
              {optionTypeLabel}
            </Badge>
          </Field>
          <Field label="Strike">{formatMoney(sec?.strikePrice, sec?.currency)}</Field>
          <Field label="Underlying cena">
            {underlying.isFetching && !underlying.data ? '…' : formatMoney(underlyingPrice, sec?.currency)}
          </Field>
          <Field label="Ugovor (kontr. veličina)">{sec?.contractSize ?? '—'}</Field>
          <Field label="Datum izvršenja">{formatDate(sec?.settlementDate)}</Field>
          <Field label="Vaš broj ugovora">{maxQty}</Field>
        </div>

        <ITMBadge itm={itm} settlementPast={settlementPast} />

        <div>
          <Label htmlFor="exercise-qty">Broj ugovora za iskorišćavanje</Label>
          <Input
            id="exercise-qty"
            data-cy="exercise-qty"
            type="number"
            min={1}
            max={maxQty}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          {!qtyValid && (
            <p className="mt-1 text-xs text-danger">Količina mora biti između 1 i {maxQty}.</p>
          )}
        </div>

        {blockedReason && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700">
            {blockedReason}
          </div>
        )}

        {mutation.isError && (
          <ErrorBanner>{apiError(mutation.error, 'Greška pri iskorišćavanju opcije.')}</ErrorBanner>
        )}
      </div>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{children}</p>
    </div>
  )
}

function ITMBadge({ itm, settlementPast }: { itm: ReturnType<typeof itmStatus>; settlementPast: boolean }) {
  if (settlementPast) return <Badge tone="red">Istekla</Badge>
  if (itm === 'itm') return <Badge tone="green">In the money</Badge>
  if (itm === 'oom') return <Badge tone="red">Out of the money</Badge>
  return <Badge tone="neutral">Nije moguće utvrditi (nedostaje cena)</Badge>
}
