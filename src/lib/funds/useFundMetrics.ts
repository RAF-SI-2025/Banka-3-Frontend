// Batch-fetches each fund's performance snapshot history and computes
// the four discovery statistics (todoSpec S73–S77) client-side. The
// GetFundPerformance endpoint already exposes the daily total_value_rsd
// series, so no backend change is needed — the math lives in
// `metrics.ts` and is unit-tested there.

import { useQueries } from '@tanstack/react-query'
import { getFundPerformance } from '@/lib/api/funds'
import { keys } from '@/lib/query-keys'
import { metricsFromSnapshots, type FundMetrics } from './metrics'

const UNAVAILABLE: FundMetrics = {
  annualReturn: null,
  volatility: null,
  sharpe: null,
  maxDrawdown: null,
  insufficient: true,
}

export interface FundMetricsLookup {
  /** Metrics for a fund id; unavailable (insufficient=true) while loading or on error. */
  get: (fundId: string | undefined) => FundMetrics
  /** True while any underlying performance query is still fetching. */
  isFetching: boolean
}

export function useFundMetrics(
  fundIds: ReadonlyArray<string | undefined>,
  days = 365,
): FundMetricsLookup {
  const unique = Array.from(new Set(fundIds.filter((id): id is string => Boolean(id))))
  const results = useQueries({
    queries: unique.map((id) => ({
      queryKey: keys.funds.performance(id, days),
      queryFn: () => getFundPerformance(id, days),
      // Snapshots roll once a day; keep them warm so the detail page
      // hit reuses the discovery fetch and vice versa.
      staleTime: 5 * 60_000,
    })),
  })

  const byId = new Map<string, FundMetrics>()
  results.forEach((r, i) => {
    byId.set(unique[i], r.data ? metricsFromSnapshots(r.data.snapshots ?? []) : UNAVAILABLE)
  })

  return {
    get: (fundId) => (fundId ? (byId.get(fundId) ?? UNAVAILABLE) : UNAVAILABLE),
    isFetching: results.some((r) => r.isFetching),
  }
}
