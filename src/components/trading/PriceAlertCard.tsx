// Price alerts (todoSpec C3 S26-S29). A user sets a one-shot threshold
// on a security; when the price crosses it the backend sweep emails them
// once and deactivates the alert. This card embeds in the shared listing
// detail page (portal + banking) for tradable securities.

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listPriceAlerts,
  createPriceAlert,
  deletePriceAlert,
  type PriceAlertCondition,
} from '@/lib/api/priceAlerts'
import { apiError } from '@/lib/api/error'
import { keys } from '@/lib/query-keys'
import { formatMoney } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ErrorBanner } from '@/components/ui/error'

const schema = z.object({
  threshold: z
    .string()
    .min(1, 'Unesite prag')
    .refine((v) => Number(v) > 0, 'Prag mora biti veći od nule'),
  condition: z.enum(['PRICE_ALERT_CONDITION_ABOVE', 'PRICE_ALERT_CONDITION_BELOW']),
})
type FormValues = z.infer<typeof schema>

const conditionLabel: Record<PriceAlertCondition, string> = {
  PRICE_ALERT_CONDITION_ABOVE: 'pređe iznad',
  PRICE_ALERT_CONDITION_BELOW: 'padne ispod',
}

export function PriceAlertCard({ securityId, currency }: { securityId: string; currency?: string }) {
  const qc = useQueryClient()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { threshold: '', condition: 'PRICE_ALERT_CONDITION_ABOVE' },
  })

  const alerts = useQuery({
    queryKey: keys.priceAlert.list(),
    queryFn: () => listPriceAlerts(),
  })

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      createPriceAlert({ securityId, threshold: v.threshold, condition: v.condition }),
    onSuccess: () => {
      form.reset({ threshold: '', condition: 'PRICE_ALERT_CONDITION_ABOVE' })
      qc.invalidateQueries({ queryKey: keys.priceAlert.all })
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => deletePriceAlert(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.priceAlert.all }),
  })

  const errMsg = create.error ? apiError(create.error, 'Greška pri postavljanju alarma.') : null
  // Show this security's alerts (the FE list is the caller's own across
  // all securities; filter to the one on screen).
  const forThis = (alerts.data?.alerts ?? []).filter((a) => a.securityId === securityId)

  return (
    <Card data-cy="price-alert-card">
      <CardHeader>
        <CardTitle>Price alert</CardTitle>
        <p className="text-sm text-muted-foreground">
          Obavestićemo vas kada cena pređe zadati prag. Alarm se aktivira jednom.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={form.handleSubmit((v) => create.mutate(v))}
        >
          <div>
            <Label htmlFor="pa-condition">Uslov</Label>
            <Select id="pa-condition" className="w-40" {...form.register('condition')}>
              <option value="PRICE_ALERT_CONDITION_ABOVE">{conditionLabel.PRICE_ALERT_CONDITION_ABOVE}</option>
              <option value="PRICE_ALERT_CONDITION_BELOW">{conditionLabel.PRICE_ALERT_CONDITION_BELOW}</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="pa-threshold">Prag</Label>
            <Input
              id="pa-threshold"
              inputMode="decimal"
              className="w-32"
              data-cy="price-alert-threshold"
              {...form.register('threshold')}
            />
            {form.formState.errors.threshold && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.threshold.message}</p>
            )}
          </div>
          <Button type="submit" disabled={create.isPending} data-cy="price-alert-submit">
            {create.isPending ? 'Postavljam…' : 'Postavi price alert'}
          </Button>
        </form>
        {errMsg && <ErrorBanner>{errMsg}</ErrorBanner>}

        {forThis.length > 0 && (
          <ul className="space-y-1 text-sm" data-cy="price-alert-list">
            {forThis.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 border-b border-border/40 py-1.5 last:border-0"
              >
                <span>
                  Cena {conditionLabel[a.condition]} {formatMoney(a.threshold, currency)}
                  {!a.isActive && <span className="ml-2 text-xs text-muted-foreground">(aktiviran)</span>}
                </span>
                {a.isActive && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(a.id)}
                  >
                    Otkaži
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
