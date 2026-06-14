import { useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { listAccounts } from '@/lib/api/accounts'
import {
  submitCrossBankPayment,
  type SubmitCrossBankPaymentBody,
  type SubmitCrossBankPaymentResult,
} from '@/lib/api/crossBankPayment'
import type { InterbankCurrency } from '@/lib/api/scheduledInterbank'
import { apiError } from '@/lib/api/error'
import type { VerificationProof } from '@/lib/api/verification'
import { useAuthStore } from '@/lib/auth/store'
import { keys } from '@/lib/query-keys'
import { formatMoney, formatAccountNumber, currencyLabel } from '@/lib/format'
import { validateAccountNumber, normalizeAccountNumber } from '@/lib/account-number'
import { v1AccountStatus } from '@/lib/api/generated/models/v1AccountStatus'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error'
import { Badge } from '@/components/ui/badge'
import { VerificationDialog } from '@/components/verification/verification-dialog'

export const Route = createFileRoute('/_authed/banking/placanja/inostrane')({
  component: CrossBankPayment,
})

const accountNumberMessage = {
  'wrong-length': 'Račun mora imati 18 cifara',
  'non-digit': 'Račun sme da sadrži samo cifre',
  'checksum-mismatch': 'Neispravan kontrolni broj računa',
} as const

const schema = z
  .object({
    sourceAccountId: z.string().min(1, 'Izaberite račun'),
    // Bank code is the 3-digit prefix of the 18-digit account number.
    destBankCode: z.string().regex(/^\d{3}$/, 'Kod banke mora imati 3 cifre'),
    destAccountNumber: z.string().superRefine((val, ctx) => {
      const err = validateAccountNumber(val)
      if (err) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: accountNumberMessage[err] })
      }
    }),
    amount: z.string().regex(/^[0-9]+(\.[0-9]{1,2})?$/, 'Iznos mora biti broj'),
    purpose: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    // The backend requires the account number to start with the named
    // bank code — guard here for a friendly message before round-trip.
    const acc = normalizeAccountNumber(val.destAccountNumber)
    if (acc.length === 18 && /^\d{3}$/.test(val.destBankCode) && !acc.startsWith(val.destBankCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Račun ne pripada navedenoj banci',
        path: ['destAccountNumber'],
      })
    }
  })

type FormValues = z.infer<typeof schema>

// Maps a bank account's currency enum to the trading-service Currency
// the cross-bank endpoint accepts. Same set as the scheduled variant.
function toInterbankCurrency(currency: string | undefined): InterbankCurrency | '' {
  switch (currency) {
    case 'CURRENCY_RSD':
    case 'CURRENCY_EUR':
    case 'CURRENCY_CHF':
    case 'CURRENCY_USD':
    case 'CURRENCY_GBP':
    case 'CURRENCY_JPY':
    case 'CURRENCY_CAD':
    case 'CURRENCY_AUD':
      return currency
    default:
      return ''
  }
}

// uuid for the body idempotency key. The axios client also stamps an
// Idempotency-Key header, but the backend derives the saga id from this
// body field, so it must be stable across a verification retry — hence
// it lives in the pending payload, generated once at submit time.
function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function CrossBankPayment() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.userId)
  const qc = useQueryClient()
  const [pending, setPending] = useState<SubmitCrossBankPaymentBody | null>(null)
  const [result, setResult] = useState<SubmitCrossBankPaymentResult | null>(null)

  const accounts = useQuery({
    queryKey: keys.account.list({ ownerClientId: userId }),
    queryFn: () => listAccounts({ ownerClientId: userId ?? undefined }),
    enabled: !!userId,
  })
  const activeAccounts = (accounts.data?.accounts ?? []).filter(
    (a) => a.status === v1AccountStatus.ACCOUNT_STATUS_ACTIVE,
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      sourceAccountId: '',
      destBankCode: '',
      destAccountNumber: '',
      amount: '',
      purpose: '',
    },
  })

  const sourceAccountId = form.watch('sourceAccountId')
  const selectedAccount = useMemo(
    () => activeAccounts.find((a) => a.id === sourceAccountId),
    [activeAccounts, sourceAccountId],
  )
  const currency = toInterbankCurrency(selectedAccount?.currency)

  const submit = useMutation({
    mutationFn: ({ body, proof }: { body: SubmitCrossBankPaymentBody; proof: VerificationProof }) =>
      submitCrossBankPayment(body, proof),
    onSuccess: (res) => {
      setResult(res)
      qc.invalidateQueries({ queryKey: keys.account.all })
      qc.invalidateQueries({ queryKey: keys.transaction.all })
      form.reset()
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    if (!currency) return
    setResult(null)
    setPending({
      idempotencyKey: uuid(),
      sourceAccountId: values.sourceAccountId,
      remoteBankCode: values.destBankCode.trim(),
      remoteAccountNumber: normalizeAccountNumber(values.destAccountNumber),
      currency,
      amount: values.amount.trim(),
      purpose: values.purpose?.trim() || undefined,
    })
  })

  const errMsg = submit.error ? apiError(submit.error, 'Greška pri slanju plaćanja.') : null

  return (
    <main className="container max-w-3xl space-y-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Međubankarsko plaćanje</h1>
        <Button
          variant="ghost"
          type="button"
          onClick={() => navigate({ to: '/banking/placanja/inostrane-zakazane' })}
        >
          Zakazane inostrane uplate
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Pošaljite novac na račun u drugoj banci. Plaćanje se izvršava odmah
        (2-fazni commit sa bankom primaoca) i potvrđuje se verifikacionim kodom.
      </p>

      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-border bg-surface p-6">
        <div>
          <Label>Račun pošiljaoca</Label>
          <Select {...form.register('sourceAccountId')}>
            <option value="">— izaberite —</option>
            {activeAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {formatAccountNumber(a.number)} · {formatMoney(a.availableBalance, currencyLabel(a.currency!))}
              </option>
            ))}
          </Select>
          <FieldErr msg={form.formState.errors.sourceAccountId?.message} />
          {selectedAccount && !currency && (
            <p className="mt-1 text-xs text-danger">
              Valuta ovog računa nije podržana za međubankarska plaćanja.
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Banka primaoca (kod)</Label>
            <Input className="font-mono" placeholder="222" maxLength={3} {...form.register('destBankCode')} />
            <FieldErr msg={form.formState.errors.destBankCode?.message} />
          </div>
          <div className="col-span-2">
            <Label>Račun primaoca (18 cifara)</Label>
            <Input className="font-mono" placeholder="18 cifara" {...form.register('destAccountNumber')} />
            <FieldErr msg={form.formState.errors.destAccountNumber?.message} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Iznos {currency ? `(${currencyLabel(currency)})` : ''}</Label>
            <Input inputMode="decimal" placeholder="1000" {...form.register('amount')} />
            <FieldErr msg={form.formState.errors.amount?.message} />
          </div>
          <div>
            <Label>Svrha (opciono)</Label>
            <Input {...form.register('purpose')} />
          </div>
        </div>

        {errMsg && <ErrorBanner>{errMsg}</ErrorBanner>}

        {result && (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm" data-cy="cross-bank-result">
            <span className="mr-2 font-medium">Status:</span>
            <CrossBankStatusBadge status={result.status} />
            {result.lastError && <p className="mt-1 text-xs text-danger">{result.lastError}</p>}
            {result.transactionId && (
              <p className="mt-1 font-mono text-xs text-muted-foreground">{result.transactionId}</p>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={submit.isPending || (!!selectedAccount && !currency)} data-cy="cross-bank-submit">
            {submit.isPending ? 'Šaljem…' : 'Pošalji plaćanje'}
          </Button>
        </div>
      </form>

      <VerificationDialog
        open={!!pending}
        kind="interbank_payment"
        title="Potvrda međubankarskog plaćanja"
        description="Unesite verifikacioni kod kako biste potvrdili plaćanje ka drugoj banci."
        onCancel={() => setPending(null)}
        onConfirm={async (proof) => {
          if (!pending) return
          await submit.mutateAsync({ body: pending, proof })
          setPending(null)
        }}
      />
    </main>
  )
}

function CrossBankStatusBadge({ status }: { status?: string }) {
  if (status === 'completed') return <Badge tone="green">Izvršeno</Badge>
  if (status === 'running') return <Badge tone="yellow">U obradi</Badge>
  if (status === 'failed' || status === 'compensating') return <Badge tone="red">Neuspešno</Badge>
  return <Badge tone="neutral">{status ?? '—'}</Badge>
}

function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1 text-xs text-danger">{msg}</p>
}
