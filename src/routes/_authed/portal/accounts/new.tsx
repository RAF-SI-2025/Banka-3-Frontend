import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createAccount } from '@/lib/api/accounts'
import { listClients } from '@/lib/api/clients'
import { listCompanies } from '@/lib/api/companies'
import { keys } from '@/lib/query-keys'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error'
import {
  accountKindLabel,
  accountSubtypeLabel,
} from '@/lib/labels'
import { currencyLabel } from '@/lib/format'
import { v1AccountKind } from '@/lib/api/generated/models/v1AccountKind'
import { v1AccountSubtype } from '@/lib/api/generated/models/v1AccountSubtype'
import { bankaBankV1Currency } from '@/lib/api/generated/models/bankaBankV1Currency'

export const Route = createFileRoute('/_authed/portal/accounts/new')({
  validateSearch: (s: Record<string, unknown>) => ({
    ownerClientId: typeof s.ownerClientId === 'string' ? s.ownerClientId : undefined,
  }),
  component: NewAccount,
})

const schema = z.object({
  ownerClientId: z.string().min(1, 'Izaberite klijenta'),
  companyId: z.string().optional(),
  kind: z.nativeEnum(v1AccountKind),
  subtype: z.nativeEnum(v1AccountSubtype),
  currency: z.nativeEnum(bankaBankV1Currency),
  name: z.string().optional(),
  openingBalance: z.string().regex(/^[0-9]+(\.[0-9]{1,2})?$/, 'Iznos mora biti broj'),
  createCard: z.boolean().optional(),
})
type FormValues = z.infer<typeof schema>

function NewAccount() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const search = Route.useSearch()

  const clients = useQuery({
    queryKey: keys.client.list({ pageSize: 200 }),
    queryFn: () => listClients({ pageSize: 200 }),
  })
  const companies = useQuery({
    queryKey: keys.company.list({ pageSize: 200 }),
    queryFn: () => listCompanies({ pageSize: 200 }),
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ownerClientId: search.ownerClientId ?? '',
      companyId: '',
      kind: v1AccountKind.ACCOUNT_KIND_PERSONAL_CHECKING_RSD,
      subtype: v1AccountSubtype.ACCOUNT_SUBTYPE_STANDARD,
      currency: bankaBankV1Currency.CURRENCY_RSD,
      name: '',
      openingBalance: '0',
      createCard: false,
    },
  })

  const create = useMutation({
    mutationFn: createAccount,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.account.all })
      navigate({ to: '/portal/accounts' })
    },
  })

  const errMsg = create.error
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((create.error as any)?.response?.data?.message as string | undefined) ?? 'Greška pri kreiranju računa.'
    : null

  const kind = form.watch('kind')
  const isBusiness = kind === v1AccountKind.ACCOUNT_KIND_BUSINESS_CHECKING_RSD || kind === v1AccountKind.ACCOUNT_KIND_BUSINESS_FX
  const isFx = kind === v1AccountKind.ACCOUNT_KIND_PERSONAL_FX || kind === v1AccountKind.ACCOUNT_KIND_BUSINESS_FX

  return (
    <main className="container max-w-2xl space-y-4 py-8">
      <h1 className="text-2xl font-semibold">Otvaranje računa</h1>
      <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <div>
          <Label>Vlasnik (klijent)</Label>
          <Select {...form.register('ownerClientId')}>
            <option value="">— izaberite —</option>
            {clients.data?.clients?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName} · {c.email}
              </option>
            ))}
          </Select>
          {form.formState.errors.ownerClientId && (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.ownerClientId.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Vrsta računa</Label>
            <Select {...form.register('kind')}>
              {Object.values(v1AccountKind)
                .filter((k) => k !== v1AccountKind.ACCOUNT_KIND_UNSPECIFIED && k !== v1AccountKind.ACCOUNT_KIND_SYSTEM)
                .map((k) => (
                  <option key={k} value={k}>
                    {accountKindLabel[k]}
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <Label>Podtip</Label>
            <Select {...form.register('subtype')}>
              {Object.values(v1AccountSubtype)
                .filter((s) => s !== v1AccountSubtype.ACCOUNT_SUBTYPE_UNSPECIFIED)
                .map((s) => (
                  <option key={s} value={s}>
                    {accountSubtypeLabel[s]}
                  </option>
                ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Valuta</Label>
            <Select {...form.register('currency')} disabled={!isFx && kind !== v1AccountKind.ACCOUNT_KIND_PERSONAL_CHECKING_RSD && kind !== v1AccountKind.ACCOUNT_KIND_BUSINESS_CHECKING_RSD}>
              {Object.values(bankaBankV1Currency)
                .filter((c) => c !== bankaBankV1Currency.CURRENCY_UNSPECIFIED)
                .map((c) => (
                  <option key={c} value={c}>
                    {currencyLabel(c)}
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <Label>Početno stanje</Label>
            <Input inputMode="decimal" {...form.register('openingBalance')} />
          </div>
        </div>

        {isBusiness && (
          <div>
            <Label>Firma</Label>
            <Select {...form.register('companyId')}>
              <option value="">— izaberite —</option>
              {companies.data?.companies?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · MB {c.registryId}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <Label>Naziv (opciono)</Label>
          <Input {...form.register('name')} />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" {...form.register('createCard')} />
          Kreiraj i karticu
        </label>

        {errMsg && <ErrorBanner>{errMsg}</ErrorBanner>}
        <div className="flex justify-end">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Kreiram…' : 'Otvori račun'}
          </Button>
        </div>
      </form>
    </main>
  )
}
