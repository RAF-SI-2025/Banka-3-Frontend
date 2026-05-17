import { useEffect, useState } from 'react'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getActuaryInfo,
  resetActuaryUsedLimit,
  setActuaryNeedApproval,
  updateActuaryLimit,
} from '@/lib/api/actuaries'
import { getEmployee } from '@/lib/api/employees'
import { apiError } from '@/lib/api/error'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'
import { v1ActuaryType } from '@/lib/api/generated/models/v1ActuaryType'
import { actuaryTypeLabel } from '@/lib/labels'
import { formatMoney } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorBanner } from '@/components/ui/error'
import { Dialog } from '@/components/ui/dialog'

const GATE = [Permissions.Admin, Permissions.ActuarySupervisor] as const

export const Route = createFileRoute('/_authed/portal/aktuari/$employeeId')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!hasAny(perms, [...GATE])) {
      throw redirect({ to: '/portal' })
    }
  },
  component: ActuaryDetail,
})

function ActuaryDetail() {
  const { employeeId } = Route.useParams()
  const qc = useQueryClient()

  const actuary = useQuery({
    queryKey: keys.actuary.detail(employeeId),
    queryFn: () => getActuaryInfo(employeeId),
  })
  const employee = useQuery({
    queryKey: keys.employee.detail(employeeId),
    queryFn: () => getEmployee(employeeId),
  })

  const [limit, setLimit] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => {
    if (actuary.data?.dailyLimit !== undefined) {
      setLimit(actuary.data.dailyLimit ?? '')
    }
  }, [actuary.data?.dailyLimit])

  function invalidate() {
    qc.invalidateQueries({ queryKey: keys.actuary.all })
    qc.invalidateQueries({ queryKey: keys.actuary.detail(employeeId) })
  }

  const updateLimit = useMutation({
    mutationFn: () => updateActuaryLimit(employeeId, limit),
    onSuccess: invalidate,
  })
  const resetUsed = useMutation({
    mutationFn: () => resetActuaryUsedLimit(employeeId),
    onSuccess: () => {
      invalidate()
      setConfirmReset(false)
    },
  })
  const toggleApproval = useMutation({
    mutationFn: (need: boolean) => setActuaryNeedApproval(employeeId, need),
    onSuccess: invalidate,
  })

  const error =
    apiError(updateLimit.error, '') ||
    apiError(resetUsed.error, '') ||
    apiError(toggleApproval.error, '') ||
    null

  if (actuary.isLoading || employee.isLoading) {
    return <PageSkeleton />
  }
  if (actuary.isError || !actuary.data) {
    return <main className="container py-8">Greška pri učitavanju aktuara.</main>
  }

  const a = actuary.data
  const emp = employee.data
  const isSupervisor = a.type === v1ActuaryType.ACTUARY_TYPE_SUPERVISOR

  return (
    <main className="container space-y-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {emp ? `${emp.firstName} ${emp.lastName}` : 'Aktuar'}
        </h1>
        <Link to="/portal/aktuari" className="text-primary hover:underline">
          ← Nazad na listu
        </Link>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {emp && (
        <Card>
          <CardHeader>
            <CardTitle>Zaposleni</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm md:grid-cols-2">
            <Field label="Email" value={emp.email} />
            <Field label="Pozicija" value={emp.position} />
            <Field label="Departman" value={emp.department} />
            <Field label="Telefon" value={emp.phone} />
            <Field label="Tip aktuara" value={a.type ? actuaryTypeLabel[a.type] : '—'} />
            <Field label="Status" value={emp.active ? 'Aktivan' : 'Deaktiviran'} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Limit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSupervisor ? (
            <p className="text-sm text-muted-foreground">
              Supervizor nema dnevni limit (spec p.38).
            </p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label htmlFor="daily-limit">Dnevni limit (RSD)</Label>
                  <Input
                    id="daily-limit"
                    data-cy="daily-limit-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Trenutno: {formatMoney(a.dailyLimit)} RSD
                  </p>
                </div>
                <div>
                  <Label>Iskorišćeno danas</Label>
                  <p className="text-base font-medium" data-cy="used-limit-display">
                    {formatMoney(a.usedLimit)} RSD
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cron resetuje na 0 svaki dan u 23:59 (Europe/Belgrade).
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  data-cy="save-limit"
                  disabled={updateLimit.isPending || limit === ''}
                  onClick={() => updateLimit.mutate()}
                >
                  {updateLimit.isPending ? 'Snimanje…' : 'Sačuvaj'}
                </Button>
                <Button
                  variant="secondary"
                  data-cy="reset-used"
                  disabled={resetUsed.isPending}
                  onClick={() => setConfirmReset(true)}
                >
                  Resetuj iskorišćeno
                </Button>
                <Checkbox
                    className="ml-auto"
                    data-cy="need-approval-toggle"
                    label="Potrebno odobrenje"
                    checked={!!a.needApproval}
                    disabled={toggleApproval.isPending}
                    onChange={(e) => toggleApproval.mutate((e.target as HTMLInputElement).checked)}
                  />
                <span>Zahteva odobrenje supervizora</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aktivni nalozi</CardTitle>
        </CardHeader>
        <CardContent>
          <Link
            to="/portal/trgovina/nalozi"
            search={{ userId: employeeId }}
            className="text-primary hover:underline"
            data-cy="open-orders-link"
          >
            Otvori naloge ovog aktuara →
          </Link>
        </CardContent>
      </Card>

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Resetovanje iskorišćenog limita"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>
              Otkaži
            </Button>
            <Button
              variant="danger"
              data-cy="confirm-reset"
              disabled={resetUsed.isPending}
              onClick={() => resetUsed.mutate()}
            >
              {resetUsed.isPending ? 'Resetovanje…' : 'Resetuj'}
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Postaviti iskorišćeni dnevni limit za ovog aktuara na 0 RSD?
        </p>
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <p className="text-sm">{value || '—'}</p>
    </div>
  )
}