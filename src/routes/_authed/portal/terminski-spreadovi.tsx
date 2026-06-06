import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getForexForwardSpreads, setForexForwardSpread } from '@/lib/api/forex-forwards'
import { apiError } from '@/lib/api/error'
import { keys } from '@/lib/query-keys'
import { currencyLabel, formatDateTime } from '@/lib/format'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error'
import { Card } from '@/components/ui/card'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { bankaBankV1Currency } from '@/lib/api/generated/models/bankaBankV1Currency'

export const Route = createFileRoute('/_authed/portal/terminski-spreadovi')({
  component: TerminskiSpreadovi,
})

const baseCurrencies = [
  bankaBankV1Currency.CURRENCY_EUR,
  bankaBankV1Currency.CURRENCY_CHF,
  bankaBankV1Currency.CURRENCY_USD,
  bankaBankV1Currency.CURRENCY_GBP,
  bankaBankV1Currency.CURRENCY_JPY,
  bankaBankV1Currency.CURRENCY_CAD,
  bankaBankV1Currency.CURRENCY_AUD,
]

const schema = z.object({
  baseCurrency: z.string().min(1, 'Izaberite valutu'),
  // Annualised spread factor, e.g. 0.02 = 2%/yr.
  spreadFactor: z.string().regex(/^[0-9]+(\.[0-9]{1,8})?$/, 'Faktor mora biti broj'),
})

type FormValues = z.infer<typeof schema>

function TerminskiSpreadovi() {
  const qc = useQueryClient()

  const spreads = useQuery({
    queryKey: keys.forexForward.spreads(),
    queryFn: () => getForexForwardSpreads(),
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { baseCurrency: '', spreadFactor: '' },
  })

  const save = useMutation({
    mutationFn: (v: FormValues) =>
      setForexForwardSpread({
        baseCurrency: v.baseCurrency as bankaBankV1Currency,
        quoteCurrency: bankaBankV1Currency.CURRENCY_RSD,
        spreadFactor: v.spreadFactor,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.forexForward.spreads() })
      form.reset()
    },
  })

  const errMsg = save.error ? apiError(save.error, 'Čuvanje spread faktora nije uspelo.') : null

  return (
    <main className="container max-w-3xl space-y-6 py-8">
      <h1 className="text-2xl font-semibold">Terminski ugovori — spread faktor</h1>
      <p className="text-sm text-muted-foreground">
        Godišnji spread faktor po valutnom paru ulazi u formulu terminskog kursa. Veći faktor znači
        veći terminski kurs za duže ročnosti.
      </p>

      <form
        onSubmit={form.handleSubmit((v) => save.mutate(v))}
        className="space-y-4 rounded-lg border border-border bg-surface p-6"
        aria-label="Podešavanje spread faktora"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Valuta (× RSD)</Label>
            <Select {...form.register('baseCurrency')}>
              <option value="">— izaberite —</option>
              {baseCurrencies.map((c) => (
                <option key={c} value={c}>
                  {currencyLabel(c)} / RSD
                </option>
              ))}
            </Select>
            {form.formState.errors.baseCurrency && (
              <div className="mt-1 text-xs text-danger">{form.formState.errors.baseCurrency.message}</div>
            )}
          </div>
          <div>
            <Label>Spread faktor (npr. 0.02 = 2%/god.)</Label>
            <Input inputMode="decimal" {...form.register('spreadFactor')} />
            {form.formState.errors.spreadFactor && (
              <div className="mt-1 text-xs text-danger">{form.formState.errors.spreadFactor.message}</div>
            )}
          </div>
        </div>

        {errMsg && <ErrorBanner>{errMsg}</ErrorBanner>}

        <div className="flex justify-end">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Čuvam…' : 'Sačuvaj'}
          </Button>
        </div>
      </form>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Podešeni parovi</h2>
        {spreads.data?.spreads && spreads.data.spreads.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>Par</TH>
                <TH className="text-right">Spread faktor</TH>
                <TH>Ažurirano</TH>
              </TR>
            </THead>
            <TBody>
              {spreads.data.spreads.map((s, i) => (
                <TR key={i}>
                  <TD>
                    {currencyLabel(s.baseCurrency!)} / {currencyLabel(s.quoteCurrency!)}
                  </TD>
                  <TD className="text-right font-mono">{s.spreadFactor}</TD>
                  <TD>{formatDateTime(s.updatedAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : (
          <Card className="p-6 text-sm text-muted-foreground">
            Nijedan par nije podešen — koristi se podrazumevani faktor (2%/god.).
          </Card>
        )}
      </section>
    </main>
  )
}
