// Order rows carry only the security UUID — the backend Order proto
// doesn't denormalize the ticker. Rather than drag a ticker column
// through every list endpoint, callers batch-fetch the displayed
// security ids here. The TanStack `useQueries` keys re-use
// `keys.security.detail(id)` so any /trgovina detail page hit
// already populates the cache.

import { useQueries } from '@tanstack/react-query'
import { getSecurity } from '@/lib/api/securities'
import { keys } from '@/lib/query-keys'

export interface TickerLookup {
  /** ticker for a given security id, or null while loading / on error. */
  get: (securityId: string | undefined) => string | null
  /** ISO settlement date for a given security id, or null. */
  getSettlementDate: (securityId: string | undefined) => string | null
  /** true while any underlying query is fetching. */
  isFetching: boolean
}

export function useSecurityTickers(securityIds: ReadonlyArray<string | undefined>): TickerLookup {
  const unique = Array.from(
    new Set(securityIds.filter((id): id is string => Boolean(id))),
  )
  const results = useQueries({
    queries: unique.map((id) => ({
      queryKey: keys.security.detail(id),
      queryFn: () => getSecurity(id),
      // Tickers don't churn — keep them around for the session so
      // navigating between order list / portfolio / detail doesn't
      // refetch the same security ten times.
      staleTime: 5 * 60_000,
    })),
  })
  const tickers = new Map<string, string>()
  const settlements = new Map<string, string>()
  results.forEach((r, i) => {
    const ticker = r.data?.security?.ticker
    if (ticker) tickers.set(unique[i], ticker)
    const sd = r.data?.security?.settlementDate
    if (sd) settlements.set(unique[i], sd)
  })
  return {
    get: (id) => (id ? (tickers.get(id) ?? null) : null),
    getSettlementDate: (id) => (id ? (settlements.get(id) ?? null) : null),
    isFetching: results.some((r) => r.isFetching),
  }
}
