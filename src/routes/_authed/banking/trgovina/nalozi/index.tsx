import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listOrders } from '@/lib/api/orders'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { v1OrderStatus } from '@/lib/api/generated/models/v1OrderStatus'
import { v1Direction } from '@/lib/api/generated/models/v1Direction'
import { directionLabel, orderStatusLabel, orderTypeLabel } from '@/lib/labels'
import { formatDateTime } from '@/lib/format'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/_authed/banking/trgovina/nalozi/')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!has(perms, Permissions.TradingClient)) {
      throw redirect({ to: '/banking' })
    }
  },
  component: NaloziList,
})

function NaloziList() {
  const [status, setStatus] = useState<string>('')
  const [direction, setDirection] = useState<string>('')

  // The backend infers user automatically from JWT for client/agent
  // callers; passing userId is supervisor-only. Direction filter is
  // applied client-side because backend listOrders doesn't expose it.
  const orders = useQuery({
    queryKey: keys.order.mine({ status, direction }),
    queryFn: () => listOrders(status ? { status } : {}),
  })

  const items = (orders.data?.orders ?? []).filter((o) => {
    if (!direction) return true
    return o.direction === direction
  })

  return (
    <main className="container space-y-6 py-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Moji nalozi</h1>
          <p className="text-sm text-muted-foreground">Pregled svih vaših naloga.</p>
        </div>
        <Link to="/banking/trgovina" className="text-sm text-primary hover:underline">
          ← Nazad na katalog
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-4">
        <div>
          <Label>Status</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} data-cy="filter-status">
            <option value="">Svi</option>
            <option value="pending">Na čekanju</option>
            <option value="approved">Odobreni</option>
            <option value="declined">Odbijeni</option>
            <option value="done">Realizovani</option>
          </Select>
        </div>
        <div>
          <Label>Smer</Label>
          <Select value={direction} onChange={(e) => setDirection(e.target.value)} data-cy="filter-direction">
            <option value="">Svi</option>
            <option value={v1Direction.DIRECTION_BUY}>Kupovina</option>
            <option value={v1Direction.DIRECTION_SELL}>Prodaja</option>
          </Select>
        </div>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>Kreirano</TH>
            <TH>Hartija</TH>
            <TH>Smer</TH>
            <TH>Tip</TH>
            <TH className="text-right">Količina</TH>
            <TH className="text-right">Preostalo</TH>
            <TH>Status</TH>
            <TH>{/* arrow */}</TH>
          </TR>
        </THead>
        <TBody>
          {items.length === 0 ? (
            <EmptyRow colSpan={8}>{orders.isFetching ? 'Učitavanje…' : 'Nemate naloga'}</EmptyRow>
          ) : (
            items.map((o) => (
              <TR key={o.id}>
                <TD>{formatDateTime(o.createdAt)}</TD>
                <TD className="font-mono">{o.securityId}</TD>
                <TD>{o.direction ? directionLabel[o.direction] : '—'}</TD>
                <TD>{o.orderType ? orderTypeLabel[o.orderType] : '—'}</TD>
                <TD className="text-right">{o.quantity ?? '—'}</TD>
                <TD className="text-right">{o.remainingQuantity ?? o.quantity ?? '—'}</TD>
                <TD><StatusBadge order={o} /></TD>
                <TD>
                  <Link
                    to="/banking/trgovina/nalozi/$orderId"
                    params={{ orderId: o.id! }}
                    className="text-primary hover:underline"
                  >
                    Detalji →
                  </Link>
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>
    </main>
  )
}

function StatusBadge({ order }: { order: { status?: v1OrderStatus; isDone?: boolean; cancelled?: boolean } }) {
  if (order.cancelled) return <Badge tone="neutral">Otkazan</Badge>
  if (order.isDone) return <Badge tone="green">Realizovan</Badge>
  switch (order.status) {
    case v1OrderStatus.ORDER_STATUS_PENDING:
      return <Badge tone="yellow">⏳ {orderStatusLabel[order.status]}</Badge>
    case v1OrderStatus.ORDER_STATUS_APPROVED:
      return <Badge tone="blue">{orderStatusLabel[order.status]}</Badge>
    case v1OrderStatus.ORDER_STATUS_DECLINED:
      return <Badge tone="red">{orderStatusLabel[order.status]}</Badge>
    default:
      return <Badge tone="neutral">—</Badge>
  }
}
