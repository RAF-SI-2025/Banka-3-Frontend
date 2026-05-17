import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/api/clients'
import { apiError } from '@/lib/api/error'
import { keys } from '@/lib/query-keys'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error'
import { bankaUserV1Gender } from '@/lib/api/generated/models/bankaUserV1Gender'

export const Route = createFileRoute('/_authed/portal/clients/new')({
  component: NewClient,
})

const schema = z.object({
  email: z.string().email('Neispravan email'),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  gender: z.nativeEnum(bankaUserV1Gender),
  phone: z.string().min(6),
  address: z.string().min(1),
})

type FormValues = z.infer<typeof schema>

function NewClient() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      gender: bankaUserV1Gender.GENDER_MALE,
      phone: '',
      address: '',
    },
  })

  const create = useMutation({
    mutationFn: createClient,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.client.all })
      navigate({ to: '/portal/clients' })
    },
  })

  const errMsg = create.error ? apiError(create.error, 'Greška pri kreiranju klijenta.') : null

  return (
    <main className="container max-w-2xl space-y-4 py-8">
      <h1 className="text-2xl font-semibold">Novi klijent</h1>
      <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="space-y-4 rounded-lg border border-border bg-surface p-6">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Ime</Label>
            <Input {...form.register('firstName')} />
          </div>
          <div>
            <Label>Prezime</Label>
            <Input {...form.register('lastName')} />
          </div>
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" {...form.register('email')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Datum rođenja</Label>
            <Input type="date" {...form.register('dateOfBirth')} />
          </div>
          <div>
            <Label>Pol</Label>
            <Select {...form.register('gender')}>
              <option value={bankaUserV1Gender.GENDER_MALE}>Muški</option>
              <option value={bankaUserV1Gender.GENDER_FEMALE}>Ženski</option>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Telefon</Label>
            <Input {...form.register('phone')} />
          </div>
          <div>
            <Label>Adresa</Label>
            <Input {...form.register('address')} />
          </div>
        </div>
        {errMsg && <ErrorBanner>{errMsg}</ErrorBanner>}
        <div className="flex justify-end">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Kreiram…' : 'Kreiraj klijenta'}
          </Button>
        </div>
      </form>
    </main>
  )
}
