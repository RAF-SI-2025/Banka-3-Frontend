// Shared "Nova kartica" form, used by /banking/kartice (client requesting
// a card on their own account) and /portal/cards (employee on any
// account — and AuthorizedPerson selection for business accounts).
//
// Spec p.28 mandates an email-confirmation step before issuance. We
// reuse the verifikacioni-kod primitive (5-min code, 3 attempts) for
// this — same UX as payments, different action kind. After the form
// is submitted the verification dialog is opened on top; only after
// the code is consumed does the card actually get created.

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCard } from '@/lib/api/cards'
import { apiError } from '@/lib/api/error'
import type { VerificationProof } from '@/lib/api/verification'
import { listAuthorizedPersons } from '@/lib/api/companies'
import { keys } from '@/lib/query-keys'
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
  cardLimit: z.string().regex(/^[0-9]+(\.[0-9]{1,2})?$/, 'Limit mora biti broj'),
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
      onClose()
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
                name: v.name,
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
          <Select {...form.register('accountId')} disabled={!!preselectAccountId}>
            <option value="">— izaberite —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name || a.number}
              </option>
            ))}
          </Select>
          {form.formState.errors.accountId && (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.accountId.message}</p>
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
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.cardLimit.message}</p>
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
        description="Spec p.28: izdavanje kartice zahteva potvrdu kodom."
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
