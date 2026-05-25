import { useEffect, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  getEmployee,
  resendActivation,
  setEmployeeActive,
  setEmployeePermissions,
  updateEmployee,
  type Employee,
  type UpdateEmployeeInput,
} from '@/lib/api/employees'
import { apiError } from '@/lib/api/error'
import { keys } from '@/lib/query-keys'
import { Permissions, has, permissionLabels, type Permission } from '@/lib/permissions'
import { useAuthStore } from '@/lib/auth/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorBanner } from '@/components/ui/error'

export const Route = createFileRoute('/_authed/portal/employees/$id')({
  component: EditEmployeePage,
})

const ALL_PERMISSIONS: Permission[] = Object.values(Permissions)

const schema = z.object({
  email: z.string().email('Unesite ispravan email'),
  firstName: z.string().min(1, 'Ime je obavezno'),
  lastName: z.string().min(1, 'Prezime je obavezno'),
  phone: z.string().regex(/^\+?[0-9]{6,20}$/, 'Telefon: 6–20 cifara, opciono +'),
  address: z.string().min(1, 'Adresa je obavezna'),
  position: z.string().min(1, 'Pozicija je obavezna'),
  department: z.string().min(1, 'Departman je obavezan'),
  gender: z.enum(['GENDER_MALE', 'GENDER_FEMALE']),
})

type Values = z.infer<typeof schema>

function EditEmployeePage() {
  const { id } = Route.useParams()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const userPerms = useAuthStore((s) => s.permissions)
  const currentUserId = useAuthStore((s) => s.userId)
  const canGrant = has(userPerms, Permissions.PermissionGrant)
  // Editing your own permissions invites footguns (revoking your own
  // admin and locking yourself out, especially with `admin` being
  // sole-maintainer). Spec p.9 doesn't require self-edit; gate the
  // entire panel off when the target is the logged-in user.
  const isSelf = currentUserId !== null && currentUserId === id

  const q = useQuery({
    queryKey: keys.employee.detail(id),
    queryFn: () => getEmployee(id),
  })

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      phone: '',
      address: '',
      position: '',
      department: '',
      gender: 'GENDER_MALE',
    },
  })

  const [perms, setPerms] = useState<string[]>([])

  useEffect(() => {
    if (q.data && !form.formState.isDirty) {
      form.reset({
        email: q.data.email,
        firstName: q.data.firstName,
        lastName: q.data.lastName,
        phone: q.data.phone,
        address: q.data.address,
        position: q.data.position,
        department: q.data.department,
        // Legacy data may carry GENDER_OTHER (now removed from the
        // dropdown); fall back to MALE so the form stays valid.
        gender: (q.data.gender === 'GENDER_FEMALE' ? 'GENDER_FEMALE' : 'GENDER_MALE') as Values['gender'],
      })
      setPerms(q.data.permissions ?? [])
    }
  }, [q.data, form])

  function onUpdated(e: Employee) {
    qc.invalidateQueries({ queryKey: keys.employee.all })
    qc.invalidateQueries({ queryKey: keys.employee.detail(e.id) })
  }

  const update = useMutation({
    mutationFn: (input: UpdateEmployeeInput) => updateEmployee(id, input),
    onSuccess: (e) => {
      onUpdated(e)
      // Return to the list so the user sees their save reflected.
      // The list query was already invalidated above, so the navigated-
      // to page refetches before render.
      navigate({ to: '/portal/employees' })
    },
  })
  const setActive = useMutation({
    mutationFn: (active: boolean) => setEmployeeActive(id, active),
    onSuccess: onUpdated,
  })
  const setPerm = useMutation({
    mutationFn: (next: string[]) => setEmployeePermissions(id, next),
    onSuccess: onUpdated,
  })
  const resend = useMutation({ mutationFn: () => resendActivation(id) })

  const error =
    apiError(update.error, '') ||
    apiError(setActive.error, '') ||
    apiError(setPerm.error, '') ||
    apiError(resend.error, '') ||
    null

  if (q.isLoading) return <main className="container py-8">Učitavanje…</main>
  if (q.isError || !q.data) return <main className="container py-8">Greška pri učitavanju.</main>
  const emp = q.data

  const onSubmit = form.handleSubmit((v) => update.mutate(v))

  function togglePerm(p: string) {
    setPerms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))
  }

  return (
    <main className="container space-y-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {emp.firstName} {emp.lastName}
        </h1>
        <Link to="/portal/employees" className="text-primary hover:underline">
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
            <FormField label="Email" name="email" form={form} />
            <div>
              <Label htmlFor="username">Korisničko ime</Label>
              <Input id="username" value={emp.username} disabled readOnly />
              <p className="mt-1 text-xs text-muted-foreground">Korisničko ime se ne menja nakon kreiranja.</p>
            </div>
            <FormField label="Ime" name="firstName" form={form} />
            <FormField label="Prezime" name="lastName" form={form} />
            <FormField label="Telefon" name="phone" form={form} />
            <FormField label="Adresa" name="address" form={form} />
            <FormField label="Pozicija" name="position" form={form} />
            <FormField label="Departman" name="department" form={form} />
            <div>
              <Label htmlFor="gender">Pol</Label>
              <Select id="gender" {...form.register('gender')}>
                <option value="GENDER_MALE">Muški</option>
                <option value="GENDER_FEMALE">Ženski</option>
              </Select>
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
          <span className={emp.active ? 'text-success-soft-foreground' : 'text-danger'}>
            {emp.active ? 'Aktivan' : 'Deaktiviran'}
          </span>
          <Button
            variant={emp.active ? 'danger' : 'primary'}
            disabled={setActive.isPending || (isSelf && emp.active)}
            title={isSelf && emp.active ? 'Ne možete deaktivirati sopstveni nalog' : undefined}
            onClick={() => setActive.mutate(!emp.active)}
          >
            {emp.active ? 'Deaktiviraj' : 'Aktiviraj'}
          </Button>
          {!emp.activated && (
            <>
              <span className="text-sm text-muted-foreground">
                Nalog još nije aktiviran (link iz mejla nije iskorišćen).
              </span>
              <Button
                variant="secondary"
                disabled={resend.isPending || resend.isSuccess}
                onClick={() => resend.mutate()}
              >
                {resend.isSuccess ? 'Mejl poslat' : resend.isPending ? 'Slanje…' : 'Pošalji aktivaciju ponovo'}
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
            {isSelf ? (
              <p className="text-sm text-muted-foreground">
                Ne možete menjati sopstvene permisije. Zamolite drugog administratora ako je promena potrebna.
              </p>
            ) : (
              <>
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
                        <code className="text-xs text-muted-foreground">{p}</code>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => setPerm.mutate(perms)} disabled={setPerm.isPending}>
                    {setPerm.isPending ? 'Snimanje…' : 'Sačuvaj permisije'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  )
}

type FieldName = 'email' | 'firstName' | 'lastName' | 'phone' | 'address' | 'position' | 'department'

function FormField({
  label,
  name,
  form,
}: {
  label: string
  name: FieldName
  form: ReturnType<typeof useForm<Values>>
}) {
  const err = form.formState.errors[name]?.message
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} {...form.register(name)} />
      {err && <p className="mt-1 text-xs text-danger">{err}</p>}
    </div>
  )
}
