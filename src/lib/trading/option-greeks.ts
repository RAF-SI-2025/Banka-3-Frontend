// Spec p.59 option-chain table needs a Theta column. The backend
// stores premium + IV + open_interest per option but no Greeks
// (this app has no live market data feed — option metadata is
// seeded), so we compute Theta on the client from Black-Scholes.
//
// Bid/Ask aren't stored either (no options order book); the chain
// shows them as a fixed half-spread around premium with a comment
// at the call site explaining the placeholder. Volume similarly
// has no source — rendered as "—".

const SQRT_2PI = Math.sqrt(2 * Math.PI)

function normPdf(x: number): number {
  return Math.exp(-(x * x) / 2) / SQRT_2PI
}

// Abramowitz & Stegun 7.1.26 approximation of the standard-normal
// CDF — accurate to ~1e-7, plenty for a chain display.
function normCdf(x: number): number {
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x) / Math.sqrt(2)
  const t = 1 / (1 + p * ax)
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-ax * ax)
  return 0.5 * (1 + sign * y)
}

export interface ThetaArgs {
  /** Underlying spot price. */
  underlying: number
  /** Option strike. */
  strike: number
  /** Calendar days until settlement. Must be > 0. */
  daysToExpiry: number
  /** Annualised implied volatility, e.g. 0.25 for 25%. Must be > 0. */
  iv: number
  /** Annualised risk-free rate. Defaults to 0.04 (close enough for a demo). */
  riskFreeRate?: number
  optionType: 'call' | 'put'
}

/**
 * Returns per-day Black-Scholes Theta for the given option, or null
 * if any input is invalid (zero/negative price, IV, or days-to-expiry).
 */
export function blackScholesTheta(args: ThetaArgs): number | null {
  const {
    underlying: S,
    strike: K,
    daysToExpiry,
    iv: sigma,
    riskFreeRate = 0.04,
    optionType,
  } = args
  if (
    !Number.isFinite(S) ||
    !Number.isFinite(K) ||
    !Number.isFinite(daysToExpiry) ||
    !Number.isFinite(sigma) ||
    S <= 0 ||
    K <= 0 ||
    daysToExpiry <= 0 ||
    sigma <= 0
  ) {
    return null
  }
  const T = daysToExpiry / 365
  const r = riskFreeRate
  const sqrtT = Math.sqrt(T)
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT)
  const d2 = d1 - sigma * sqrtT
  const annual =
    optionType === 'call'
      ? -(S * sigma * normPdf(d1)) / (2 * sqrtT) - r * K * Math.exp(-r * T) * normCdf(d2)
      : -(S * sigma * normPdf(d1)) / (2 * sqrtT) + r * K * Math.exp(-r * T) * normCdf(-d2)
  return annual / 365
}

/** Days between now and an ISO timestamp; floor at 0. */
export function daysUntil(iso: string | undefined): number {
  if (!iso) return 0
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return 0
  const ms = t - Date.now()
  return Math.max(0, ms / 86_400_000)
}
