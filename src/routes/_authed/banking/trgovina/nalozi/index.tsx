import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listOrders, makeDateBound, type ListOrdersArgs } from '@/lib/api/orders'
import { useSecurityTickers } from '@/lib/trading/useSecurityTickers'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { v1OrderStatus } from '@/lib/api/generated/models/v1OrderStatus'
import { v1Direction } from '@/lib/api/generated/models/v1Direction'
import { v1OrderType } from '@/lib/api/generated/models/v1OrderType'
import { directionLabel, orderStatusLabel, orderTypeLabel } from '@/lib/labels'
import { formatDateTime, formatMoney } from '@/lib/format'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
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
  const navigate = useNavigate()
  const [status, setStatus] = useState<string>('')
  const [direction, setDirection] = useState<string>('')
  const [orderType, setOrderType] = useState<string>('')
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')

  // The backend infers user automatically from JWT for client/agent
  // callers; passing userId is supervisor-only. Status (S32), type
  // (S34) and creation-date range (S33) filter server-side; direction
  // is applied client-side because backend listOrders doesn't expose it.
  const args: ListOrdersArgs = {}
  if (status) args.status = status
  if (orderType) args.orderType = orderType
  const fromBound = makeDateBound(from)
  const toBound = makeDateBound(to, true)
  if (fromBound) args.from = fromBound
  if (toBound) args.to = toBound

  const orders = useQuery({
    queryKey: keys.order.mine({ status, direction, orderType, from, to }),
    queryFn: () => listOrders(args),
    refetchInterval: 5_000,
    staleTime: 0,
  })

  const items = (orders.data?.orders ?? []).filter((o) => {
    if (!direction) return true
    return o.direction === direction
  })
  const tickers = useSecurityTickers(items.map((o) => o.securityId))

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
        <div>
          <Label>Tip</Label>
          <Select value={orderType} onChange={(e) => setOrderType(e.target.value)} data-cy="filter-type">
            <option value="">Svi</option>
            <option value="market">{orderTypeLabel[v1OrderType.ORDER_TYPE_MARKET]}</option>
            <option value="limit">{orderTypeLabel[v1OrderType.ORDER_TYPE_LIMIT]}</option>
            <option value="stop">{orderTypeLabel[v1OrderType.ORDER_TYPE_STOP]}</option>
            <option value="stop_limit">{orderTypeLabel[v1OrderType.ORDER_TYPE_STOP_LIMIT]}</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="filter-from">Od datuma</Label>
          <Input id="filter-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-cy="filter-from" />
        </div>
        <div>
          <Label htmlFor="filter-to">Do datuma</Label>
          <Input id="filter-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} data-cy="filter-to" />
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
            <TH className="text-right">Izvršna cena</TH>
            <TH className="text-right">Provizija</TH>
            <TH>Datum izvršenja</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {items.length === 0 ? (
            <EmptyRow colSpan={10}>{orders.isFetching ? 'Učitavanje…' : 'Nemate naloga'}</EmptyRow>
          ) : (
            items.map((o) => (
              <TR
                key={o.id}
                onClick={o.id ? () => navigate({ to: '/banking/trgovina/nalozi/$orderId', params: { orderId: o.id! } }) : undefined}
              >
                <TD>{formatDateTime(o.createdAt)}</TD>
                <TD className="font-mono" data-cy="order-row-ticker">
                  {tickers.get(o.securityId) ?? '…'}
                </TD>
                <TD>{o.direction ? directionLabel[o.direction] : '—'}</TD>
                <TD>{o.orderType ? orderTypeLabel[o.orderType] : '—'}</TD>
                <TD className="text-right">{o.quantity ?? '—'}</TD>
                <TD className="text-right">{o.remainingQuantity ?? o.quantity ?? '—'}</TD>
                <TD className="text-right" data-cy="order-row-exec-price">
                  {o.avgExecutionPrice ? formatMoney(o.avgExecutionPrice) : '—'}
                </TD>
                <TD className="text-right" data-cy="order-row-commission">
                  {o.totalCommission ? formatMoney(o.totalCommission) : '—'}
                </TD>
                <TD data-cy="order-row-exec-date">
                  {o.lastExecutionAt ? formatDateTime(o.lastExecutionAt) : '—'}
                </TD>
                <TD><StatusBadge order={o} /></TD>
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
