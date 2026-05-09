import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { listRates, upsertRate } from '@/lib/api/rates'
import { apiError } from '@/lib/api/error'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ErrorBanner } from '@/components/ui/error'
import { currencyLabel, formatDateTime } from '@/lib/format'
import { bankaExchangeV1Currency } from '@/lib/api/generated/models/bankaExchangeV1Currency'

export const Route = createFileRoute('/_authed/portal/exchange/')({
  component: PortalExchange,
})

const schema = z.object({
  from: z.nativeEnum(bankaExchangeV1Currency),
  to: z.nativeEnum(bankaExchangeV1Currency),
  bid: z.string().regex(/^[0-9]+(\.[0-9]+)?$/),
  ask: z.string().regex(/^[0-9]+(\.[0-9]+)?$/),
})
type FormValues = z.infer<typeof schema>

function PortalExchange() {
  const qc = useQueryClient()
  const perms = useAuthStore((s) => s.permissions)
  const canWrite = has(perms, Permissions.ExchangeWrite)

  const rates = useQuery({
    queryKey: keys.rates.all,
    queryFn: () => listRates(),
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      from: bankaExchangeV1Currency.CURRENCY_EUR,
      to: bankaExchangeV1Currency.CURRENCY_RSD,
      bid: '',
      ask: '',
    },
  })

  const upsert = useMutation({
    mutationFn: upsertRate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.rates.all })
      form.reset({ ...form.getValues(), bid: '', ask: '' })
    },
  })

  const errMsg = upsert.error ? apiError(upsert.error, 'Greška pri upisu kursa.') : null

  return (
    <main className="container space-y-6 py-8">
      <h1 className="text-2xl font-semibold">Kursna lista</h1>

      {canWrite && (
        <form onSubmit={form.handleSubmit((v) => upsert.mutate(v))} className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-white p-6 md:grid-cols-5">
          <div>
            <Label>Iz</Label>
            <Select {...form.register('from')}>
              {Object.values(bankaExchangeV1Currency)
                .filter((c) => c !== bankaExchangeV1Currency.CURRENCY_UNSPECIFIED)
                .map((c) => (
                  <option key={c} value={c}>
                    {currencyLabel(c)}
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <Label>U</Label>
            <Select {...form.register('to')}>
              {Object.values(bankaExchangeV1Currency)
                .filter((c) => c !== bankaExchangeV1Currency.CURRENCY_UNSPECIFIED)
                .map((c) => (
                  <option key={c} value={c}>
                    {currencyLabel(c)}
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <Label>Kupovni</Label>
            <Input {...form.register('bid')} />
          </div>
          <div>
            <Label>Prodajni</Label>
            <Input {...form.register('ask')} />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={upsert.isPending} className="w-full">
              {upsert.isPending ? 'Čuvam…' : 'Sačuvaj'}
            </Button>
          </div>
          {errMsg && (
            <div className="md:col-span-5">
              <ErrorBanner>{errMsg}</ErrorBanner>
            </div>
          )}
        </form>
      )}

      {rates.data && (
        <Table>
          <THead>
            <TR>
              <TH>Iz</TH>
              <TH>U</TH>
              <TH className="text-right">Kupovni</TH>
              <TH className="text-right">Prodajni</TH>
              <TH>Ažurirano</TH>
            </TR>
          </THead>
          <TBody>
            {rates.data.rates?.map((r, i) => (
              <TR key={i}>
                <TD>{currencyLabel(r.from!)}</TD>
                <TD>{currencyLabel(r.to!)}</TD>
                <TD className="text-right font-mono">{r.bid}</TD>
                <TD className="text-right font-mono">{r.ask}</TD>
                <TD className="text-xs">{formatDateTime(r.updatedAt)}</TD>
              </TR>
            ))}
            {(!rates.data.rates || rates.data.rates.length === 0) && <EmptyRow colSpan={5}>Nema kurseva.</EmptyRow>}
          </TBody>
        </Table>
      )}
    </main>
  )
}
