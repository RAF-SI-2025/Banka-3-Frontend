import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import {
  getEmployee,
  resendActivation,
  setEmployeeActive,
  setEmployeePermissions,
  updateEmployee,
  type Employee,
  type Gender,
  type UpdateEmployeeInput,
} from '@/lib/api/employees'
import { Permissions, has, permissionLabels, type Permission } from '@/lib/permissions'
import { useAuthStore } from '@/lib/auth/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorBanner } from '@/components/ui/error'

export const Route = createFileRoute('/_authed/portal/employees/$id')({
  component: EditEmployeePage,
})

const ALL_PERMISSIONS: Permission[] = Object.values(Permissions)

function EditEmployeePage() {
  const { id } = Route.useParams()
  const qc = useQueryClient()
  const userPerms = useAuthStore((s) => s.permissions)
  const canGrant = has(userPerms, Permissions.PermissionGrant)

  const q = useQuery({
    queryKey: ['employee', id],
    queryFn: () => getEmployee(id),
  })

  const [form, setForm] = useState<UpdateEmployeeInput | null>(null)
  const [perms, setPerms] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (q.data && form === null) {
      setForm({
        email: q.data.email,
        firstName: q.data.firstName,
        lastName: q.data.lastName,
        gender: q.data.gender,
        phone: q.data.phone,
        address: q.data.address,
        position: q.data.position,
        department: q.data.department,
      })
      setPerms(q.data.permissions ?? [])
    }
  }, [q.data, form])

  const update = useMutation({
    mutationFn: (input: UpdateEmployeeInput) => updateEmployee(id, input),
    onSuccess: (e) => onUpdated(e),
    onError: (e) => surfaceError(e),
  })
  const setActive = useMutation({
    mutationFn: (active: boolean) => setEmployeeActive(id, active),
    onSuccess: (e) => onUpdated(e),
    onError: (e) => surfaceError(e),
  })
  const setPerm = useMutation({
    mutationFn: (next: string[]) => setEmployeePermissions(id, next),
    onSuccess: (e) => onUpdated(e),
    onError: (e) => surfaceError(e),
  })
  const resend = useMutation({
    mutationFn: () => resendActivation(id),
    onError: (e) => surfaceError(e),
  })

  function onUpdated(e: Employee) {
    qc.invalidateQueries({ queryKey: ['employees'] })
    qc.invalidateQueries({ queryKey: ['employee', e.id] })
    setError(null)
  }

  function surfaceError(e: unknown) {
    if (e instanceof AxiosError) setError(e.response?.data?.message ?? 'Greška')
    else setError('Greška')
  }

  if (q.isLoading) return <main className="container py-8">Učitavanje…</main>
  if (q.isError || !q.data || !form) return <main className="container py-8">Greška pri učitavanju.</main>
  const emp = q.data

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    update.mutate(form)
  }

  function field<K extends keyof UpdateEmployeeInput>(k: K, v: UpdateEmployeeInput[K]) {
    setForm((f) => (f ? { ...f, [k]: v } : f))
  }

  function togglePerm(p: string) {
    setPerms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))
  }

  return (
    <main className="container space-y-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{emp.firstName} {emp.lastName}</h1>
        <Link to="/portal" className="text-blue-600 hover:underline">
          ← Nazad na listu
        </Link>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Card>
        <CardHeader>
          <CardTitle>Podaci</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={form.email ?? ''} onChange={(e) => field('email', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="username">Korisničko ime</Label>
              <Input id="username" value={emp.username} disabled readOnly />
              <p className="mt-1 text-xs text-gray-500">Korisničko ime se ne menja nakon kreiranja.</p>
            </div>
            <div>
              <Label htmlFor="firstName">Ime</Label>
              <Input id="firstName" value={form.firstName ?? ''} onChange={(e) => field('firstName', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="lastName">Prezime</Label>
              <Input id="lastName" value={form.lastName ?? ''} onChange={(e) => field('lastName', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="phone">Telefon</Label>
              <Input id="phone" value={form.phone ?? ''} onChange={(e) => field('phone', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="address">Adresa</Label>
              <Input id="address" value={form.address ?? ''} onChange={(e) => field('address', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="position">Pozicija</Label>
              <Input id="position" value={form.position ?? ''} onChange={(e) => field('position', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="department">Departman</Label>
              <Input id="department" value={form.department ?? ''} onChange={(e) => field('department', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="gender">Pol</Label>
              <select
                id="gender"
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                value={form.gender ?? ''}
                onChange={(e) => field('gender', e.target.value as Gender)}
              >
                <option value="GENDER_MALE">Muški</option>
                <option value="GENDER_FEMALE">Ženski</option>
                <option value="GENDER_OTHER">Drugo</option>
              </select>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? 'Snimanje…' : 'Sačuvaj izmene'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status naloga</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <span className={emp.active ? 'text-green-700' : 'text-red-700'}>
            {emp.active ? 'Aktivan' : 'Deaktiviran'}
          </span>
          <Button
            variant={emp.active ? 'danger' : 'primary'}
            disabled={setActive.isPending}
            onClick={() => setActive.mutate(!emp.active)}
          >
            {emp.active ? 'Deaktiviraj' : 'Aktiviraj'}
          </Button>
          {!emp.activated && (
            <>
              <span className="text-sm text-gray-500">
                Nalog još nije aktiviran (link iz mejla nije iskorišćen).
              </span>
              <Button
                variant="secondary"
                disabled={resend.isPending || resend.isSuccess}
                onClick={() => resend.mutate()}
              >
                {resend.isSuccess
                  ? 'Mejl poslat'
                  : resend.isPending
                    ? 'Slanje…'
                    : 'Pošalji aktivaciju ponovo'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {canGrant && (
        <Card>
          <CardHeader>
            <CardTitle>Permisije</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2">
              {ALL_PERMISSIONS.map((p) => (
                <label key={p} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={perms.includes(p)}
                    onChange={() => togglePerm(p)}
                  />
                  <span>
                    <span className="block">{permissionLabels[p]}</span>
                    <code className="text-xs text-gray-500">{p}</code>
                  </span>
                </label>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setPerm.mutate(perms)} disabled={setPerm.isPending}>
                {setPerm.isPending ? 'Snimanje…' : 'Sačuvaj permisije'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
