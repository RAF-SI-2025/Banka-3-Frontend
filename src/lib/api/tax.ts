import { api } from './client'
import type { v1TaxPosition } from './generated/models/v1TaxPosition'
import type { v1ListTaxPositionsResponse } from './generated/models/v1ListTaxPositionsResponse'
import type { v1ListRealizedPnLResponse } from './generated/models/v1ListRealizedPnLResponse'
import type { v1RealizedPnLRow } from './generated/models/v1RealizedPnLRow'
import type { v1RunTaxRequest } from './generated/models/v1RunTaxRequest'
import type { v1RunTaxResponse } from './generated/models/v1RunTaxResponse'
import type { bankaTradingV1UserKind } from './generated/models/bankaTradingV1UserKind'

export type TaxPosition = v1TaxPosition
export type RealizedPnLRow = v1RealizedPnLRow

export interface ListTaxPositionsArgs {
  userKind?: bankaTradingV1UserKind
  nameQuery?: string
}

// listTaxPositions returns the supervisor "Porez tracking" board
// (spec p.63). One row per trading-eligible user with unpaid +
// YTD-paid figures in RSD.
export async function listTaxPositions(args: ListTaxPositionsArgs = {}): Promise<v1ListTaxPositionsResponse> {
  const { data } = await api.get<v1ListTaxPositionsResponse>('/v1/tax/positions', { params: args })
  return data
}

export interface ListRealizedPnLArgs {
  userId?: string
  userKind?: bankaTradingV1UserKind
  from?: string
  to?: string
}

// listRealizedPnL returns one row per closing sell within
// [from, to] (RFC3339 timestamps). Used by the per-user tax detail
// page so supervisors can see which sales drove the unpaid total.
export async function listRealizedPnL(args: ListRealizedPnLArgs = {}): Promise<v1ListRealizedPnLResponse> {
  const { data } = await api.get<v1ListRealizedPnLResponse>('/v1/tax/realized', { params: args })
  return data
}

// runTaxJob debits 15% of unpaid realised-gain RSD from each affected
// user's sale account and credits the state's RSD account. With an
// empty body it runs for every user with non-zero unpaid tax; pass
// userId/userKind to scope to one. Supervisor + admin only.
export async function runTaxJob(req: v1RunTaxRequest = {}): Promise<v1RunTaxResponse> {
  const { data } = await api.post<v1RunTaxResponse>('/v1/tax/run', req)
  return data
}
