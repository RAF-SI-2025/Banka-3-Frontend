import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { listAccounts } from '@/lib/api/accounts'
import { listRecipients } from '@/lib/api/recipients'
import { createPayment, listTransactions, schedulePayment } from '@/lib/api/payments'
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
import type { v1SchedulePaymentRequest } from '@/lib/api/generated/models/v1SchedulePaymentRequest'
import { v1TransactionStatus } from '@/lib/api/generated/models/v1TransactionStatus'
import { v1TransactionKind } from '@/lib/api/generated/models/v1TransactionKind'

// Spec p.22 "Brzo plaćanje" — home-page shortcuts deep-link here with
// `?recipientId=<uuid>`. We don't validate the UUID shape here; if it
// doesn't match any saved recipient the home-page tile wouldn't have
// produced it. An unknown id is silently ignored — the form opens
// empty rather than throwing for a stale bookmark.
export const Route = createFileRoute('/_authed/banking/placanja/')({
  component: NewPayment,
  validateSearch: (search: Record<string, unknown>) => ({
    recipientId: typeof search.recipientId === 'string' ? search.recipientId : undefined,
  }),
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
  // Spec p.21: "Šifra plaćanja - default je 289. Prva cifra je uvek 1
  // ili 2." Three digits, first 1 or 2 — defaults to 289 in the form
  // initial values below.
  paymentCode: z
    .string()
    .regex(/^[12]\d{2}$/, 'Šifra plaćanja mora biti 3 cifre i počinjati sa 1 ili 2'),
  referenceNumber: z.string().optional(),
  purpose: z.string().min(1, 'Svrha je obavezna'),
  saveRecipient: z.boolean().optional(),
  recipientTemplateId: z.string().optional(),
  // Zakazivanje plaćanja (todoSpec C2). Empty = plati odmah; a YYYY-MM-DD
  // value = zakaži za taj datum. The date must be strictly in the future
  // (the backend re-checks; we guard here for a friendly message).
  scheduleEnabled: z.boolean().optional(),
  scheduledDate: z.string().optional(),
}).superRefine((val, ctx) => {
  if (!val.scheduleEnabled) return
  if (!val.scheduledDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Izaberite datum', path: ['scheduledDate'] })
    return
  }
  // Compare against today's local date; the day must be after today.
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const picked = new Date(`${val.scheduledDate}T00:00:00`)
  if (!(picked.getTime() > today.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Datum mora biti u budućnosti', path: ['scheduledDate'] })
  }
})

type FormValues = z.infer<typeof schema>

// Pending submit payload: either an immediate payment or a scheduled one.
// The VerificationDialog gates both (the scheduling step is
// verification-gated per spec).
type PendingSubmit =
  | { mode: 'pay'; payload: v1CreatePaymentRequest }
  | { mode: 'schedule'; payload: v1SchedulePaymentRequest }

function NewPayment() {
  const navigate = useNavigate()
  const { recipientId: deepLinkRecipientId } = Route.useSearch()
  const userId = useAuthStore((s) => s.userId)
  const qc = useQueryClient()
  const [pending, setPending] = useState<PendingSubmit | null>(null)

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
      scheduleEnabled: false,
      scheduledDate: '',
    },
  })

  const scheduleEnabled = form.watch('scheduleEnabled')

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

  const schedule = useMutation({
    mutationFn: ({ payload, proof }: { payload: v1SchedulePaymentRequest; proof: VerificationProof }) =>
      schedulePayment(payload, proof),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.scheduledPayment.all })
      navigate({ to: '/banking/placanja/zakazana' })
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    const { recipientTemplateId, scheduleEnabled: sched, scheduledDate, ...rest } = values
    void recipientTemplateId
    const toAccountNumber = normalizeAccountNumber(rest.toAccountNumber)
    if (sched && scheduledDate) {
      const { saveRecipient, ...payFields } = rest
      void saveRecipient
      setPending({
        mode: 'schedule',
        payload: { ...payFields, toAccountNumber, scheduledDate: `${scheduledDate}T00:00:00Z` },
      })
      return
    }
    setPending({ mode: 'pay', payload: { ...rest, toAccountNumber } })
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

  // Apply the home-page "Brzo plaćanje" deep link once the recipients
  // query resolves. We can't fire applyTemplate before the list lands
  // (the lookup would miss). Re-running is harmless — applyTemplate is
  // idempotent for the same id — but the empty-deps guard keeps a
  // second tab-back from clobbering user edits.
  const recipientsLoaded = recipients.isSuccess
  useEffect(() => {
    if (!deepLinkRecipientId || !recipientsLoaded) return
    applyTemplate(deepLinkRecipientId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkRecipientId, recipientsLoaded])

  const errMsg = create.error
    ? apiError(create.error, 'Greška pri kreiranju plaćanja.')
    : schedule.error
      ? apiError(schedule.error, 'Greška pri zakazivanju plaćanja.')
      : null
  const submitting = create.isPending || schedule.isPending

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Novo plaćanje</h1>
        <Button variant="ghost" type="button" onClick={() => navigate({ to: '/banking/placanja/zakazana' })}>
          Zakazana plaćanja
        </Button>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-border bg-surface p-6">
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

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" {...form.register('saveRecipient')} />
          Sačuvaj primaoca
        </label>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" {...form.register('scheduleEnabled')} />
          Zakaži plaćanje
        </label>

        {scheduleEnabled && (
          <div>
            <Label>Datum izvršenja</Label>
            <Input type="date" {...form.register('scheduledDate')} />
            <FieldErr msg={form.formState.errors.scheduledDate?.message} />
          </div>
        )}

        {errMsg && <ErrorBanner>{errMsg}</ErrorBanner>}

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting
              ? 'Šaljem…'
              : scheduleEnabled
                ? 'Zakaži plaćanje'
                : 'Pošalji plaćanje'}
          </Button>
        </div>
      </form>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Istorija plaćanja</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nema plaćanja.</p>
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
                    <TD className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(t.createdAt)}</TD>
                    <TD>{outflow ? 'Odliv' : 'Priliv'}</TD>
                    <TD className="font-mono text-xs">{counterparty || '—'}</TD>
                    <TD className="text-xs text-foreground">
                      {[t.recipientName, t.purpose].filter(Boolean).join(' · ') || '—'}
                    </TD>
                    <TD className={`text-right ${outflow ? 'text-danger' : 'text-success-soft-foreground'}`}>
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
        title={pending?.mode === 'schedule' ? 'Potvrda zakazivanja' : 'Potvrda plaćanja'}
        description={
          pending?.mode === 'schedule'
            ? 'Unesite verifikacioni kod kako biste potvrdili zakazivanje plaćanja.'
            : 'Unesite verifikacioni kod kako biste potvrdili plaćanje.'
        }
        onCancel={() => setPending(null)}
        onConfirm={async (proof) => {
          if (!pending) return
          if (pending.mode === 'schedule') {
            await schedule.mutateAsync({ payload: pending.payload, proof })
          } else {
            await create.mutateAsync({ payload: pending.payload, proof })
          }
          setPending(null)
        }}
      />
    </main>
  )
}

function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1 text-xs text-danger">{msg}</p>
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
