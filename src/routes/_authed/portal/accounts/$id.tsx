import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  getAccount,
  updateAccountLimits,
  setAccountStatus,
} from '@/lib/api/accounts'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import {
  formatMoney,
  formatAccountNumber,
  currencyLabel,
} from '@/lib/format'
import {
  accountKindLabel,
  accountSubtypeLabel,
  accountStatusLabel,
} from '@/lib/labels'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorBanner } from '@/components/ui/error'
import { v1AccountStatus } from '@/lib/api/generated/models/v1AccountStatus'

export const Route = createFileRoute('/_authed/portal/accounts/$id')({
  component: PortalAccountDetail,
})

const limitsSchema = z.object({
  dailyLimit: z.string().regex(/^[0-9]+(\.[0-9]{1,2})?$/, 'Iznos mora biti broj'),
  monthlyLimit: z.string().regex(/^[0-9]+(\.[0-9]{1,2})?$/, 'Iznos mora biti broj'),
})
type LimitsValues = z.infer<typeof limitsSchema>

function PortalAccountDetail() {
  const { id } = Route.useParams()
  const qc = useQueryClient()
  const perms = useAuthStore((s) => s.permissions)
  const canWrite = has(perms, Permissions.AccountWrite)

  const account = useQuery({
    queryKey: keys.account.detail(id),
    queryFn: () => getAccount(id),
  })

  const form = useForm<LimitsValues>({
    resolver: zodResolver(limitsSchema),
    defaultValues: { dailyLimit: '', monthlyLimit: '' },
  })

  useEffect(() => {
    if (account.data) {
      form.reset({
        dailyLimit: account.data.dailyLimit ?? '0',
        monthlyLimit: account.data.monthlyLimit ?? '0',
      })
    }
  }, [account.data, form])

  const update = useMutation({
    mutationFn: (body: LimitsValues) => updateAccountLimits(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.account.detail(id) }),
  })

  const flipStatus = useMutation({
    mutationFn: () =>
      setAccountStatus(id, {
        status:
          account.data?.status === v1AccountStatus.ACCOUNT_STATUS_ACTIVE
            ? v1AccountStatus.ACCOUNT_STATUS_INACTIVE
            : v1AccountStatus.ACCOUNT_STATUS_ACTIVE,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.account.detail(id) }),
  })

  if (account.isLoading) return <p className="container py-8 text-gray-500">Učitavanje…</p>
  if (!account.data) return <p className="container py-8 text-red-600">Greška.</p>

  const a = account.data
  const cur = currencyLabel(a.currency!)

  const errMsg = update.error
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((update.error as any)?.response?.data?.message as string | undefined) ?? 'Greška pri ažuriranju limita.'
    : null

  return (
    <main className="container space-y-6 py-8">
      <div>
        <Link to="/portal/accounts" className="text-sm text-gray-500 hover:underline">
          ← Računi
        </Link>
      </div>

      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{a.name || formatAccountNumber(a.number)}</h1>
            <div className="font-mono text-sm text-gray-500">{formatAccountNumber(a.number)}</div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={a.status === v1AccountStatus.ACCOUNT_STATUS_ACTIVE ? 'green' : 'red'}>
              {accountStatusLabel[a.status!]}
            </Badge>
            {canWrite && (
              <Button variant="secondary" onClick={() => flipStatus.mutate()} disabled={flipStatus.isPending}>
                {a.status === v1AccountStatus.ACCOUNT_STATUS_ACTIVE ? 'Deaktiviraj' : 'Aktiviraj'}
              </Button>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <Field label="Vrsta">{accountKindLabel[a.kind!]}</Field>
          <Field label="Podtip">{accountSubtypeLabel[a.subtype!]}</Field>
          <Field label="Valuta">{cur}</Field>
          <Field label="Mesečno održavanje">{formatMoney(a.maintenanceFee, cur)}</Field>
          <Field label="Stanje">{formatMoney(a.balance, cur)}</Field>
          <Field label="Raspoloživo">{formatMoney(a.availableBalance, cur)}</Field>
          <Field label="Dnevno potrošeno">{formatMoney(a.dailySpent, cur)}</Field>
          <Field label="Mesečno potrošeno">{formatMoney(a.monthlySpent, cur)}</Field>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Limiti</h2>
        <p className="mb-4 text-sm text-gray-500">
          Spec p.12: dnevni i mesečni limit transakcija. Ostala polja računa su nepromenljiva.
        </p>
        <form onSubmit={form.handleSubmit((v) => update.mutate(v))} className="grid grid-cols-2 gap-3">
          <div>
            <Label>Dnevni limit ({cur})</Label>
            <Input inputMode="decimal" {...form.register('dailyLimit')} disabled={!canWrite} />
            {form.formState.errors.dailyLimit && (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.dailyLimit.message}</p>
            )}
          </div>
          <div>
            <Label>Mesečni limit ({cur})</Label>
            <Input inputMode="decimal" {...form.register('monthlyLimit')} disabled={!canWrite} />
            {form.formState.errors.monthlyLimit && (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.monthlyLimit.message}</p>
            )}
          </div>
          {errMsg && (
            <div className="col-span-2">
              <ErrorBanner>{errMsg}</ErrorBanner>
            </div>
          )}
          {canWrite && (
            <div className="col-span-2 flex justify-end">
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? 'Čuvam…' : 'Sačuvaj limite'}
              </Button>
            </div>
          )}
        </form>
      </Card>
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="font-medium">{children}</div>
    </div>
  )
}
