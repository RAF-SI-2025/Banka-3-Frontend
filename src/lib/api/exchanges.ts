import { api } from './client'
import type { v1Exchange } from './generated/models/v1Exchange'
import type { v1ListExchangesResponse } from './generated/models/v1ListExchangesResponse'

export type Exchange = v1Exchange

// ExchangeOverrideState mirrors the backend enum
// (services/trading/internal/domain/domain.go). null clears.
export type ExchangeOverrideState = 'open' | 'closed' | 'after_hours'

export async function listExchanges(): Promise<v1ListExchangesResponse> {
  const { data } = await api.get<v1ListExchangesResponse>('/v1/exchanges')
  return data
}

// setExchangeOverride flips the spec p.39 testing toggle. Pass a state
// to force-open / force-closed / force-after-hours; pass `null` to
// clear the override and fall back to the configured schedule. The
// after-hours mode forces is_open=false + is_after_hours=true at any
// wall-clock so admins can drive the spec p.56 cadence path during
// testing. Backend gates this on Admin.
export async function setExchangeOverride(
  mic: string,
  state: ExchangeOverrideState | null,
): Promise<v1Exchange> {
  const body = { state: state ?? '' }
  const { data } = await api.patch<v1Exchange>(`/v1/exchanges/${encodeURIComponent(mic)}/override`, body)
  return data
}
