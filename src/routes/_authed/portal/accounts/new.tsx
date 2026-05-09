import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { createAccount, type Account } from '@/lib/api/accounts'
import { apiError } from '@/lib/api/error'
import { listClients } from '@/lib/api/clients'
import { listCompanies } from '@/lib/api/companies'
import { keys } from '@/lib/query-keys'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error'
import { CardCreateDialog } from '@/components/cards/card-create-dialog'
import {
  accountKindLabel,
  accountSubtypeLabel,
  subtypesForKind,
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

function isCheckingKind(k: v1AccountKind) {
  return (
    k === v1AccountKind.ACCOUNT_KIND_PERSONAL_CHECKING_RSD ||
    k === v1AccountKind.ACCOUNT_KIND_BUSINESS_CHECKING_RSD
  )
}

function isFxKind(k: v1AccountKind) {
  return (
    k === v1AccountKind.ACCOUNT_KIND_PERSONAL_FX ||
    k === v1AccountKind.ACCOUNT_KIND_BUSINESS_FX
  )
}

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

  const [clientSearch, setClientSearch] = useState('')
  const [createdAccount, setCreatedAccount] = useState<Account | null>(null)

  const create = useMutation({
    mutationFn: createAccount,
    onSuccess: (account) => {
      qc.invalidateQueries({ queryKey: keys.account.all })
      if (form.getValues('createCard')) {
        setCreatedAccount(account)
      } else {
        navigate({ to: '/portal/accounts' })
      }
    },
  })

  const errMsg = create.error ? apiError(create.error, 'Greška pri kreiranju računa.') : null

  const kind = form.watch('kind')
  const isBusiness = kind === v1AccountKind.ACCOUNT_KIND_BUSINESS_CHECKING_RSD || kind === v1AccountKind.ACCOUNT_KIND_BUSINESS_FX
  const isFx = isFxKind(kind)
  const isChecking = isCheckingKind(kind)
  const allowedSubtypes = subtypesForKind(kind)
  const showSubtype = allowedSubtypes.length > 0

  const ownerClientId = form.watch('ownerClientId')
  const allClients = useMemo(() => clients.data?.clients ?? [], [clients.data])
  const selectedClient = allClients.find((c) => c.id === ownerClientId)
  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase()
    if (!q) return allClients
    return allClients.filter((c) => {
      const hay = `${c.firstName ?? ''} ${c.lastName ?? ''} ${c.email ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [allClients, clientSearch])

  // Keep subtype in sync with kind: when the user flips kind, the
  // current subtype is almost certainly invalid for the new bucket
  // (e.g. STANDARD doesn't apply to a business account). Snap to the
  // first allowed value, or UNSPECIFIED for FX/system kinds where the
  // backend ignores it anyway.
  const subtype = form.watch('subtype')
  useEffect(() => {
    if (allowedSubtypes.length === 0) {
      if (subtype !== v1AccountSubtype.ACCOUNT_SUBTYPE_UNSPECIFIED) {
        form.setValue('subtype', v1AccountSubtype.ACCOUNT_SUBTYPE_UNSPECIFIED)
      }
      return
    }
    if (!allowedSubtypes.includes(subtype)) {
      form.setValue('subtype', allowedSubtypes[0])
    }
  }, [kind, allowedSubtypes, subtype, form])

  // Keep currency in sync with kind. Checking accounts are RSD-only
  // (the menu is hidden in that case); FX accounts must not be RSD.
  const currency = form.watch('currency')
  useEffect(() => {
    if (isChecking && currency !== bankaBankV1Currency.CURRENCY_RSD) {
      form.setValue('currency', bankaBankV1Currency.CURRENCY_RSD)
    } else if (isFx && currency === bankaBankV1Currency.CURRENCY_RSD) {
      form.setValue('currency', bankaBankV1Currency.CURRENCY_EUR)
    }
  }, [isChecking, isFx, currency, form])

  return (
    <main className="container max-w-2xl space-y-4 py-8">
      <h1 className="text-2xl font-semibold">Otvaranje računa</h1>
      <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <div>
          <Label>Vlasnik (klijent)</Label>
          <Input
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            placeholder="Pretraga po imenu ili email-u…"
            autoComplete="off"
          />
          {selectedClient && (
            <p className="mt-1 text-xs text-gray-600">
              Izabrano: {selectedClient.firstName} {selectedClient.lastName} · {selectedClient.email}
            </p>
          )}
          <div className="mt-2 max-h-40 overflow-auto rounded-md border border-gray-200">
            {filteredClients.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-500">Nema rezultata.</p>
            )}
            {filteredClients.map((c) => {
              const selected = c.id === ownerClientId
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() =>
                    form.setValue('ownerClientId', c.id!, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                    selected ? 'bg-blue-50' : ''
                  }`}
                >
                  <span>
                    {c.firstName} {c.lastName}
                  </span>
                  <span className="text-xs text-gray-600">{c.email}</span>
                </button>
              )
            })}
          </div>
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
          {showSubtype && (
            <div>
              <Label>Podtip</Label>
              <Select {...form.register('subtype')}>
                {allowedSubtypes.map((s) => (
                  <option key={s} value={s}>
                    {accountSubtypeLabel[s]}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {isFx && (
            <div>
              <Label>Valuta</Label>
              <Select {...form.register('currency')}>
                {Object.values(bankaBankV1Currency)
                  .filter(
                    (c) =>
                      c !== bankaBankV1Currency.CURRENCY_UNSPECIFIED &&
                      c !== bankaBankV1Currency.CURRENCY_RSD,
                  )
                  .map((c) => (
                    <option key={c} value={c}>
                      {currencyLabel(c)}
                    </option>
                  ))}
              </Select>
            </div>
          )}
          <div className={isFx ? '' : 'col-span-2'}>
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
      {createdAccount && (
        <CardCreateDialog
          open={true}
          onClose={() => {
            setCreatedAccount(null)
            navigate({ to: '/portal/accounts' })
          }}
          accounts={[createdAccount]}
          preselectAccountId={createdAccount.id}
        />
      )}
    </main>
  )
}
