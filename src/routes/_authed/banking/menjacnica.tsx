import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { listAccounts } from '@/lib/api/accounts'
import { quoteExchange, createTransfer } from '@/lib/api/payments'
import { listRates } from '@/lib/api/rates'
import { apiError } from '@/lib/api/error'
import type { VerificationProof } from '@/lib/api/verification'
import { useAuthStore } from '@/lib/auth/store'
import { keys } from '@/lib/query-keys'
import { formatMoney, formatAccountNumber, currencyLabel, formatRate } from '@/lib/format'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error'
import { Card } from '@/components/ui/card'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { VerificationDialog } from '@/components/verification/verification-dialog'
import { bankaExchangeV1Currency } from '@/lib/api/generated/models/bankaExchangeV1Currency'
import type { v1CreateTransferRequest } from '@/lib/api/generated/models/v1CreateTransferRequest'

export const Route = createFileRoute('/_authed/banking/menjacnica')({
  component: Menjacnica,
})

const schema = z
  .object({
    fromAccountId: z.string().min(1, 'Izaberite račun'),
    toAccountId: z.string().min(1, 'Izaberite račun'),
    amount: z.string().regex(/^[0-9]+(\.[0-9]{1,2})?$/, 'Iznos mora biti broj'),
  })
  .refine((d) => d.fromAccountId !== d.toAccountId, {
    path: ['toAccountId'],
    message: 'Računi moraju biti različiti',
  })

type FormValues = z.infer<typeof schema>

function Menjacnica() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.userId)
  const qc = useQueryClient()
  const [pending, setPending] = useState<v1CreateTransferRequest | null>(null)

  const accounts = useQuery({
    queryKey: keys.account.list({ ownerClientId: userId }),
    queryFn: () => listAccounts({ ownerClientId: userId ?? undefined }),
    enabled: !!userId,
  })
  const rates = useQuery({
    queryKey: keys.rates.all,
    queryFn: () => listRates(),
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fromAccountId: '', toAccountId: '', amount: '' },
  })

  const fromId = form.watch('fromAccountId')
  const toId = form.watch('toAccountId')
  const amount = form.watch('amount')
  const fromAcc = accounts.data?.accounts?.find((a) => a.id === fromId)
  const toAcc = accounts.data?.accounts?.find((a) => a.id === toId)

  const quote = useQuery({
    queryKey: ['exchangeQuote', fromAcc?.currency, toAcc?.currency, amount],
    queryFn: () =>
      quoteExchange({
        from: fromAcc!.currency,
        to: toAcc!.currency,
        amount,
        includeCommission: true,
      }),
    enabled:
      !!fromAcc?.currency &&
      !!toAcc?.currency &&
      fromAcc.currency !== toAcc.currency &&
      /^[0-9]+(\.[0-9]{1,2})?$/.test(amount) &&
      Number(amount) > 0,
  })

  const exec = useMutation({
    mutationFn: ({ payload, proof }: { payload: v1CreateTransferRequest; proof: VerificationProof }) =>
      createTransfer(payload, proof),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.account.all })
      qc.invalidateQueries({ queryKey: keys.transaction.all })
      navigate({ to: '/banking/racuni' })
    },
  })

  const errMsg = exec.error ? apiError(exec.error, 'Greška pri zameni valuta.') : null

  function onSubmit(v: FormValues) {
    setPending({ fromAccountId: v.fromAccountId, toAccountId: v.toAccountId, amount: v.amount })
  }

  return (
    <main className="container max-w-3xl space-y-6 py-8">
      <h1 className="text-2xl font-semibold">Menjačnica</h1>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4 rounded-lg border border-gray-200 bg-white p-6"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Sa računa</Label>
            <Select {...form.register('fromAccountId')}>
              <option value="">— izaberite —</option>
              {accounts.data?.accounts?.map((a) => (
                <option key={a.id} value={a.id}>
                  {formatAccountNumber(a.number)} · {currencyLabel(a.currency!)}
                </option>
              ))}
            </Select>
            {fromAcc && (
              <div className="mt-1 text-xs text-gray-500">
                Raspoloživo: {formatMoney(fromAcc.availableBalance, currencyLabel(fromAcc.currency!))}
              </div>
            )}
          </div>
          <div>
            <Label>Na račun</Label>
            <Select {...form.register('toAccountId')}>
              <option value="">— izaberite —</option>
              {accounts.data?.accounts?.map((a) => (
                <option key={a.id} value={a.id}>
                  {formatAccountNumber(a.number)} · {currencyLabel(a.currency!)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label>Iznos ({fromAcc ? currencyLabel(fromAcc.currency!) : '—'})</Label>
          <Input inputMode="decimal" {...form.register('amount')} />
        </div>

        {fromAcc?.currency === toAcc?.currency && fromAcc && toAcc && (
          <p className="text-sm text-amber-700">
            Računi imaju istu valutu — koristite stranicu Transferi.
          </p>
        )}

        {quote.data && (
          <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-900">
            <div className="grid grid-cols-2 gap-2">
              <div>Kurs:</div>
              <div className="text-right font-mono">{formatRate(quote.data.rate)}</div>
              <div>Provizija:</div>
              <div className="text-right">
                {formatMoney(quote.data.commission, currencyLabel(toAcc!.currency!))}
              </div>
              <div className="font-medium">Dobijate:</div>
              <div className="text-right font-mono font-semibold">
                {formatMoney(quote.data.toAmount, currencyLabel(toAcc!.currency!))}
              </div>
            </div>
          </div>
        )}

        {errMsg && <ErrorBanner>{errMsg}</ErrorBanner>}

        <div className="flex justify-end">
          <Button type="submit" disabled={exec.isPending || quote.isFetching}>
            {exec.isPending ? 'Šaljem…' : 'Realizuj'}
          </Button>
        </div>
      </form>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Kursna lista</h2>
        {rates.data?.rates && rates.data.rates.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>Iz</TH>
                <TH>U</TH>
                <TH className="text-right">Kupovni</TH>
                <TH className="text-right">Prodajni</TH>
              </TR>
            </THead>
            <TBody>
              {rates.data.rates
                .filter(
                  (r) =>
                    r.from === bankaExchangeV1Currency.CURRENCY_RSD ||
                    r.to === bankaExchangeV1Currency.CURRENCY_RSD,
                )
                .map((r, i) => (
                  <TR key={i}>
                    <TD>{currencyLabel(r.from!)}</TD>
                    <TD>{currencyLabel(r.to!)}</TD>
                    <TD className="text-right font-mono">{formatRate(r.bid)}</TD>
                    <TD className="text-right font-mono">{formatRate(r.ask)}</TD>
                  </TR>
                ))}
            </TBody>
          </Table>
        ) : (
          <Card className="p-6 text-sm text-gray-500">Kursna lista nije dostupna.</Card>
        )}
      </section>
      <VerificationDialog
        open={!!pending}
        kind="transfer"
        title="Potvrda menjačnice"
        description="Unesite verifikacioni kod kako biste potvrdili zamenu valuta."
        onCancel={() => setPending(null)}
        onConfirm={async (proof) => {
          if (!pending) return
          await exec.mutateAsync({ payload: pending, proof })
          setPending(null)
        }}
      />
    </main>
  )
}
