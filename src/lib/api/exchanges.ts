import { api } from './client'
import type { v1Exchange } from './generated/models/v1Exchange'
import type { v1ListExchangesResponse } from './generated/models/v1ListExchangesResponse'

export type Exchange = v1Exchange

export async function listExchanges(): Promise<v1ListExchangesResponse> {
  const { data } = await api.get<v1ListExchangesResponse>('/v1/exchanges')
  return data
}

// setExchangeOverride flips the spec p.39 testing toggle. Pass
// `open=true` to force-open or `open=false` to force-close; pass
// `null` to clear the override and fall back to the configured
// schedule. Backend gates this on Admin.
export async function setExchangeOverride(mic: string, open: boolean | null): Promise<v1Exchange> {
  const body = open === null ? { clear: true } : { open }
  const { data } = await api.patch<v1Exchange>(`/v1/exchanges/${encodeURIComponent(mic)}/override`, body)
  return data
}
