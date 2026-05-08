import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { createEmployee, type CreateEmployeeInput, type Gender } from '@/lib/api/employees'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorBanner } from '@/components/ui/error'

export const Route = createFileRoute('/_authed/portal/employees/new')({
  component: NewEmployeePage,
})

const initial: CreateEmployeeInput = {
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
}

function NewEmployeePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState<CreateEmployeeInput>(initial)
  const [error, setError] = useState<string | null>(null)

  const mut = useMutation({
    mutationFn: (input: CreateEmployeeInput) => createEmployee(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      navigate({ to: '/portal' })
    },
    onError: (e) => {
      if (e instanceof AxiosError) setError(e.response?.data?.message ?? 'Greška pri kreiranju')
      else setError('Greška pri kreiranju')
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    mut.mutate(form)
  }

  function field<K extends keyof CreateEmployeeInput>(k: K, v: CreateEmployeeInput[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

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
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={form.email} onChange={(e) => field('email', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="username">Korisničko ime</Label>
                <Input id="username" required value={form.username} onChange={(e) => field('username', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="firstName">Ime</Label>
                <Input id="firstName" required value={form.firstName} onChange={(e) => field('firstName', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="lastName">Prezime</Label>
                <Input id="lastName" required value={form.lastName} onChange={(e) => field('lastName', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="dateOfBirth">Datum rođenja</Label>
                <Input id="dateOfBirth" type="date" required value={form.dateOfBirth} onChange={(e) => field('dateOfBirth', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="gender">Pol</Label>
                <select
                  id="gender"
                  className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm"
                  value={form.gender}
                  onChange={(e) => field('gender', e.target.value as Gender)}
                >
                  <option value="GENDER_MALE">Muški</option>
                  <option value="GENDER_FEMALE">Ženski</option>
                  <option value="GENDER_OTHER">Drugo</option>
                </select>
              </div>
              <div>
                <Label htmlFor="phone">Telefon</Label>
                <Input id="phone" required value={form.phone} onChange={(e) => field('phone', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="address">Adresa</Label>
                <Input id="address" required value={form.address} onChange={(e) => field('address', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="position">Pozicija</Label>
                <Input id="position" required value={form.position} onChange={(e) => field('position', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="department">Departman</Label>
                <Input id="department" required value={form.department} onChange={(e) => field('department', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="role">Uloga</Label>
                <select
                  id="role"
                  className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm"
                  value={form.role}
                  onChange={(e) => field('role', e.target.value as CreateEmployeeInput['role'])}
                >
                  <option value="basic">Zaposleni (osnovno)</option>
                  <option value="agent">Agent</option>
                  <option value="supervisor">Supervizor</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  id="active"
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => field('active', e.target.checked)}
                />
                <Label htmlFor="active" className="mb-0">Aktivan</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Link to="/portal">
                <Button type="button" variant="secondary">Odustani</Button>
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
