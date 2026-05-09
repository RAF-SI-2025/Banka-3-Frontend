import { api } from './client'
import type { v1Security } from './generated/models/v1Security'
import type { v1SecurityWithListing } from './generated/models/v1SecurityWithListing'
import type { v1ListSecuritiesResponse } from './generated/models/v1ListSecuritiesResponse'
import type { v1GetOptionChainResponse } from './generated/models/v1GetOptionChainResponse'
import type { v1UpsertSecurityRequest } from './generated/models/v1UpsertSecurityRequest'
import type { v1SecurityType } from './generated/models/v1SecurityType'

export type Security = v1Security
export type SecurityWithListing = v1SecurityWithListing

export interface ListSecuritiesArgs {
  type?: v1SecurityType
  search?: string
  exchangeMic?: string
  minPrice?: string
  maxPrice?: string
  minAsk?: string
  maxAsk?: string
  minBid?: string
  maxBid?: string
  minVolume?: string
  maxVolume?: string
  // ISO YYYY-MM-DD; only meaningful for futures + options
  minSettlement?: string
  maxSettlement?: string
  // "price" / "volume" / "maintenance_margin"
  sortBy?: string
  sortDesc?: boolean
  page?: number
  pageSize?: number
}

export async function listSecurities(args: ListSecuritiesArgs = {}): Promise<v1ListSecuritiesResponse> {
  const { data } = await api.get<v1ListSecuritiesResponse>('/v1/securities', { params: args })
  return data
}

export async function getSecurity(id: string): Promise<v1SecurityWithListing> {
  const { data } = await api.get<v1SecurityWithListing>(`/v1/securities/${encodeURIComponent(id)}`)
  return data
}

// upsertSecurity is Admin-only (catalog management). Mostly used by
// seed scripts; exposed here so the FE can render an admin form if
// the spec ever grows one.
export async function upsertSecurity(body: v1UpsertSecurityRequest): Promise<v1Security> {
  const { data } = await api.put<v1Security>('/v1/securities', body)
  return data
}

export interface OptionChainArgs {
  // ISO YYYY-MM-DD; selects the settlement-date row group from the
  // top six dates per backend issue 4.
  settlementDate?: string
  // Number of strikes above + below the at-the-money strike.
  // Backend default per spec p.59 is 5.
  strikesWindow?: number
}

// getOptionChain returns groups keyed by settlementDate; the FE
// renders one group at a time but receives them all so it can drive
// the settlement-date picker without a second round-trip.
export async function getOptionChain(
  stockId: string,
  args: OptionChainArgs = {},
): Promise<v1GetOptionChainResponse> {
  const { data } = await api.get<v1GetOptionChainResponse>(
    `/v1/securities/${encodeURIComponent(stockId)}/option-chain`,
    { params: args },
  )
  return data
}
