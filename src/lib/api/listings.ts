import { api } from './client'
import type { v1Listing } from './generated/models/v1Listing'
import type { v1ListListingsResponse } from './generated/models/v1ListListingsResponse'
import type { v1GetListingDailyHistoryResponse } from './generated/models/v1GetListingDailyHistoryResponse'
import type { v1UpsertListingRequest } from './generated/models/v1UpsertListingRequest'
import type { v1SecurityType } from './generated/models/v1SecurityType'

export type Listing = v1Listing

export interface ListListingsArgs {
  type?: v1SecurityType
  exchangeMic?: string
  search?: string
  // "price" / "volume" / "maintenance_margin"
  sortBy?: string
  sortDesc?: boolean
  page?: number
  pageSize?: number
}

export async function listListings(args: ListListingsArgs = {}): Promise<v1ListListingsResponse> {
  const { data } = await api.get<v1ListListingsResponse>('/v1/listings', { params: args })
  return data
}

export async function getListing(id: string): Promise<v1Listing> {
  const { data } = await api.get<v1Listing>(`/v1/listings/${encodeURIComponent(id)}`)
  return data
}

export interface ListingHistoryArgs {
  // ISO date strings (YYYY-MM-DD) — backend exposes from/to as
  // open intervals, both optional.
  from?: string
  to?: string
}

export async function getListingHistory(
  listingId: string,
  args: ListingHistoryArgs = {},
): Promise<v1GetListingDailyHistoryResponse> {
  const { data } = await api.get<v1GetListingDailyHistoryResponse>(
    `/v1/listings/${encodeURIComponent(listingId)}/history`,
    { params: args },
  )
  return data
}

// upsertListing covers spec p.37 "ručna validacija i korekcija
// podataka" — admin-only override of price/ask/bid. Backend gates
// on Admin; no verification per the c3 verification scope.
export async function upsertListing(body: v1UpsertListingRequest): Promise<v1Listing> {
  const { data } = await api.put<v1Listing>('/v1/listings', body)
  return data
}
