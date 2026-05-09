import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getClient, updateClient } from '@/lib/api/clients'
import { apiError } from '@/lib/api/error'
import { listAccounts } from '@/lib/api/accounts'
import { listLoans } from '@/lib/api/loans'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { formatMoney, formatAccountNumber, currencyLabel, formatDate } from '@/lib/format'
import { accountKindLabel, accountStatusLabel, loanTypeLabel, loanStatusLabel } from '@/lib/labels'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { bankaUserV1Gender } from '@/lib/api/generated/models/bankaUserV1Gender'

export const Route = createFileRoute('/_authed/portal/clients/$id')({
  component: ClientDetail,
})

const schema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  gender: z.nativeEnum(bankaUserV1Gender),
  phone: z.string().min(6),
  address: z.string().min(1),
})
type FormValues = z.infer<typeof schema>

function ClientDetail() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const perms = useAuthStore((s) => s.permissions)
  const canWrite = has(perms, Permissions.ClientWrite)

  const client = useQuery({
    queryKey: keys.client.detail(id),
    queryFn: () => getClient(id),
  })
  const accounts = useQuery({
    queryKey: keys.account.list({ ownerClientId: id }),
    queryFn: () => listAccounts({ ownerClientId: id }),
  })
  const loans = useQuery({
    queryKey: keys.loan.list({ clientId: id }),
    queryFn: () => listLoans({ clientId: id }),
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      gender: bankaUserV1Gender.GENDER_MALE,
      phone: '',
      address: '',
    },
  })

  useEffect(() => {
    if (client.data) {
      form.reset({
        email: client.data.email ?? '',
        firstName: client.data.firstName ?? '',
        lastName: client.data.lastName ?? '',
        gender: client.data.gender ?? bankaUserV1Gender.GENDER_MALE,
        phone: client.data.phone ?? '',
        address: client.data.address ?? '',
      })
    }
  }, [client.data, form])

  const update = useMutation({
    mutationFn: (body: FormValues) => updateClient(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.client.detail(id) }),
  })

  const errMsg = update.error ? apiError(update.error, 'Greška pri ažuriranju.') : null

  if (client.isLoading) return <p className="container py-8 text-muted-foreground">Učitavanje…</p>
  if (!client.data) return <p className="container py-8 text-danger">Greška.</p>

  return (
    <main className="container space-y-6 py-8">
      <div>
        <Link to="/portal/clients" className="text-sm text-muted-foreground hover:underline">
          ← Klijenti
        </Link>
      </div>

      <Card className="p-6">
        <h1 className="text-2xl font-semibold">
          {client.data.firstName} {client.data.lastName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {client.data.email} · DOB {client.data.dateOfBirth}
        </p>

        <form
          onSubmit={form.handleSubmit((v) => update.mutate(v))}
          className="mt-4 grid grid-cols-2 gap-3"
        >
          <div>
            <Label>Email</Label>
            <Input {...form.register('email')} disabled={!canWrite} />
          </div>
          <div>
            <Label>Pol</Label>
            <Select {...form.register('gender')} disabled={!canWrite}>
              <option value={bankaUserV1Gender.GENDER_MALE}>Muški</option>
              <option value={bankaUserV1Gender.GENDER_FEMALE}>Ženski</option>
              {/* Legacy data may carry GENDER_OTHER (the option was
                  removed from the dropdown); surface it so the form
                  doesn't silently reset on save. */}
              {client.data?.gender === bankaUserV1Gender.GENDER_OTHER && (
                <option value={bankaUserV1Gender.GENDER_OTHER}>Drugo</option>
              )}
            </Select>
          </div>
          <div>
            <Label>Ime</Label>
            <Input {...form.register('firstName')} disabled={!canWrite} />
          </div>
          <div>
            <Label>Prezime</Label>
            <Input {...form.register('lastName')} disabled={!canWrite} />
          </div>
          <div>
            <Label>Telefon</Label>
            <Input {...form.register('phone')} disabled={!canWrite} />
          </div>
          <div>
            <Label>Adresa</Label>
            <Input {...form.register('address')} disabled={!canWrite} />
          </div>
          {errMsg && (
            <div className="col-span-2">
              <ErrorBanner>{errMsg}</ErrorBanner>
            </div>
          )}
          {canWrite && (
            <div className="col-span-2 flex justify-end">
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? 'Čuvam…' : 'Sačuvaj izmene'}
              </Button>
            </div>
          )}
        </form>
      </Card>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Računi</h2>
          {has(perms, Permissions.AccountWrite) && (
            <Link to="/portal/accounts/new" search={{ ownerClientId: id }}>
              <Button>Otvori novi račun</Button>
            </Link>
          )}
        </div>
        {accounts.data && (
          <Table>
            <THead>
              <TR>
                <TH>Broj</TH>
                <TH>Vrsta</TH>
                <TH>Valuta</TH>
                <TH className="text-right">Stanje</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {accounts.data.accounts?.map((a) => (
                <TR
                  key={a.id}
                  onClick={() => navigate({ to: '/portal/accounts/$id', params: { id: a.id! } })}
                >
                  <TD className="font-mono text-xs">{formatAccountNumber(a.number)}</TD>
                  <TD>{accountKindLabel[a.kind!]}</TD>
                  <TD>{currencyLabel(a.currency!)}</TD>
                  <TD className="text-right">{formatMoney(a.balance, currencyLabel(a.currency!))}</TD>
                  <TD>
                    <Badge tone={a.status === 'ACCOUNT_STATUS_ACTIVE' ? 'green' : 'red'}>
                      {accountStatusLabel[a.status!]}
                    </Badge>
                  </TD>
                </TR>
              ))}
              {(!accounts.data.accounts || accounts.data.accounts.length === 0) && (
                <EmptyRow colSpan={5}>Nema računa.</EmptyRow>
              )}
            </TBody>
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Krediti</h2>
        {loans.data && (
          <Table>
            <THead>
              <TR>
                <TH>Broj</TH>
                <TH>Tip</TH>
                <TH className="text-right">Glavnica</TH>
                <TH className="text-right">Rata</TH>
                <TH>Sledeća rata</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {loans.data.loans?.map((l) => (
                <TR
                  key={l.id}
                  onClick={() => navigate({ to: '/portal/loans/$id', params: { id: l.id! } })}
                >
                  <TD className="font-mono text-xs">{l.loanNumber}</TD>
                  <TD>{loanTypeLabel[l.loanType!]}</TD>
                  <TD className="text-right">{formatMoney(l.principal, currencyLabel(l.currency!))}</TD>
                  <TD className="text-right">{formatMoney(l.installmentAmount, currencyLabel(l.currency!))}</TD>
                  <TD>{formatDate(l.nextInstallmentDate)}</TD>
                  <TD>
                    <Badge tone={l.status === 'LOAN_STATUS_APPROVED' ? 'green' : 'red'}>
                      {loanStatusLabel[l.status!]}
                    </Badge>
                  </TD>
                </TR>
              ))}
              {(!loans.data.loans || loans.data.loans.length === 0) && <EmptyRow colSpan={6}>Nema kredita.</EmptyRow>}
            </TBody>
          </Table>
        )}
      </section>
    </main>
  )
}
