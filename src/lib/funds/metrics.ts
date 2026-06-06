// Fund performance statistics computed client-side from the
// GetFundPerformance snapshot series (todoSpec S73–S77). The backend
// writes one fund_performance_snapshot row daily (total_value_rsd);
// the FE turns that time series into four risk/return metrics.
//
// Assumptions:
//  - Risk-free rate is 0, so the reward-to-variability (Sharpe) ratio
//    is simply annualReturn / volatility. Documented here rather than
//    fetching a policy rate the backend doesn't expose.
//  - "Periodic" returns are per-snapshot (the cron cadence is daily);
//    we annualize with PERIODS_PER_YEAR = 252 trading days, falling
//    back to a span-based annualization for the total return.
//  - A series with fewer than MIN_SNAPSHOTS points yields `null`
//    metrics (S74: render "—" / "nedostupno", never garbage).

export const MIN_SNAPSHOTS = 3
const PERIODS_PER_YEAR = 252
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000

export interface FundSnapshotPoint {
  /** ISO timestamp of the snapshot. */
  t: string
  /** total fund value in RSD at that instant. */
  value: number
}

export interface FundMetrics {
  /** Annualized return as a fraction (0.12 = +12%/yr), or null if insufficient/undefined. */
  annualReturn: number | null
  /** Annualized stddev of periodic returns as a fraction, or null. */
  volatility: number | null
  /** Reward-to-variability (Sharpe, rf=0) = annualReturn / volatility, or null. */
  sharpe: number | null
  /** Max peak-to-trough decline as a non-negative fraction (0.2 = -20%), or null. */
  maxDrawdown: number | null
  /** True when the series is too short / unusable to compute metrics. */
  insufficient: boolean
}

const UNAVAILABLE: FundMetrics = {
  annualReturn: null,
  volatility: null,
  sharpe: null,
  maxDrawdown: null,
  insufficient: true,
}

/**
 * Normalize a raw snapshot list (in any order, with string values) into
 * an ascending-by-time numeric series. Drops non-finite / non-positive
 * values (a 0 value would blow up ratio math and never happens for a
 * live fund's total value).
 */
export function toSeries(
  rows: ReadonlyArray<{ snapshotAt?: string; totalValueRsd?: string }>,
): FundSnapshotPoint[] {
  return rows
    .map((r) => ({ t: r.snapshotAt ?? '', value: Number(r.totalValueRsd ?? 'NaN') }))
    .filter((p) => p.t !== '' && Number.isFinite(p.value) && p.value > 0)
    .sort((a, b) => Date.parse(a.t) - Date.parse(b.t))
}

/** Simple (arithmetic) returns between consecutive points: r_i = v_i/v_{i-1} - 1. */
function periodicReturns(values: number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < values.length; i++) {
    out.push(values[i] / values[i - 1] - 1)
  }
  return out
}

/** Population stddev (we treat the snapshot history as the full sample of the period). */
function stddev(xs: number[]): number {
  if (xs.length === 0) return 0
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length
  return Math.sqrt(variance)
}

/**
 * Max drawdown over the value series, as a non-negative fraction. Walks
 * the running peak and tracks the deepest decline from any peak.
 */
export function maxDrawdown(values: number[]): number {
  let peak = values[0] ?? 0
  let worst = 0
  for (const v of values) {
    if (v > peak) peak = v
    if (peak > 0) {
      const dd = (peak - v) / peak
      if (dd > worst) worst = dd
    }
  }
  return worst
}

/**
 * Annualized total return from first to last point. Uses the actual
 * elapsed wall-clock span (compounded) so an irregular cron cadence
 * still annualizes correctly. Returns null when the span is degenerate.
 */
export function annualizedReturn(series: FundSnapshotPoint[]): number | null {
  const first = series[0]
  const last = series[series.length - 1]
  if (!first || !last || first.value <= 0) return null
  const spanMs = Date.parse(last.t) - Date.parse(first.t)
  if (!Number.isFinite(spanMs) || spanMs <= 0) return null
  const years = spanMs / MS_PER_YEAR
  const totalGrowth = last.value / first.value
  return totalGrowth ** (1 / years) - 1
}

/** Annualized volatility = stddev(periodic returns) * sqrt(PERIODS_PER_YEAR). */
export function annualizedVolatility(values: number[]): number {
  return stddev(periodicReturns(values)) * Math.sqrt(PERIODS_PER_YEAR)
}

/**
 * Compute all four fund metrics from a snapshot series. Returns the
 * UNAVAILABLE sentinel (insufficient=true, all-null) when there are
 * fewer than MIN_SNAPSHOTS usable points (S74).
 */
export function computeFundMetrics(series: FundSnapshotPoint[]): FundMetrics {
  if (series.length < MIN_SNAPSHOTS) return UNAVAILABLE
  const values = series.map((p) => p.value)

  const annualReturn = annualizedReturn(series)
  const volatility = annualizedVolatility(values)
  // Sharpe is undefined when volatility is ~0 (a perfectly flat fund);
  // report null rather than Infinity/NaN.
  const sharpe =
    annualReturn != null && volatility > 1e-9 ? annualReturn / volatility : null

  return {
    annualReturn,
    volatility,
    sharpe,
    maxDrawdown: maxDrawdown(values),
    insufficient: false,
  }
}

/** Convenience: compute metrics directly from raw snapshot rows. */
export function metricsFromSnapshots(
  rows: ReadonlyArray<{ snapshotAt?: string; totalValueRsd?: string }>,
): FundMetrics {
  return computeFundMetrics(toSeries(rows))
}
