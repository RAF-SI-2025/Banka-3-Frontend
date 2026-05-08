import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { listAccounts } from '@/lib/api/accounts'
import { listRecipients } from '@/lib/api/recipients'
import { createPayment } from '@/lib/api/payments'
import { useAuthStore } from '@/lib/auth/store'
import { keys } from '@/lib/query-keys'
import { formatMoney, formatAccountNumber, currencyLabel } from '@/lib/format'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error'

export const Route = createFileRoute('/_authed/banking/placanja')({
  component: NewPayment,
})

const schema = z.object({
  fromAccountId: z.string().min(1, 'Izaberite račun'),
  toAccountNumber: z
    .string()
    .regex(/^[0-9]{18}$/, 'Račun mora imati 18 cifara'),
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
    mutationFn: createPayment,
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
    create.mutate(rest)
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

  const errMsg = create.error
    ? // Axios error from gateway
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((create.error as any)?.response?.data?.message as string | undefined) ??
      'Greška pri kreiranju plaćanja.'
    : null

  return (
    <main className="container max-w-2xl space-y-4 py-8">
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
    </main>
  )
}

function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1 text-xs text-red-600">{msg}</p>
}
