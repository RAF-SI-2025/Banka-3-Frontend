import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { approveOrder, cancelOrder, declineOrder, getOrder } from '@/lib/api/orders'
import { apiError } from '@/lib/api/error'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'
import { v1OrderStatus } from '@/lib/api/generated/models/v1OrderStatus'
import { bankaTradingV1UserKind } from '@/lib/api/generated/models/bankaTradingV1UserKind'
import { directionLabel, orderStatusLabel, orderTypeLabel } from '@/lib/labels'
import { formatDateTime, formatMoney } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorBanner } from '@/components/ui/error'

const ALL_PERMS = [
  Permissions.Admin,
  Permissions.Actuary,
  Permissions.ActuarySupervisor,
  Permissions.ActuaryAgent,
] as const

export const Route = createFileRoute('/_authed/portal/trgovina/nalozi/$orderId')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!hasAny(perms, [...ALL_PERMS])) {
      throw redirect({ to: '/portal' })
    }
  },
  component: PortalOrderDetail,
})

function PortalOrderDetail() {
  const { orderId } = Route.useParams()
  const qc = useQueryClient()
  const perms = useAuthStore((s) => s.permissions)
  const canAct = perms.includes(Permissions.Admin) || perms.includes(Permissions.ActuarySupervisor)

  const order = useQuery({
    queryKey: keys.order.detail(orderId),
    queryFn: () => getOrder(orderId),
  })

  const [reason, setReason] = useState('')

  const approve = useMutation({
    mutationFn: () => approveOrder(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.order.all })
      qc.invalidateQueries({ queryKey: keys.order.detail(orderId) })
    },
  })
  const decline = useMutation({
    mutationFn: () => declineOrder(orderId, reason || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.order.all })
      qc.invalidateQueries({ queryKey: keys.order.detail(orderId) })
    },
  })
  const cancel = useMutation({
    mutationFn: () => cancelOrder(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.order.all })
      qc.invalidateQueries({ queryKey: keys.order.detail(orderId) })
    },
  })

  const o = order.data
  const isPending = o?.status === v1OrderStatus.ORDER_STATUS_PENDING && !o.cancelled
  const cancellable = o && !o.cancelled && !o.isDone &&
    (o.status === v1OrderStatus.ORDER_STATUS_PENDING || o.status === v1OrderStatus.ORDER_STATUS_APPROVED)
  const filled = o && o.quantity !== undefined && o.remainingQuantity !== undefined ? o.quantity - o.remainingQuantity : null

  const busy = approve.isPending || decline.isPending || cancel.isPending
  const errMsg =
    (approve.error && apiError(approve.error, 'Greška pri odobravanju.')) ||
    (decline.error && apiError(decline.error, 'Greška pri odbijanju.')) ||
    (cancel.error && apiError(cancel.error, 'Greška pri otkazivanju.')) ||
    null

  return (
    <main className="container space-y-6 py-8">
      <Link to="/portal/trgovina/nalozi" className="text-sm text-muted-foreground hover:text-foreground">
        ← Nazad na listu
      </Link>

      {order.isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Nalog nije pronađen.
        </div>
      )}

      {o && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle>Nalog #{o.id}</CardTitle>
              <div className="flex flex-wrap gap-2">
                {canAct && isPending && (
                  <>
                    <Button
                      type="button"
                      variant="primary"
                      disabled={busy}
                      data-cy="approve-order"
                      onClick={() => approve.mutate()}
                    >
                      Odobri
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      disabled={busy}
                      data-cy="decline-order"
                      onClick={() => decline.mutate()}
                    >
                      Odbij
                    </Button>
                  </>
                )}
                {canAct && cancellable && !isPending && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    data-cy="cancel-order"
                    onClick={() => cancel.mutate()}
                  >
                    Otkaži
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Korisnik">{o.userId ?? '—'}</Row>
              <Row label="Aktor">{actorLabel(o.userKind)}</Row>
              <Row label="Hartija">{o.securityId}</Row>
              <Row label="Tip">{o.orderType ? orderTypeLabel[o.orderType] : '—'}</Row>
              <Row label="Smer">{o.direction ? directionLabel[o.direction] : '—'}</Row>
              <Row label="Količina">{o.quantity ?? '—'}</Row>
              <Row label="Preostalo">{o.remainingQuantity ?? '—'}</Row>
              <Row label="Realizovano">{filled ?? '—'}</Row>
              <Row label="Cena po jedinici">{formatMoney(o.pricePerUnit)}</Row>
              <Row label="Limit">{formatMoney(o.limitPrice)}</Row>
              <Row label="Stop">{formatMoney(o.stopPrice)}</Row>
              <Row label="AON">{o.allOrNone ? 'Da' : 'Ne'}</Row>
              <Row label="Margin">{o.margin ? 'Da' : 'Ne'}</Row>
              <Row label="Status">{o.status ? orderStatusLabel[o.status] : '—'}{o.cancelled ? ' (otkazan)' : ''}{o.isDone ? ' (realizovan)' : ''}</Row>
              <Row label="Odobrio">{o.approvedBy ?? '—'}</Row>
              <Row label="Kreirano">{formatDateTime(o.createdAt)}</Row>
            </CardContent>
          </Card>

          {canAct && isPending && (
            <Card>
              <CardHeader><CardTitle>Razlog odbijanja (opciono)</CardTitle></CardHeader>
              <CardContent>
                <Label htmlFor="decline-reason">Razlog</Label>
                <Input
                  id="decline-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="npr. nedovoljno sredstava"
                  data-cy="decline-reason"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Razlog se šalje uz „Odbij" dugme iznad.
                </p>
              </CardContent>
            </Card>
          )}

          {errMsg && <ErrorBanner>{errMsg}</ErrorBanner>}
        </>
      )}
    </main>
  )
}

function actorLabel(kind: bankaTradingV1UserKind | undefined): string {
  switch (kind) {
    case bankaTradingV1UserKind.USER_KIND_CLIENT: return 'Klijent'
    case bankaTradingV1UserKind.USER_KIND_EMPLOYEE: return 'Zaposleni'
    default: return '—'
  }
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/40 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  )
}
