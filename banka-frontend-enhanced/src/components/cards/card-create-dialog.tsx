// Shared "Nova kartica" form, used by /banking/kartice (client requesting
// a card on their own account) and /portal/cards (employee on any
// account — and AuthorizedPerson selection for business accounts).
// Issuance is gated by the verifikacioni-kod primitive; the code is
// shown inline next to the fake-QR placeholder until the c5 mobile app.

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCard } from '@/lib/api/cards'
import { apiError } from '@/lib/api/error'
import { toast } from '@/components/ui/toast'
import type { VerificationProof } from '@/lib/api/verification'
import { listAuthorizedPersons } from '@/lib/api/companies'
import { keys } from '@/lib/query-keys'
import { formatAccountNumber, currencyLabel } from '@/lib/format'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ErrorBanner } from '@/components/ui/error'
import { VerificationDialog } from '@/components/verification/verification-dialog'
import { v1CardBrand } from '@/lib/api/generated/models/v1CardBrand'
import { cardBrandLabel } from '@/lib/labels'
import type { Account } from '@/lib/api/accounts'
import type { v1CreateCardRequest } from '@/lib/api/generated/models/v1CreateCardRequest'

const schema = z.object({
  accountId: z.string().min(1, 'Izaberite račun'),
  brand: z.nativeEnum(v1CardBrand),
  name: z.string().optional(),
  cardLimit: z
    .string()
    .regex(/^[0-9]+(\.[0-9]{1,2})?$/, 'Limit mora biti broj')
    .refine((v) => Number(v) > 0, 'Limit mora biti veći od 0'),
  authorizedPersonId: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function CardCreateDialog({
  open,
  onClose,
  accounts,
  preselectAccountId,
}: {
  open: boolean
  onClose: () => void
  accounts: Account[]
  preselectAccountId?: string
}) {
  const qc = useQueryClient()
  const [pending, setPending] = useState<v1CreateCardRequest | null>(null)
  const [accountSearch, setAccountSearch] = useState('')
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      accountId: preselectAccountId ?? '',
      brand: v1CardBrand.CARD_BRAND_VISA,
      name: '',
      cardLimit: '0',
      authorizedPersonId: '',
    },
  })

  useEffect(() => {
    if (open) {
      setPending(null)
      setAccountSearch('')
      form.reset({
        accountId: preselectAccountId ?? '',
        brand: v1CardBrand.CARD_BRAND_VISA,
        name: '',
        cardLimit: '0',
        authorizedPersonId: '',
      })
    }
  }, [open, preselectAccountId, form])

  const accountId = form.watch('accountId')
  const account = accounts.find((a) => a.id === accountId)

  const filteredAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase()
    if (!q) return accounts
    return accounts.filter((a) => {
      const hay = [a.name ?? '', a.number ?? '', currencyLabel(a.currency!)]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [accounts, accountSearch])
  // Business accounts let the caller pick an OvlascenoLice; personal
  // accounts implicitly assign to the owner.
  const isBusiness = account?.kind === 'ACCOUNT_KIND_BUSINESS_CHECKING_RSD' || account?.kind === 'ACCOUNT_KIND_BUSINESS_FX'

  const persons = useQuery({
    queryKey: keys.authorizedPerson.list(account?.companyId ?? ''),
    queryFn: () => listAuthorizedPersons(account!.companyId!),
    enabled: !!isBusiness && !!account?.companyId,
  })

  const create = useMutation({
    mutationFn: ({ payload, proof }: { payload: v1CreateCardRequest; proof: VerificationProof }) =>
      createCard(payload, proof),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.card.all })
      toast.success('Kartica je uspešno kreirana.')
      onClose()
    },
    onError: (err) => {
      toast.error(apiError(err, 'Greška pri kreiranju kartice.'))
    },
  })

  const errMsg = create.error ? apiError(create.error, 'Greška pri kreiranju kartice.') : null

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nova kartica"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Otkaži
          </Button>
          <Button
            onClick={form.handleSubmit((v) =>
              setPending({
                accountId: v.accountId,
                brand: v.brand,
                name: v.name?.trim() ? v.name.trim() : undefined,
                cardLimit: v.cardLimit,
                authorizedPersonId: v.authorizedPersonId || undefined,
              }),
            )}
            disabled={create.isPending}
          >
            {create.isPending ? 'Kreiram…' : 'Kreiraj karticu'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <Label>Račun</Label>
          {preselectAccountId ? (
            <Input
              value={
                account
                  ? `${formatAccountNumber(account.number)} · ${currencyLabel(account.currency!)}${account.name ? ` · ${account.name}` : ''}`
                  : ''
              }
              disabled
            />
          ) : (
            <>
              <Input
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                placeholder="Pretraga po nazivu, broju ili valuti…"
                autoComplete="off"
              />
              {account && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Izabrano:{' '}
                  <span className="font-mono">{formatAccountNumber(account.number)}</span>
                  {' · '}
                  {currencyLabel(account.currency!)}
                  {account.name ? ` · ${account.name}` : ''}
                </p>
              )}
              <div className="mt-2 max-h-40 overflow-auto rounded-md border border-border">
                {filteredAccounts.length === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">Nema rezultata.</p>
                )}
                {filteredAccounts.map((a) => {
                  const selected = a.id === accountId
                  return (
                    <button
                      type="button"
                      key={a.id}
                      onClick={() => {
                        form.setValue('accountId', a.id!, {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-surface-muted ${
                        selected ? 'bg-primary-soft' : ''
                      }`}
                    >
                      <span className="font-mono text-xs">{formatAccountNumber(a.number)}</span>
                      <span className="text-xs text-muted-foreground">
                        {currencyLabel(a.currency!)}
                        {a.name ? ` · ${a.name}` : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
          {form.formState.errors.accountId && (
            <p className="mt-1 text-xs text-danger">{form.formState.errors.accountId.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Brend</Label>
            <Select {...form.register('brand')}>
              {Object.values(v1CardBrand)
                .filter((b) => b !== v1CardBrand.CARD_BRAND_UNSPECIFIED)
                .map((b) => (
                  <option key={b} value={b}>
                    {cardBrandLabel[b]}
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <Label>Limit</Label>
            <Input inputMode="decimal" {...form.register('cardLimit')} />
            {form.formState.errors.cardLimit && (
              <p className="mt-1 text-xs text-danger">{form.formState.errors.cardLimit.message}</p>
            )}
          </div>
        </div>

        <div>
          <Label>Naziv (opciono)</Label>
          <Input {...form.register('name')} placeholder="npr. Lična" />
        </div>

        {isBusiness && (
          <div>
            <Label>Ovlašćeno lice</Label>
            <Select {...form.register('authorizedPersonId')}>
              <option value="">— vlasnik firme —</option>
              {persons.data?.authorizedPersons?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}
                </option>
              ))}
            </Select>
          </div>
        )}

        {errMsg && <ErrorBanner>{errMsg}</ErrorBanner>}
      </div>
      <VerificationDialog
        open={!!pending}
        kind="card_issue"
        title="Potvrda izdavanja kartice"
        description="Unesite verifikacioni kod kako biste potvrdili izdavanje kartice."
        onCancel={() => setPending(null)}
        onConfirm={async (proof) => {
          if (!pending) return
          await create.mutateAsync({ payload: pending, proof })
          setPending(null)
        }}
      />
    </Dialog>
  )
}
