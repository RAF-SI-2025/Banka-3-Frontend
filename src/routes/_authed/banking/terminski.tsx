import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import {
  quoteForexForward,
  createForexForward,
  listForexForwards,
  cancelForexForward,
} from '@/lib/api/forex-forwards'
import { apiError } from '@/lib/api/error'
import type { VerificationProof } from '@/lib/api/verification'
import { keys } from '@/lib/query-keys'
import { formatMoney, formatRate, currencyLabel, formatDate } from '@/lib/format'
import { forexForwardStatusLabel } from '@/lib/labels'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error'
import { Card } from '@/components/ui/card'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { VerificationDialog } from '@/components/verification/verification-dialog'
import { bankaBankV1Currency } from '@/lib/api/generated/models/bankaBankV1Currency'
import { v1ForexForwardStatus } from '@/lib/api/generated/models/v1ForexForwardStatus'
import type { v1CreateForexForwardRequest } from '@/lib/api/generated/models/v1CreateForexForwardRequest'

export const Route = createFileRoute('/_authed/banking/terminski')({
  component: TerminskiUgovori,
})

// Forward base currencies — everything except RSD (the settlement leg).
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
  notional: z.string().regex(/^[0-9]+(\.[0-9]{1,2})?$/, 'Iznos mora biti broj'),
  settlementDate: z.string().min(1, 'Izaberite datum'),
})

type FormValues = z.infer<typeof schema>

// <input type="date"> yields a bare YYYY-MM-DD; grpc-gateway needs a full
// RFC3339 timestamp or it rejects "invalid google.protobuf.Timestamp".
// Pin midnight UTC. See [[yyyymmdd-proto-timestamp]].
function toTimestamp(date: string): string {
  return `${date}T00:00:00Z`
}

function TerminskiUgovori() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [pending, setPending] = useState<v1CreateForexForwardRequest | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { baseCurrency: '', notional: '', settlementDate: '' },
  })

  const base = form.watch('baseCurrency')
  const notional = form.watch('notional')
  const settlementDate = form.watch('settlementDate')

  const quote = useQuery({
    queryKey: keys.forexForward.quote({ base, notional, settlementDate }),
    queryFn: () =>
      quoteForexForward({
        baseCurrency: base as bankaBankV1Currency,
        notional,
        settlementDate: toTimestamp(settlementDate),
      }),
    enabled:
      !!base &&
      /^[0-9]+(\.[0-9]{1,2})?$/.test(notional) &&
      Number(notional) > 0 &&
      !!settlementDate &&
      new Date(toTimestamp(settlementDate)) > new Date(),
  })

  const forwards = useQuery({
    queryKey: keys.forexForward.list(),
    queryFn: () => listForexForwards(),
  })

  const conclude = useMutation({
    mutationFn: ({ payload, proof }: { payload: v1CreateForexForwardRequest; proof: VerificationProof }) =>
      createForexForward(payload, proof),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.forexForward.all })
      qc.invalidateQueries({ queryKey: keys.account.all })
      form.reset()
    },
  })

  const cancel = useMutation({
    mutationFn: (id: string) => cancelForexForward(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.forexForward.all })
      qc.invalidateQueries({ queryKey: keys.account.all })
    },
  })

  const errMsg = conclude.error
    ? apiError(conclude.error, 'Greška pri zaključivanju terminskog ugovora.')
    : quote.error
      ? apiError(quote.error, 'Ponuda nije dostupna za izabrane parametre.')
      : null

  function onSubmit(v: FormValues) {
    setPending({
      baseCurrency: v.baseCurrency as bankaBankV1Currency,
      notional: v.notional,
      settlementDate: toTimestamp(v.settlementDate),
    })
  }

  return (
    <main className="container max-w-3xl space-y-6 py-8">
      <h1 className="text-2xl font-semibold">Terminski valutni ugovori</h1>
      <p className="text-sm text-muted-foreground">
        Fiksirajte danas kurs za buduću konverziju valuta. Na datum poravnanja banka tereti vaš RSD
        račun i pripisuje ugovoreni iznos na devizni račun po unapred utvrđenom kursu.
      </p>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4 rounded-lg border border-border bg-surface p-6"
        aria-label="Nov terminski ugovor"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Valuta</Label>
            <Select {...form.register('baseCurrency')}>
              <option value="">— izaberite —</option>
              {baseCurrencies.map((c) => (
                <option key={c} value={c}>
                  {currencyLabel(c)}
                </option>
              ))}
            </Select>
            {form.formState.errors.baseCurrency && (
              <div className="mt-1 text-xs text-danger">{form.formState.errors.baseCurrency.message}</div>
            )}
          </div>
          <div>
            <Label>Datum poravnanja</Label>
            <Input type="date" {...form.register('settlementDate')} />
            {form.formState.errors.settlementDate && (
              <div className="mt-1 text-xs text-danger">{form.formState.errors.settlementDate.message}</div>
            )}
          </div>
        </div>

        <div>
          <Label>Nominalni iznos ({base ? currencyLabel(base) : '—'})</Label>
          <Input inputMode="decimal" {...form.register('notional')} />
          {form.formState.errors.notional && (
            <div className="mt-1 text-xs text-danger">{form.formState.errors.notional.message}</div>
          )}
        </div>

        {quote.data && (
          <div className="rounded-md bg-primary-soft p-4 text-sm text-primary-soft-foreground">
            <div className="grid grid-cols-2 gap-2">
              <div>Terminski kurs:</div>
              <div className="text-right font-mono">{formatRate(quote.data.forwardRate)}</div>
              <div>Spot kurs (prodajni):</div>
              <div className="text-right font-mono">{formatRate(quote.data.spotAskRate)}</div>
              <div>Dana do poravnanja:</div>
              <div className="text-right">{quote.data.daysToSettlement}</div>
              <div>Provizija:</div>
              <div className="text-right">{formatMoney(quote.data.commission, 'RSD')}</div>
              <div className="font-medium">Obaveza (rezerviše se):</div>
              <div className="text-right font-mono font-semibold">
                {formatMoney(quote.data.quoteAmount, 'RSD')}
              </div>
            </div>
          </div>
        )}

        {errMsg && <ErrorBanner>{errMsg}</ErrorBanner>}

        <div className="flex justify-end">
          <Button type="submit" disabled={conclude.isPending || quote.isFetching || !quote.data}>
            {conclude.isPending ? 'Šaljem…' : 'Zaključi ugovor'}
          </Button>
        </div>
      </form>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Moji terminski ugovori</h2>
        {forwards.data?.forexForwards && forwards.data.forexForwards.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>Valuta</TH>
                <TH className="text-right">Nominala</TH>
                <TH className="text-right">Kurs</TH>
                <TH>Poravnanje</TH>
                <TH>Status</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {forwards.data.forexForwards.map((f) => (
                <TR key={f.id}>
                  <TD>{currencyLabel(f.baseCurrency!)}</TD>
                  <TD className="text-right font-mono">
                    {formatMoney(f.notional, currencyLabel(f.baseCurrency!))}
                  </TD>
                  <TD className="text-right font-mono">{formatRate(f.forwardRate)}</TD>
                  <TD>{formatDate(f.settlementDate)}</TD>
                  <TD>{forexForwardStatusLabel[f.status ?? v1ForexForwardStatus.FOREX_FORWARD_STATUS_UNSPECIFIED]}</TD>
                  <TD className="text-right">
                    {f.status === v1ForexForwardStatus.FOREX_FORWARD_STATUS_ACTIVE && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={cancel.isPending}
                        onClick={() => cancel.mutate(f.id!)}
                      >
                        Otkaži
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : (
          <Card className="p-6 text-sm text-muted-foreground">Nemate zaključene terminske ugovore.</Card>
        )}
        {cancel.error && <ErrorBanner>{apiError(cancel.error, 'Otkazivanje nije uspelo.')}</ErrorBanner>}
      </section>

      <VerificationDialog
        open={!!pending}
        kind="payment"
        title="Potvrda terminskog ugovora"
        description="Unesite verifikacioni kod kako biste potvrdili zaključivanje ugovora."
        onCancel={() => setPending(null)}
        onConfirm={async (proof) => {
          if (!pending) return
          await conclude.mutateAsync({ payload: pending, proof })
          setPending(null)
        }}
      />

      <div className="flex justify-start">
        <Button variant="ghost" onClick={() => navigate({ to: '/banking/menjacnica' })}>
          ← Nazad na menjačnicu
        </Button>
      </div>
    </main>
  )
}
