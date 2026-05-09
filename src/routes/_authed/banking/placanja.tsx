import { useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { listAccounts } from '@/lib/api/accounts'
import { listRecipients } from '@/lib/api/recipients'
import { createPayment, listTransactions } from '@/lib/api/payments'
import { apiError } from '@/lib/api/error'
import type { VerificationProof } from '@/lib/api/verification'
import { useAuthStore } from '@/lib/auth/store'
import { keys } from '@/lib/query-keys'
import { formatMoney, formatAccountNumber, currencyLabel, formatDateTime } from '@/lib/format'
import { txStatusLabel } from '@/lib/labels'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error'
import { Badge } from '@/components/ui/badge'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { AccountLimitSummary } from '@/components/accounts/account-limit-summary'
import { VerificationDialog } from '@/components/verification/verification-dialog'
import { validateAccountNumber, normalizeAccountNumber } from '@/lib/account-number'
import type { v1Account } from '@/lib/api/generated/models/v1Account'
import type { v1CreatePaymentRequest } from '@/lib/api/generated/models/v1CreatePaymentRequest'
import { v1TransactionStatus } from '@/lib/api/generated/models/v1TransactionStatus'
import { v1TransactionKind } from '@/lib/api/generated/models/v1TransactionKind'

export const Route = createFileRoute('/_authed/banking/placanja')({
  component: NewPayment,
})

// Map the validator's stable error code to a Serbian message at the
// form boundary. The "non-digit" branch is unreachable from the
// happy path because we reject anything that's not 18 chars first,
// but we surface a sane copy in case someone pastes letters in.
const accountNumberMessage = {
  'wrong-length': 'Račun mora imati 18 cifara',
  'non-digit': 'Račun sme da sadrži samo cifre',
  'checksum-mismatch': 'Neispravan kontrolni broj računa',
} as const

const schema = z.object({
  fromAccountId: z.string().min(1, 'Izaberite račun'),
  toAccountNumber: z.string().superRefine((val, ctx) => {
    const err = validateAccountNumber(val)
    if (err) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: accountNumberMessage[err] })
    }
  }),
  amount: z.string().regex(/^[0-9]+(\.[0-9]{1,2})?$/, 'Iznos mora biti broj'),
  recipientName: z.string().min(1, 'Naziv primaoca je obavezan'),
  paymentCode: z.string().min(1, 'Šifra plaćanja je obavezna'),
  referenceNumber: z.string().optional(),
  purpose: z.string().min(1, 'Svrha je obavezna'),
  saveRecipient: z.boolean().optional(),
  recipientTemplateId: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function NewPayment() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.userId)
  const qc = useQueryClient()
  const [pending, setPending] = useState<v1CreatePaymentRequest | null>(null)

  const accounts = useQuery({
    queryKey: keys.account.list({ ownerClientId: userId }),
    queryFn: () => listAccounts({ ownerClientId: userId ?? undefined }),
    enabled: !!userId,
  })
  const recipients = useQuery({
    queryKey: keys.recipient.list(),
    queryFn: () => listRecipients(),
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fromAccountId: '',
      toAccountNumber: '',
      amount: '',
      recipientName: '',
      paymentCode: '289',
      referenceNumber: '',
      purpose: '',
      saveRecipient: false,
      recipientTemplateId: '',
    },
  })

  const create = useMutation({
    mutationFn: ({ payload, proof }: { payload: v1CreatePaymentRequest; proof: VerificationProof }) =>
      createPayment(payload, proof),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.account.all })
      qc.invalidateQueries({ queryKey: keys.transaction.all })
      qc.invalidateQueries({ queryKey: keys.recipient.all })
      navigate({ to: '/banking/racuni' })
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    const { recipientTemplateId, ...rest } = values
    void recipientTemplateId
    setPending({ ...rest, toAccountNumber: normalizeAccountNumber(rest.toAccountNumber) })
  })

  function applyTemplate(id: string) {
    form.setValue('recipientTemplateId', id)
    if (!id) return
    const r = recipients.data?.recipients?.find((x) => x.id === id)
    if (r) {
      form.setValue('recipientName', r.name ?? '')
      form.setValue('toAccountNumber', r.accountNumber ?? '')
    }
  }

  const errMsg = create.error ? apiError(create.error, 'Greška pri kreiranju plaćanja.') : null

  // Pull payment-kind history for every account the client owns and
  // merge into one list, newest first. Per-account fetch is the only
  // thing the API offers; the volume is fine — clients have a handful
  // of accounts and pageSize caps each leg.
  const accountIds = useMemo(
    () => (accounts.data?.accounts ?? []).map((a) => a.id!).filter(Boolean),
    [accounts.data],
  )
  const txQueries = useQueries({
    queries: accountIds.map((accountId) => ({
      queryKey: keys.transaction.list({ accountId, opKind: 'payment' as const, pageSize: 50 }),
      queryFn: () => listTransactions({ accountId, opKind: 'payment' as const, pageSize: 50 }),
    })),
  })
  // Merge legs from every account, dedup by id (the gateway returns one
  // row per leg — for a payment, only one of those legs touches a
  // user-owned account, so a single id is the canonical entry).
  const history = useMemo(() => {
    const seen = new Set<string>()
    const out: NonNullable<(typeof txQueries)[number]['data']>['transactions'] = []
    for (const q of txQueries) {
      for (const t of q.data?.transactions ?? []) {
        if (!t.id || seen.has(t.id)) continue
        if (t.kind !== v1TransactionKind.TRANSACTION_KIND_PAYMENT) continue
        seen.add(t.id)
        out!.push(t)
      }
    }
    out!.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    return out!
  }, [txQueries])
  const ownAccountIds = useMemo(() => new Set(accountIds), [accountIds])

  return (
    <main className="container max-w-3xl space-y-6 py-8">
      <h1 className="text-2xl font-semibold">Novo plaćanje</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <div>
          <Label>Račun pošiljaoca</Label>
          <Select {...form.register('fromAccountId')}>
            <option value="">— izaberite —</option>
            {accounts.data?.accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {formatAccountNumber(a.number)} · {formatMoney(a.availableBalance, currencyLabel(a.currency!))}
              </option>
            ))}
          </Select>
          <FieldErr msg={form.formState.errors.fromAccountId?.message} />
          <SelectedAccountLimits accounts={accounts.data?.accounts} selectedId={form.watch('fromAccountId')} />
        </div>

        {recipients.data?.recipients && recipients.data.recipients.length > 0 && (
          <div>
            <Label>Sačuvani primaoci</Label>
            <Select onChange={(e) => applyTemplate(e.target.value)} value={form.watch('recipientTemplateId') ?? ''}>
              <option value="">— ručni unos —</option>
              {recipients.data.recipients.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · {formatAccountNumber(r.accountNumber)}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <Label>Naziv primaoca</Label>
          <Input {...form.register('recipientName')} />
          <FieldErr msg={form.formState.errors.recipientName?.message} />
        </div>

        <div>
          <Label>Račun primaoca (18 cifara)</Label>
          <Input className="font-mono" {...form.register('toAccountNumber')} />
          <FieldErr msg={form.formState.errors.toAccountNumber?.message} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Iznos</Label>
            <Input inputMode="decimal" {...form.register('amount')} />
            <FieldErr msg={form.formState.errors.amount?.message} />
          </div>
          <div>
            <Label>Šifra plaćanja</Label>
            <Input maxLength={3} {...form.register('paymentCode')} />
            <FieldErr msg={form.formState.errors.paymentCode?.message} />
          </div>
        </div>

        <div>
          <Label>Poziv na broj (opciono)</Label>
          <Input {...form.register('referenceNumber')} />
        </div>

        <div>
          <Label>Svrha</Label>
          <Input {...form.register('purpose')} />
          <FieldErr msg={form.formState.errors.purpose?.message} />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" {...form.register('saveRecipient')} />
          Sačuvaj primaoca
        </label>

        {errMsg && <ErrorBanner>{errMsg}</ErrorBanner>}

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Šaljem…' : 'Pošalji plaćanje'}
          </Button>
        </div>
      </form>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Istorija plaćanja</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">Nema plaćanja.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Datum</TH>
                <TH>Smer</TH>
                <TH>Drugi račun</TH>
                <TH>Primalac / svrha</TH>
                <TH className="text-right">Iznos</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {history.map((t) => {
                const outflow = !!t.fromAccountId && ownAccountIds.has(t.fromAccountId)
                const counterparty = outflow ? t.toAccountId : t.fromAccountId
                const amount = outflow ? t.fromAmount : t.toAmount
                return (
                  <TR key={t.id}>
                    <TD className="whitespace-nowrap text-xs text-gray-600">{formatDateTime(t.createdAt)}</TD>
                    <TD>{outflow ? 'Odliv' : 'Priliv'}</TD>
                    <TD className="font-mono text-xs">{counterparty || '—'}</TD>
                    <TD className="text-xs text-gray-700">
                      {[t.recipientName, t.purpose].filter(Boolean).join(' · ') || '—'}
                    </TD>
                    <TD className={`text-right ${outflow ? 'text-red-600' : 'text-green-700'}`}>
                      {outflow ? '-' : '+'}
                      {formatMoney(amount)}
                    </TD>
                    <TD>
                      <Badge
                        tone={
                          t.status === v1TransactionStatus.TRANSACTION_STATUS_REALIZED
                            ? 'green'
                            : t.status === v1TransactionStatus.TRANSACTION_STATUS_REJECTED
                              ? 'red'
                              : 'yellow'
                        }
                      >
                        {txStatusLabel[t.status!]}
                      </Badge>
                    </TD>
                  </TR>
                )
              })}
              {history.length === 0 && <EmptyRow colSpan={6}>Nema plaćanja.</EmptyRow>}
            </TBody>
          </Table>
        )}
      </section>
      <VerificationDialog
        open={!!pending}
        kind="payment"
        title="Potvrda plaćanja"
        description="Unesite verifikacioni kod kako biste potvrdili plaćanje."
        onCancel={() => setPending(null)}
        onConfirm={async (proof) => {
          if (!pending) return
          await create.mutateAsync({ payload: pending, proof })
          setPending(null)
        }}
      />
    </main>
  )
}

function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1 text-xs text-red-600">{msg}</p>
}

// SelectedAccountLimits renders the limit summary panel only once a
// real account has been chosen. Kept inside this file because it's
// trivially form-coupled — the panel itself is the reusable bit.
function SelectedAccountLimits({
  accounts,
  selectedId,
}: {
  accounts: v1Account[] | undefined
  selectedId: string
}) {
  if (!selectedId) return null
  const a = accounts?.find((x) => x.id === selectedId)
  if (!a) return null
  return (
    <div className="mt-2">
      <AccountLimitSummary account={a} />
    </div>
  )
}
