import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createCompany } from '@/lib/api/companies'
import { apiError } from '@/lib/api/error'
import { listClients } from '@/lib/api/clients'
import { keys } from '@/lib/query-keys'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error'

export const Route = createFileRoute('/_authed/portal/companies/new')({
  component: NewCompany,
})

const schema = z.object({
  name: z.string().min(1, 'Naziv je obavezan'),
  registryId: z.string().min(8, 'Matični broj ima 8 cifara').max(8),
  taxId: z.string().min(9, 'PIB ima 9 cifara').max(9),
  activityCode: z.string().min(1),
  address: z.string().min(1),
  ownerClientId: z.string().min(1, 'Izaberite vlasnika'),
})
type FormValues = z.infer<typeof schema>

function NewCompany() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const clients = useQuery({
    queryKey: keys.client.list({ pageSize: 200 }),
    queryFn: () => listClients({ pageSize: 200 }),
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', registryId: '', taxId: '', activityCode: '', address: '', ownerClientId: '' },
  })

  const create = useMutation({
    mutationFn: createCompany,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.company.all })
      navigate({ to: '/portal/companies' })
    },
  })

  const errMsg = create.error ? apiError(create.error, 'Greška pri kreiranju firme.') : null

  return (
    <main className="container max-w-2xl space-y-4 py-8">
      <h1 className="text-2xl font-semibold">Nova firma</h1>
      <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <div>
          <Label>Naziv</Label>
          <Input {...form.register('name')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Matični broj</Label>
            <Input className="font-mono" maxLength={8} {...form.register('registryId')} />
          </div>
          <div>
            <Label>PIB</Label>
            <Input className="font-mono" maxLength={9} {...form.register('taxId')} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Šifra delatnosti</Label>
            <Input {...form.register('activityCode')} />
          </div>
          <div>
            <Label>Adresa</Label>
            <Input {...form.register('address')} />
          </div>
        </div>
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
        </div>
        {errMsg && <ErrorBanner>{errMsg}</ErrorBanner>}
        <div className="flex justify-end">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Kreiram…' : 'Kreiraj firmu'}
          </Button>
        </div>
      </form>
    </main>
  )
}
