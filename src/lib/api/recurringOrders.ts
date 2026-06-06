import { api } from './client'

// Recurring orders / "Trajni nalog" (DCA — todoSpec C3 S47-S53). The
// backend's OpenAPI models are not regenerated for this feature batch,
// so the wire shapes are typed locally here — they mirror the
// grpc-gateway camelCase JSON 1:1.

export type RecurringMode =
  | 'RECURRING_MODE_BYAMOUNT'
  | 'RECURRING_MODE_BYQUANTITY'

// Cadence strings match pkg/schedule.Cadence on the backend.
export type RecurringCadence = 'DAILY' | 'WEEKLY' | 'MONTHLY'

export interface RecurringOrder {
  id: string
  userId: string
  userKind?: string
  securityId: string
  direction?: string
  mode: RecurringMode
  amountRsd?: string
  quantity?: number
  accountId: string
  cadence: RecurringCadence | string
  nextRun?: string
  active: boolean
  createdAt?: string
  updatedAt?: string
}

export interface ListRecurringOrdersResponse {
  recurringOrders?: RecurringOrder[]
}

export interface CreateRecurringOrderBody {
  securityId: string
  mode: RecurringMode
  // amountRsd is required for BYAMOUNT, quantity for BYQUANTITY.
  amountRsd?: string
  quantity?: number
  accountId: string
  cadence: RecurringCadence
  // Optional RFC3339 first-run anchor; empty defers to one cadence
  // interval from now (server-side).
  startDate?: string
}

export async function listRecurringOrders(): Promise<ListRecurringOrdersResponse> {
  const { data } = await api.get<ListRecurringOrdersResponse>('/v1/recurring-orders')
  return data
}

export async function createRecurringOrder(body: CreateRecurringOrderBody): Promise<RecurringOrder> {
  const { data } = await api.post<RecurringOrder>('/v1/recurring-orders', body)
  return data
}

export async function pauseRecurringOrder(id: string): Promise<RecurringOrder> {
  const { data } = await api.post<RecurringOrder>(`/v1/recurring-orders/${encodeURIComponent(id)}/pause`, {})
  return data
}

export async function resumeRecurringOrder(id: string): Promise<RecurringOrder> {
  const { data } = await api.post<RecurringOrder>(`/v1/recurring-orders/${encodeURIComponent(id)}/resume`, {})
  return data
}

export async function cancelRecurringOrder(id: string): Promise<void> {
  await api.delete(`/v1/recurring-orders/${encodeURIComponent(id)}`)
}
