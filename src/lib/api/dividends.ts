import { api } from './client'
import type { v1DividendPayout } from './generated/models/v1DividendPayout'
import type { v1ListDividendPayoutsResponse } from './generated/models/v1ListDividendPayoutsResponse'
import type { bankaTradingV1UserKind } from './generated/models/bankaTradingV1UserKind'

export type DividendPayout = v1DividendPayout

export interface ListDividendsArgs {
  // securityId scopes the history to one position (S59).
  securityId?: string
  // Supervisor/admin view only — others see their own regardless.
  userId?: string
  userKind?: bankaTradingV1UserKind
}

// listDividends returns the caller's received-dividend history (todoSpec
// C3 S59), optionally scoped to one security for the per-position view.
export async function listDividends(
  args: ListDividendsArgs = {},
): Promise<v1ListDividendPayoutsResponse> {
  const { data } = await api.get<v1ListDividendPayoutsResponse>('/v1/dividends', { params: args })
  return data
}
