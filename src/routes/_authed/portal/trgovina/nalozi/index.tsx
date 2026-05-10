import { createFileRoute, Link, redirect, useSearch } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { listOrders, approveOrder, declineOrder, cancelOrder } from '@/lib/api/orders'
import { apiError } from '@/lib/api/error'
import { useSecurityTickers } from '@/lib/trading/useSecurityTickers'
import { useUserDisplayNames } from '@/lib/trading/useUserDisplayNames'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'
import { v1OrderStatus } from '@/lib/api/generated/models/v1OrderStatus'
import { v1Direction } from '@/lib/api/generated/models/v1Direction'
import { bankaTradingV1UserKind } from '@/lib/api/generated/models/bankaTradingV1UserKind'
import { directionLabel, orderStatusLabel, orderTypeLabel } from '@/lib/labels'
import { formatDateTime } from '@/lib/format'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error'

const ALL_PERMS = [
  Permissions.Admin,
  Permissions.Actuary,
  Permissions.ActuarySupervisor,
  Permissions.ActuaryAgent,
] as const

const searchSchema = z.object({
  status: z.string().optional(),
  userId: z.string().optional(),
})

export const Route = createFileRoute('/_authed/portal/trgovina/nalozi/')({
  validateSearch: searchSchema,
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!hasAny(perms, [...ALL_PERMS])) {
      throw redirect({ to: '/portal' })
    }
  },
  component: PortalNaloziList,
})

function PortalNaloziList() {
  const search = useSearch({ from: '/_authed/portal/trgovina/nalozi/' })
  const perms = useAuthStore((s) => s.permissions)
  const isAdmin = perms.includes(Permissions.Admin)
  const isSupervisor = perms.includes(Permissions.ActuarySupervisor)
  const canSeeAll = isAdmin || isSupervisor

  const [status, setStatus] = useState<string>(search.status ?? '')
  const [direction, setDirection] = useState<string>('')
  const [userId, setUserId] = useState<string>(search.userId ?? '')
  const [actor, setActor] = useState<string>('')

  // Backend infers user from JWT for non-supervisor callers; passing
  // userId silently drops there. Same for userKind.
  const args: Parameters<typeof listOrders>[0] = {}
  if (status) args.status = status
  if (canSeeAll) {
    if (userId) args.userId = userId
    if (actor === 'client') args.userKind = bankaTradingV1UserKind.USER_KIND_CLIENT
    if (actor === 'employee') args.userKind = bankaTradingV1UserKind.USER_KIND_EMPLOYEE
  }

  const orders = useQuery({
    queryKey: keys.order.list({ ...args, direction }),
    queryFn: () => listOrders(args),
  })

  const items = (orders.data?.orders ?? []).filter((o) => {
    if (!direction) return true
    return o.direction === direction
  })
  const tickers = useSecurityTickers(items.map((o) => o.securityId))
  // Spec p.57 column "agent" needs the trader's display name. Lookup
  // requires employee.read / client.read so it's gated on canSeeAll —
  // the agent / client side of the UI never sees this screen anyway
  // (FE-11 narrows the route guard to supervisor + admin separately).
  const names = useUserDisplayNames(
    items
      .filter((o): o is typeof o & { userId: string; userKind: bankaTradingV1UserKind } =>
        Boolean(o.userId) && o.userKind !== undefined && o.userKind !== bankaTradingV1UserKind.USER_KIND_UNSPECIFIED,
      )
      .map((o) => ({ userId: o.userId, kind: o.userKind })),
    canSeeAll,
  )

  return (
    <main className="container space-y-6 py-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pregled naloga</h1>
          <p className="text-sm text-muted-foreground">
            {canSeeAll ? 'Svi nalozi (klijenti + aktuari).' : 'Vaši nalozi.'}
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link to="/portal/trgovina/nalozi/cekajuci" className="text-primary hover:underline">
            Na čekanju →
          </Link>
          <Link to="/portal/trgovina" className="text-primary hover:underline">
            ← Katalog
          </Link>
        </div>
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
        {canSeeAll && (
          <>
            <div>
              <Label htmlFor="filter-user">Korisnik (ID)</Label>
              <Input
                id="filter-user"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="UUID"
                data-cy="filter-user"
              />
            </div>
            <div>
              <Label>Aktor</Label>
              <Select value={actor} onChange={(e) => setActor(e.target.value)} data-cy="filter-actor">
                <option value="">Svi</option>
                <option value="client">Klijent</option>
                <option value="employee">Zaposleni</option>
              </Select>
            </div>
          </>
        )}
      </div>

      <Table>
        <THead>
          <TR>
            <TH>Kreirano</TH>
            <TH>Agent</TH>
            <TH>Tip</TH>
            <TH>Hartija</TH>
            <TH className="text-right">Količina</TH>
            <TH className="text-right">Veličina ugovora</TH>
            <TH className="text-right">Cena/jed.</TH>
            <TH>Smer</TH>
            <TH className="text-right">Preostalo</TH>
            <TH>Status</TH>
            <TH>{/* actions */}</TH>
          </TR>
        </THead>
        <TBody>
          {items.length === 0 ? (
            <EmptyRow colSpan={11}>{orders.isFetching ? 'Učitavanje…' : 'Nema naloga'}</EmptyRow>
          ) : (
            items.map((o) => (
              <RowActions
                key={o.id}
                order={o}
                ticker={tickers.get(o.securityId)}
                agentName={names.get(o.userId)}
                canActOnOthers={canSeeAll}
              />
            ))
          )}
        </TBody>
      </Table>
    </main>
  )
}

function RowActions({
  order,
  ticker,
  agentName,
  canActOnOthers,
}: {
  ticker: string | null
  agentName: string | null
  order: {
    id?: string
    securityId?: string
    userId?: string
    userKind?: bankaTradingV1UserKind
    direction?: v1Direction
    orderType?: import('@/lib/api/generated/models/v1OrderType').v1OrderType
    quantity?: number
    remainingQuantity?: number
    contractSize?: string
    pricePerUnit?: string
    status?: v1OrderStatus
    isDone?: boolean
    cancelled?: boolean
    createdAt?: string
  }
  canActOnOthers: boolean
}) {
  const qc = useQueryClient()
  const id = order.id ?? ''

  const approve = useMutation({
    mutationFn: () => approveOrder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.order.all }),
  })
  const decline = useMutation({
    mutationFn: () => declineOrder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.order.all }),
  })
  const cancel = useMutation({
    mutationFn: () => cancelOrder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.order.all }),
  })

  const isPending = order.status === v1OrderStatus.ORDER_STATUS_PENDING && !order.cancelled
  const cancellable = !order.cancelled && !order.isDone &&
    (order.status === v1OrderStatus.ORDER_STATUS_PENDING || order.status === v1OrderStatus.ORDER_STATUS_APPROVED)

  const busy = approve.isPending || decline.isPending || cancel.isPending
  const errMsg =
    (approve.error && apiError(approve.error, 'Greška pri odobravanju.')) ||
    (decline.error && apiError(decline.error, 'Greška pri odbijanju.')) ||
    (cancel.error && apiError(cancel.error, 'Greška pri otkazivanju.')) ||
    null

  return (
    <>
      <TR>
        <TD>{formatDateTime(order.createdAt)}</TD>
        <TD data-cy="order-row-agent">
          {agentName ?? actorLabel(order.userKind)}
        </TD>
        <TD>{order.orderType ? orderTypeLabel[order.orderType] : '—'}</TD>
        <TD className="font-mono" data-cy="order-row-ticker">{ticker ?? '…'}</TD>
        <TD className="text-right">{order.quantity ?? '—'}</TD>
        <TD className="text-right" data-cy="order-row-contract-size">{order.contractSize ?? '—'}</TD>
        <TD className="text-right" data-cy="order-row-ppu">{order.pricePerUnit ?? '—'}</TD>
        <TD>{order.direction ? directionLabel[order.direction] : '—'}</TD>
        <TD className="text-right">{order.remainingQuantity ?? order.quantity ?? '—'}</TD>
        <TD><StatusBadge order={order} /></TD>
        <TD className="space-x-2 whitespace-nowrap">
          <Link
            to="/portal/trgovina/nalozi/$orderId"
            params={{ orderId: id }}
            className="text-primary hover:underline"
          >
            Detalji
          </Link>
          {canActOnOthers && isPending && (
            <>
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={busy}
                data-cy="approve-order"
                onClick={() => approve.mutate()}
              >
                Odobri
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={busy}
                data-cy="decline-order"
                onClick={() => decline.mutate()}
              >
                Odbij
              </Button>
            </>
          )}
          {canActOnOthers && cancellable && !isPending && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              data-cy="cancel-order"
              onClick={() => cancel.mutate()}
            >
              Otkaži
            </Button>
          )}
        </TD>
      </TR>
      {errMsg && (
        <TR>
          <TD colSpan={11}><ErrorBanner>{errMsg}</ErrorBanner></TD>
        </TR>
      )}
    </>
  )
}

function actorLabel(kind: bankaTradingV1UserKind | undefined): string {
  switch (kind) {
    case bankaTradingV1UserKind.USER_KIND_CLIENT: return 'Klijent'
    case bankaTradingV1UserKind.USER_KIND_EMPLOYEE: return 'Zaposleni'
    default: return '—'
  }
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
