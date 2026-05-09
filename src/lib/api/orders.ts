import { api } from './client'
import type { v1Order } from './generated/models/v1Order'
import type { v1ListOrdersResponse } from './generated/models/v1ListOrdersResponse'
import type { v1CreateOrderRequest } from './generated/models/v1CreateOrderRequest'
import type { bankaTradingV1UserKind } from './generated/models/bankaTradingV1UserKind'

export type Order = v1Order

export interface ListOrdersArgs {
  // "all" | "pending" | "approved" | "declined" | "done" — backend
  // also accepts a comma list per the spec edge.
  status?: string
  userKind?: bankaTradingV1UserKind
  // Supervisor view only — narrows to one trader. Ignored for
  // clients/agents (server forces own).
  userId?: string
  securityId?: string
  page?: number
  pageSize?: number
}

export async function listOrders(args: ListOrdersArgs = {}): Promise<v1ListOrdersResponse> {
  const { data } = await api.get<v1ListOrdersResponse>('/v1/orders', { params: args })
  return data
}

export async function getOrder(id: string): Promise<v1Order> {
  const { data } = await api.get<v1Order>(`/v1/orders/${encodeURIComponent(id)}`)
  return data
}

// placeOrder accepts the derived OrderType per spec p.53 — empty
// stop+limit ⇒ market, only limit ⇒ limit, only stop ⇒ stop, both
// ⇒ stop_limit. The form upstream is responsible for the derivation;
// the server validates that limit_price/stop_price are present per
// the chosen type.
export async function placeOrder(input: v1CreateOrderRequest): Promise<v1Order> {
  const { data } = await api.post<v1Order>('/v1/orders', input)
  return data
}

export async function approveOrder(id: string): Promise<v1Order> {
  const { data } = await api.post<v1Order>(`/v1/orders/${encodeURIComponent(id)}/approve`, {})
  return data
}

export async function declineOrder(id: string, reason?: string): Promise<v1Order> {
  const { data } = await api.post<v1Order>(`/v1/orders/${encodeURIComponent(id)}/decline`, { reason })
  return data
}

export async function cancelOrder(id: string): Promise<v1Order> {
  const { data } = await api.post<v1Order>(`/v1/orders/${encodeURIComponent(id)}/cancel`, {})
  return data
}
