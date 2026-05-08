import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { listAccounts } from '@/lib/api/accounts'
import { submitLoanRequest } from '@/lib/api/loans'
import { useAuthStore } from '@/lib/auth/store'
import { keys } from '@/lib/query-keys'
import { formatAccountNumber, currencyLabel } from '@/lib/format'
import { loanTypeLabel, interestTypeLabel, employmentStatusLabel } from '@/lib/labels'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error'
import { v1LoanType } from '@/lib/api/generated/models/v1LoanType'
import { v1InterestType } from '@/lib/api/generated/models/v1InterestType'
import { v1EmploymentStatus } from '@/lib/api/generated/models/v1EmploymentStatus'
import { bankaBankV1Currency } from '@/lib/api/generated/models/bankaBankV1Currency'

export const Route = createFileRoute('/_authed/banking/krediti/novi')({
  component: NewLoanRequest,
})

const schema = z.object({
  accountId: z.string().min(1, 'Izaberite račun'),
  loanType: z.nativeEnum(v1LoanType),
  interestType: z.nativeEnum(v1InterestType),
  amount: z.string().regex(/^[0-9]+(\.[0-9]{1,2})?$/, 'Iznos mora biti broj'),
  installmentsTotal: z.coerce.number().int().positive('Broj rata mora biti pozitivan'),
  monthlySalary: z.string().regex(/^[0-9]+(\.[0-9]{1,2})?$/, 'Plata mora biti broj'),
  employmentStatus: z.nativeEnum(v1EmploymentStatus),
  employmentDurationMonths: z.coerce.number().int().nonnegative(),
  contactPhone: z.string().min(6, 'Telefon je obavezan'),
  purpose: z.string().min(1, 'Svrha je obavezna'),
})

type FormValues = z.infer<typeof schema>

const installmentChoices: Record<v1LoanType, number[]> = {
  [v1LoanType.LOAN_TYPE_UNSPECIFIED]: [],
  [v1LoanType.LOAN_TYPE_CASH]: [12, 24, 36, 48, 60, 72, 84],
  [v1LoanType.LOAN_TYPE_AUTO]: [12, 24, 36, 48, 60, 72, 84],
  [v1LoanType.LOAN_TYPE_REFINANCE]: [12, 24, 36, 48, 60, 72, 84],
  [v1LoanType.LOAN_TYPE_STUDENT]: [12, 24, 36, 48, 60, 72, 84],
  [v1LoanType.LOAN_TYPE_HOUSING]: [60, 120, 180, 240, 300, 360],
}

function NewLoanRequest() {
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
    defaultValues: {
      accountId: '',
      loanType: v1LoanType.LOAN_TYPE_CASH,
      interestType: v1InterestType.INTEREST_TYPE_FIXED,
      amount: '',
      installmentsTotal: 60,
      monthlySalary: '',
      employmentStatus: v1EmploymentStatus.EMPLOYMENT_STATUS_PERMANENT,
      employmentDurationMonths: 0,
      contactPhone: '',
      purpose: '',
    },
  })

  const submit = useMutation({
    mutationFn: submitLoanRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.loanRequest.all })
      navigate({ to: '/banking/krediti' })
    },
  })

  const loanType = form.watch('loanType')
  const accountId = form.watch('accountId')
  const account = accounts.data?.accounts?.find((a) => a.id === accountId)

  const errMsg = submit.error
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((submit.error as any)?.response?.data?.message as string | undefined) ??
      'Greška pri slanju zahteva.'
    : null

  function onSubmit(v: FormValues) {
    submit.mutate({
      accountId: v.accountId,
      loanType: v.loanType,
      interestType: v.interestType,
      amount: v.amount,
      currency: account?.currency ?? bankaBankV1Currency.CURRENCY_RSD,
      purpose: v.purpose,
      monthlySalary: v.monthlySalary,
      employmentStatus: v.employmentStatus,
      employmentDurationMonths: v.employmentDurationMonths,
      installmentsTotal: v.installmentsTotal,
      contactPhone: v.contactPhone,
    })
  }

  return (
    <main className="container max-w-2xl space-y-4 py-8">
      <h1 className="text-2xl font-semibold">Novi zahtev za kredit</h1>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <div>
          <Label>Račun za uplatu kredita</Label>
          <Select {...form.register('accountId')}>
            <option value="">— izaberite —</option>
            {accounts.data?.accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {formatAccountNumber(a.number)} · {currencyLabel(a.currency!)}
              </option>
            ))}
          </Select>
          {form.formState.errors.accountId && (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.accountId.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tip kredita</Label>
            <Select {...form.register('loanType')}>
              {Object.values(v1LoanType)
                .filter((t) => t !== v1LoanType.LOAN_TYPE_UNSPECIFIED)
                .map((t) => (
                  <option key={t} value={t}>
                    {loanTypeLabel[t]}
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <Label>Vrsta kamate</Label>
            <Select {...form.register('interestType')}>
              <option value={v1InterestType.INTEREST_TYPE_FIXED}>{interestTypeLabel[v1InterestType.INTEREST_TYPE_FIXED]}</option>
              <option value={v1InterestType.INTEREST_TYPE_VARIABLE}>{interestTypeLabel[v1InterestType.INTEREST_TYPE_VARIABLE]}</option>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Iznos</Label>
            <Input inputMode="decimal" {...form.register('amount')} />
          </div>
          <div>
            <Label>Broj rata (mesečno)</Label>
            <Select {...form.register('installmentsTotal', { valueAsNumber: true })}>
              {installmentChoices[loanType]?.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Mesečna plata</Label>
            <Input inputMode="decimal" {...form.register('monthlySalary')} />
          </div>
          <div>
            <Label>Status zaposlenja</Label>
            <Select {...form.register('employmentStatus')}>
              {Object.values(v1EmploymentStatus)
                .filter((s) => s !== v1EmploymentStatus.EMPLOYMENT_STATUS_UNSPECIFIED)
                .map((s) => (
                  <option key={s} value={s}>
                    {employmentStatusLabel[s]}
                  </option>
                ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Staž (meseci)</Label>
            <Input type="number" {...form.register('employmentDurationMonths', { valueAsNumber: true })} />
          </div>
          <div>
            <Label>Kontakt telefon</Label>
            <Input {...form.register('contactPhone')} />
          </div>
        </div>

        <div>
          <Label>Svrha kredita</Label>
          <Input {...form.register('purpose')} />
          {form.formState.errors.purpose && (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.purpose.message}</p>
          )}
        </div>

        {errMsg && <ErrorBanner>{errMsg}</ErrorBanner>}

        <div className="flex justify-end">
          <Button type="submit" disabled={submit.isPending}>
            {submit.isPending ? 'Šaljem…' : 'Pošalji zahtev'}
          </Button>
        </div>
      </form>
    </main>
  )
}
