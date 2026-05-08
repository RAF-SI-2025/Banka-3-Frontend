import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { listAccounts } from '@/lib/api/accounts'
import { createTransfer } from '@/lib/api/payments'
import { useAuthStore } from '@/lib/auth/store'
import { keys } from '@/lib/query-keys'
import { formatMoney, formatAccountNumber, currencyLabel } from '@/lib/format'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error'

export const Route = createFileRoute('/_authed/banking/transferi')({
  component: NewTransfer,
})

const schema = z
  .object({
    fromAccountId: z.string().min(1, 'Izaberite račun pošiljaoca'),
    toAccountId: z.string().min(1, 'Izaberite račun primaoca'),
    amount: z.string().regex(/^[0-9]+(\.[0-9]{1,2})?$/, 'Iznos mora biti broj'),
    purpose: z.string().optional(),
  })
  .refine((d) => d.fromAccountId !== d.toAccountId, {
    path: ['toAccountId'],
    message: 'Račun primaoca mora biti različit od pošiljaoca',
  })

type FormValues = z.infer<typeof schema>

function NewTransfer() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.userId)
  const qc = useQueryClient()

  const accounts = useQuery({
    queryKey: keys.account.list({ ownerClientId: userId }),
    queryFn: () => listAccounts({ ownerClientId: userId ?? undefined }),
    enabled: !!userId,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fromAccountId: '', toAccountId: '', amount: '', purpose: '' },
  })

  const create = useMutation({
    mutationFn: createTransfer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.account.all })
      qc.invalidateQueries({ queryKey: keys.transaction.all })
      navigate({ to: '/banking/racuni' })
    },
  })

  const errMsg = create.error
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((create.error as any)?.response?.data?.message as string | undefined) ??
      'Greška pri prenosu sredstava.'
    : null

  return (
    <main className="container max-w-2xl space-y-4 py-8">
      <h1 className="text-2xl font-semibold">Transfer između mojih računa</h1>
      <form
        onSubmit={form.handleSubmit((v) => create.mutate(v))}
        className="space-y-4 rounded-lg border border-gray-200 bg-white p-6"
      >
        <div>
          <Label>Sa računa</Label>
          <Select {...form.register('fromAccountId')}>
            <option value="">— izaberite —</option>
            {accounts.data?.accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {formatAccountNumber(a.number)} · {formatMoney(a.availableBalance, currencyLabel(a.currency!))}
              </option>
            ))}
          </Select>
          {form.formState.errors.fromAccountId && (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.fromAccountId.message}</p>
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
          {form.formState.errors.toAccountId && (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.toAccountId.message}</p>
          )}
        </div>

        <div>
          <Label>Iznos</Label>
          <Input inputMode="decimal" {...form.register('amount')} />
          {form.formState.errors.amount && (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.amount.message}</p>
          )}
        </div>

        <div>
          <Label>Svrha (opciono)</Label>
          <Input {...form.register('purpose')} />
        </div>

        {errMsg && <ErrorBanner>{errMsg}</ErrorBanner>}

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Šaljem…' : 'Prenesi'}
          </Button>
        </div>
      </form>
    </main>
  )
}
