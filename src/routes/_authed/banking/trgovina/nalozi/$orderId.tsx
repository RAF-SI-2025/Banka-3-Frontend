import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cancelOrder, getOrder } from '@/lib/api/orders'
import { apiError } from '@/lib/api/error'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { v1OrderStatus } from '@/lib/api/generated/models/v1OrderStatus'
import { directionLabel, orderStatusLabel, orderTypeLabel } from '@/lib/labels'
import { formatDateTime, formatMoney } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error'

export const Route = createFileRoute('/_authed/banking/trgovina/nalozi/$orderId')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!has(perms, Permissions.TradingClient)) {
      throw redirect({ to: '/banking' })
    }
  },
  component: OrderDetail,
})

function OrderDetail() {
  const { orderId } = Route.useParams()
  const qc = useQueryClient()

  const order = useQuery({
    queryKey: keys.order.detail(orderId),
    queryFn: () => getOrder(orderId),
  })

  const cancel = useMutation({
    mutationFn: () => cancelOrder(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.order.all })
      qc.invalidateQueries({ queryKey: keys.order.detail(orderId) })
    },
  })

  const o = order.data
  const cancellable =
    o &&
    !o.cancelled &&
    !o.isDone &&
    (o.status === v1OrderStatus.ORDER_STATUS_PENDING || o.status === v1OrderStatus.ORDER_STATUS_APPROVED)
  const filled = o && o.quantity !== undefined && o.remainingQuantity !== undefined ? o.quantity - o.remainingQuantity : null

  return (
    <main className="container space-y-6 py-8">
      <Link to="/banking/trgovina/nalozi" className="text-sm text-muted-foreground hover:text-foreground">
        ← Nazad na listu
      </Link>

      {order.isError && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">Nalog nije pronađen.</div>}

      {o && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle>Nalog #{o.id}</CardTitle>
              {cancellable && (
                <Button type="button" variant="danger" data-cy="cancel-order" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
                  {cancel.isPending ? 'Otkazujem…' : 'Otkaži nalog'}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
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
              <Row label="Kreirano">{formatDateTime(o.createdAt)}</Row>
            </CardContent>
          </Card>

          {cancel.error && <ErrorBanner>{apiError(cancel.error, 'Greška pri otkazivanju.')}</ErrorBanner>}

          <Card>
            <CardHeader><CardTitle>Realizacije</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Detaljan prikaz pojedinačnih realizacija dolazi sa proširenjem backend-a.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </main>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/40 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  )
}
