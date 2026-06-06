import { api } from './client'
import { v1SecurityType } from '@/lib/api/generated/models/v1SecurityType'

// Watchlists (todoSpec C3 S35-S39). The backend's OpenAPI models are not
// regenerated for this feature batch, so the wire shapes are typed
// locally here — they mirror the grpc-gateway camelCase JSON 1:1.

export interface WatchlistItem {
  id: string
  securityId: string
  createdAt?: string
  // Decorated server-side from the security + its listing so the list
  // view can render the price + daily change (S35) and filter by type
  // (S39) without extra round-trips. Empty when unresolved.
  ticker?: string
  name?: string
  securityType?: v1SecurityType
  currency?: string
  price?: string
  dailyChange?: string
}

export interface Watchlist {
  id: string
  userId?: string
  userKind?: string
  name: string
  createdAt?: string
  items?: WatchlistItem[]
}

export interface ListWatchlistsResponse {
  watchlists?: Watchlist[]
}

export async function listWatchlists(): Promise<ListWatchlistsResponse> {
  const { data } = await api.get<ListWatchlistsResponse>('/v1/watchlists')
  return data
}

export async function createWatchlist(name: string): Promise<Watchlist> {
  const { data } = await api.post<Watchlist>('/v1/watchlists', { name })
  return data
}

export async function deleteWatchlist(id: string): Promise<void> {
  await api.delete(`/v1/watchlists/${encodeURIComponent(id)}`)
}

export async function addToWatchlist(watchlistId: string, securityId: string): Promise<WatchlistItem> {
  const { data } = await api.post<WatchlistItem>(
    `/v1/watchlists/${encodeURIComponent(watchlistId)}/items`,
    { securityId },
  )
  return data
}

export async function removeFromWatchlist(watchlistId: string, securityId: string): Promise<void> {
  await api.delete(
    `/v1/watchlists/${encodeURIComponent(watchlistId)}/items/${encodeURIComponent(securityId)}`,
  )
}
