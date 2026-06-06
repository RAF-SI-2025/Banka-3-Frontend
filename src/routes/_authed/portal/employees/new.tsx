import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createEmployee, type CreateEmployeeInput } from '@/lib/api/employees'
import { apiError } from '@/lib/api/error'
import { keys } from '@/lib/query-keys'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorBanner } from '@/components/ui/error'

export const Route = createFileRoute('/_authed/portal/employees/new')({
  component: NewEmployeePage,
})

const schema = z.object({
  email: z.string().email('Unesite ispravan email'),
  username: z.string().min(1, 'Korisničko ime je obavezno'),
  firstName: z.string().min(1, 'Ime je obavezno'),
  lastName: z.string().min(1, 'Prezime je obavezno'),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD')
    .refine((d) => new Date(d) < new Date(), 'Datum rođenja ne sme biti u budućnosti'),
  gender: z.enum(['GENDER_MALE', 'GENDER_FEMALE']),
  phone: z.string().regex(/^\+?[0-9]{6,20}$/, 'Telefon: 6–20 cifara, opciono +'),
  address: z.string().min(1, 'Adresa je obavezna'),
  position: z.string().min(1, 'Pozicija je obavezna'),
  department: z.string().min(1, 'Departman je obavezan'),
  active: z.boolean(),
  role: z.enum(['admin', 'supervisor', 'agent', 'basic']),
})

type Values = z.infer<typeof schema>

function NewEmployeePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      username: '',
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      gender: 'GENDER_MALE',
      phone: '',
      address: '',
      position: '',
      department: '',
      active: true,
      role: 'basic',
    },
  })

  const mut = useMutation({
    mutationFn: (input: CreateEmployeeInput) => createEmployee(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.employee.all })
      navigate({ to: '/portal/employees' })
    },
  })

  const onSubmit = form.handleSubmit((values) => mut.mutate(values))
  const error = mut.error ? apiError(mut.error, 'Greška pri kreiranju') : null

  return (
    <main className="container py-8">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Novi zaposleni</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {error && <ErrorBanner>{error}</ErrorBanner>}
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Email" type="email" name="email" form={form} />
              <TextField label="Korisničko ime" name="username" form={form} />
              <TextField label="Ime" name="firstName" form={form} />
              <TextField label="Prezime" name="lastName" form={form} />
              <TextField label="Datum rođenja" type="date" name="dateOfBirth" form={form} />
              <div>
                <Label htmlFor="gender">Pol</Label>
                <Select id="gender" {...form.register('gender')}>
                  <option value="GENDER_MALE">Muški</option>
                  <option value="GENDER_FEMALE">Ženski</option>
                </Select>
              </div>
              <TextField label="Telefon" name="phone" form={form} />
              <TextField label="Adresa" name="address" form={form} />
              <TextField label="Pozicija" name="position" form={form} />
              <TextField label="Departman" name="department" form={form} />
              <div>
                <Label htmlFor="role">Uloga</Label>
                <select
                  id="role"
                  className="block w-full rounded-md border border-input bg-surface px-3 py-2 text-sm shadow-sm"
                  {...form.register('role')}
                >
                  <option value="basic">Zaposleni (osnovno)</option>
                  <option value="agent">Agent</option>
                  <option value="supervisor">Supervizor</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input id="active" type="checkbox" {...form.register('active')} />
                <Label htmlFor="active" className="mb-0">
                  Aktivan
                </Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Link to="/portal/employees">
                <Button type="button" variant="secondary">
                  Odustani
                </Button>
              </Link>
              <Button type="submit" disabled={mut.isPending}>
                {mut.isPending ? 'Kreiranje…' : 'Kreiraj zaposlenog'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

// TextField pairs the page's Zod-validated string fields with their
// label + inline error in a single call site. Stays inline because
// only this form uses it; lift to components/ if a second one needs
// the same shape.
type TextFieldName =
  | 'email'
  | 'username'
  | 'firstName'
  | 'lastName'
  | 'dateOfBirth'
  | 'phone'
  | 'address'
  | 'position'
  | 'department'

function TextField({
  label,
  type = 'text',
  name,
  form,
}: {
  label: string
  type?: string
  name: TextFieldName
  form: ReturnType<typeof useForm<Values>>
}) {
  const err = form.formState.errors[name]?.message
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} type={type} {...form.register(name)} />
      {err && <p className="mt-1 text-xs text-danger">{err}</p>}
    </div>
  )
}
