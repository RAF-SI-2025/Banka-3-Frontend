import { api } from './client'
import type { v1Holding } from './generated/models/v1Holding'
import type { v1ListHoldingsResponse } from './generated/models/v1ListHoldingsResponse'
import type { v1ExerciseOptionResponse } from './generated/models/v1ExerciseOptionResponse'
import type { v1SecurityType } from './generated/models/v1SecurityType'
import type { bankaTradingV1UserKind } from './generated/models/bankaTradingV1UserKind'

export type Holding = v1Holding

export interface ListHoldingsArgs {
  // Supervisor view only — clients/agents see their own regardless.
  userId?: string
  userKind?: bankaTradingV1UserKind
  type?: v1SecurityType
}

export async function listHoldings(args: ListHoldingsArgs = {}): Promise<v1ListHoldingsResponse> {
  const { data } = await api.get<v1ListHoldingsResponse>('/v1/portfolio', { params: args })
  return data
}

// setPublicCount marks how many of a stock holding are visible on
// the c4 OTC portal. Init 0 — c3 doesn't need this UI but the wrapper
// is here so c4 doesn't need a re-cut of the wrapper file.
export async function setPublicCount(holdingId: string, publicCount: number): Promise<v1Holding> {
  const { data } = await api.patch<v1Holding>(
    `/v1/portfolio/${encodeURIComponent(holdingId)}/public-count`,
    { publicCount },
  )
  return data
}

// exerciseOption fires the spec p.61.d "iskoristi opciju" action.
// Returns the updated option + underlying holdings and (PUT only) the
// realized gain on the underlying shares sold at strike.
export async function exerciseOption(
  holdingId: string,
  quantity: number,
): Promise<v1ExerciseOptionResponse> {
  const { data } = await api.post<v1ExerciseOptionResponse>(
    `/v1/portfolio/${encodeURIComponent(holdingId)}/exercise`,
    { quantity },
  )
  return data
}
