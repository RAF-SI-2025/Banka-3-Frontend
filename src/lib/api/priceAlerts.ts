import { api } from './client'

// Price alerts (todoSpec C3 S26-S29). The backend's OpenAPI models are
// not regenerated for this feature batch, so the wire shapes are typed
// locally here — they mirror the grpc-gateway camelCase JSON 1:1.

export type PriceAlertCondition =
  | 'PRICE_ALERT_CONDITION_ABOVE'
  | 'PRICE_ALERT_CONDITION_BELOW'

export interface PriceAlert {
  id: string
  userId: string
  userKind?: string
  securityId: string
  threshold: string
  condition: PriceAlertCondition
  isActive: boolean
  createdAt?: string
  triggeredAt?: string
}

export interface ListPriceAlertsResponse {
  alerts?: PriceAlert[]
}

export interface CreatePriceAlertBody {
  securityId: string
  threshold: string
  condition: PriceAlertCondition
}

export async function listPriceAlerts(): Promise<ListPriceAlertsResponse> {
  const { data } = await api.get<ListPriceAlertsResponse>('/v1/price-alerts')
  return data
}

export async function createPriceAlert(body: CreatePriceAlertBody): Promise<PriceAlert> {
  const { data } = await api.post<PriceAlert>('/v1/price-alerts', body)
  return data
}

export async function deletePriceAlert(id: string): Promise<void> {
  await api.delete(`/v1/price-alerts/${encodeURIComponent(id)}`)
}
