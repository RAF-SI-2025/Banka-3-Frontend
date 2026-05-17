import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  getCompany,
  updateCompany,
  listAuthorizedPersons,
  createAuthorizedPerson,
} from '@/lib/api/companies'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error'
import { Card } from '@/components/ui/card'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Dialog } from '@/components/ui/dialog'
import { bankaBankV1Gender } from '@/lib/api/generated/models/bankaBankV1Gender'

export const Route = createFileRoute('/_authed/portal/companies/$id')({
  component: CompanyDetail,
})

const updateSchema = z.object({
  name: z.string().min(1),
  activityCode: z
    .string()
    .regex(/^\d{2}\.\d{1,2}$/, 'Format: NN.N ili NN.NN (npr. 62.01)'),
  address: z.string().min(1),
})
type UpdateValues = z.infer<typeof updateSchema>

const apSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.nativeEnum(bankaBankV1Gender),
  email: z.string().email(),
  phone: z.string().min(6),
  address: z.string().min(1),
})
type APValues = z.infer<typeof apSchema>

function CompanyDetail() {
  const { id } = Route.useParams()
  const qc = useQueryClient()
  const perms = useAuthStore((s) => s.permissions)
  const canWrite = has(perms, Permissions.CompanyWrite)
  const [apOpen, setApOpen] = useState(false)

  const company = useQuery({ queryKey: keys.company.detail(id), queryFn: () => getCompany(id) })
  const persons = useQuery({
    queryKey: keys.authorizedPerson.list(id),
    queryFn: () => listAuthorizedPersons(id),
  })

  const form = useForm<UpdateValues>({
    resolver: zodResolver(updateSchema),
    defaultValues: { name: '', activityCode: '', address: '' },
  })
  useEffect(() => {
    if (company.data) {
      form.reset({
        name: company.data.name ?? '',
        activityCode: company.data.activityCode ?? '',
        address: company.data.address ?? '',
      })
    }
  }, [company.data, form])

  const update = useMutation({
    mutationFn: (body: UpdateValues) => updateCompany(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.company.detail(id) }),
  })

  const apForm = useForm<APValues>({
    resolver: zodResolver(apSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      gender: bankaBankV1Gender.GENDER_MALE,
      email: '',
      phone: '',
      address: '',
    },
  })
  const addAP = useMutation({
    mutationFn: (v: APValues) => createAuthorizedPerson({ ...v, companyId: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.authorizedPerson.all })
      setApOpen(false)
      apForm.reset()
    },
  })

  if (company.isLoading) return <PageSkeleton />
  if (!company.data) return <p className="container py-8 text-danger">Greška.</p>

  return (
    <main className="container space-y-6 py-8">
      <Link to="/portal/companies" className="text-sm text-muted-foreground hover:underline">
        ← Firme
      </Link>

      <Card className="p-6">
        <h1 className="text-2xl font-semibold">{company.data.name}</h1>
        <p className="text-sm text-muted-foreground">
          MB {company.data.registryId} · PIB {company.data.taxId}
        </p>
        <form onSubmit={form.handleSubmit((v) => update.mutate(v))} className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <Label>Naziv</Label>
            <Input {...form.register('name')} disabled={!canWrite} />
          </div>
          <div>
            <Label>Šifra delatnosti</Label>
            <Input {...form.register('activityCode')} disabled={!canWrite} placeholder="62.01" />
            {form.formState.errors.activityCode?.message && (
              <p className="mt-1 text-xs text-danger">{form.formState.errors.activityCode.message}</p>
            )}
          </div>
          <div className="col-span-2">
            <Label>Adresa</Label>
            <Input {...form.register('address')} disabled={!canWrite} />
          </div>
          {canWrite && (
            <div className="col-span-2 flex justify-end">
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? 'Čuvam…' : 'Sačuvaj'}
              </Button>
            </div>
          )}
        </form>
      </Card>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ovlašćena lica</h2>
          {canWrite && <Button onClick={() => setApOpen(true)}>Dodaj lice</Button>}
        </div>
        {persons.data && (
          <Table>
            <THead>
              <TR>
                <TH>Ime i prezime</TH>
                <TH>Email</TH>
                <TH>Telefon</TH>
                <TH>Datum rođenja</TH>
              </TR>
            </THead>
            <TBody>
              {persons.data.authorizedPersons?.map((p: import('@/lib/api/companies').AuthorizedPerson) => (
                <TR key={p.id}>
                  <TD>{p.firstName} {p.lastName}</TD>
                  <TD>{p.email}</TD>
                  <TD>{p.phone}</TD>
                  <TD>{p.dateOfBirth}</TD>
                </TR>
              ))}
              {(!persons.data.authorizedPersons || persons.data.authorizedPersons.length === 0) && (
                <EmptyRow colSpan={4}>Nema ovlašćenih lica.</EmptyRow>
              )}
            </TBody>
          </Table>
        )}
      </section>

      <Dialog
        open={apOpen}
        onClose={() => setApOpen(false)}
        title="Novo ovlašćeno lice"
        footer={
          <>
            <Button variant="secondary" onClick={() => setApOpen(false)}>
              Otkaži
            </Button>
            <Button onClick={apForm.handleSubmit((v) => addAP.mutate(v))} disabled={addAP.isPending}>
              Sačuvaj
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Ime</Label>
            <Input {...apForm.register('firstName')} />
          </div>
          <div>
            <Label>Prezime</Label>
            <Input {...apForm.register('lastName')} />
          </div>
          <div>
            <Label>Datum rođenja</Label>
            <Input type="date" {...apForm.register('dateOfBirth')} />
          </div>
          <div>
            <Label>Pol</Label>
            <Select {...apForm.register('gender')}>
              <option value={bankaBankV1Gender.GENDER_MALE}>Muški</option>
              <option value={bankaBankV1Gender.GENDER_FEMALE}>Ženski</option>
            </Select>
          </div>
          <div>
            <Label>Email</Label>
            <Input {...apForm.register('email')} />
          </div>
          <div>
            <Label>Telefon</Label>
            <Input {...apForm.register('phone')} />
          </div>
          <div className="col-span-2">
            <Label>Adresa</Label>
            <Input {...apForm.register('address')} />
          </div>
          {addAP.isError && (
            <div className="col-span-2">
              <ErrorBanner>Greška pri dodavanju.</ErrorBanner>
            </div>
          )}
        </div>
      </Dialog>
    </main>
  )
}

function PageSkeleton() {
  return (
    <main className="container space-y-6 py-8">
      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
        <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="h-48 animate-pulse rounded-lg bg-muted" />
    </main>
  )
}
