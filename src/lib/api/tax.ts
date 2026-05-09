import { api } from './client'
import type { v1TaxPosition } from './generated/models/v1TaxPosition'
import type { v1ListTaxPositionsResponse } from './generated/models/v1ListTaxPositionsResponse'
import type { v1RunTaxRequest } from './generated/models/v1RunTaxRequest'
import type { v1RunTaxResponse } from './generated/models/v1RunTaxResponse'
import type { bankaTradingV1UserKind } from './generated/models/bankaTradingV1UserKind'

export type TaxPosition = v1TaxPosition

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

// runTaxJob debits 15% of unpaid realised-gain RSD from each affected
// user's sale account and credits the state's RSD account. With an
// empty body it runs for every user with non-zero unpaid tax; pass
// userId/userKind to scope to one. Supervisor + admin only.
export async function runTaxJob(req: v1RunTaxRequest = {}): Promise<v1RunTaxResponse> {
  const { data } = await api.post<v1RunTaxResponse>('/v1/tax/run', req)
  return data
}
