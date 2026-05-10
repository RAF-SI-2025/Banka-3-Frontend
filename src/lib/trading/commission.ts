// Spec p.55-56 commission caps. The percentage applies to the
// approximate trade value; the cap is in USD-equivalent and the
// caller converts to the listing currency at zero-commission rate.
//
//   market:               min(14% × approx, $7-eq)
//   limit / stop-limit:   min(24% × approx, $12-eq)
//   stop:                 same as market once triggered
//
// We expose them as plain constants; conversion lives at the call
// site so this module stays free of network deps and is testable as
// a pure unit.

import { v1OrderType } from '@/lib/api/generated/models/v1OrderType'

export interface CommissionRule {
  pct: number
  capUsd: number
}

export const COMMISSION_RULES: Record<v1OrderType, CommissionRule> = {
  [v1OrderType.ORDER_TYPE_UNSPECIFIED]: { pct: 0, capUsd: 0 },
  [v1OrderType.ORDER_TYPE_MARKET]: { pct: 0.14, capUsd: 7 },
  [v1OrderType.ORDER_TYPE_STOP]: { pct: 0.14, capUsd: 7 },
  [v1OrderType.ORDER_TYPE_LIMIT]: { pct: 0.24, capUsd: 12 },
  [v1OrderType.ORDER_TYPE_STOP_LIMIT]: { pct: 0.24, capUsd: 12 },
}

// computeCommission returns the commission in the listing currency.
// approx is the trade's notional (qty × contract_size × price). usdInListingCcy
// is the result of quoting 1 USD → listing currency at zero-commission;
// caller is responsible for fetching it (banking quote endpoint).
export function computeCommission(
  type: v1OrderType,
  approx: number,
  usdInListingCcy: number,
): number {
  const rule = COMMISSION_RULES[type]
  const pctFee = approx * rule.pct
  const capInListingCcy = rule.capUsd * usdInListingCcy
  return Math.min(pctFee, capInListingCcy)
}

// pricePerUnitForType powers the order-form approx-cost preview. Spec
// p.52: STOP converts to MARKET on trigger, so the *expected* fill
// price is the market price (ask for buy, bid for sell) — the stop is
// only the trigger threshold and using it would mislead users when ask
// diverges from stop. STOP_LIMIT keeps the limit price since it
// converts to LIMIT on trigger.
export function pricePerUnitForType(
  type: v1OrderType,
  side: 'buy' | 'sell',
  listing: { price?: string; ask?: string; bid?: string },
  limitPrice?: string,
): number | null {
  const num = (s?: string) => (s && s.trim() !== '' ? Number(s) : null)
  const marketPpu = side === 'buy' ? num(listing.ask) ?? num(listing.price) : num(listing.bid) ?? num(listing.price)
  switch (type) {
    case v1OrderType.ORDER_TYPE_MARKET:
    case v1OrderType.ORDER_TYPE_STOP:
      return marketPpu
    case v1OrderType.ORDER_TYPE_LIMIT:
    case v1OrderType.ORDER_TYPE_STOP_LIMIT:
      return num(limitPrice)
    default:
      return null
  }
}
