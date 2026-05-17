// Unrealized P&L helpers. Backend computes profit/marketValue
// server-side on the Holding row, but we still need a percent for
// the UI and a tiny formatter that handles zero-quantity edges.

export interface PnLInputs {
  quantity?: number
  weightedAvgPrice?: string
  currentPrice?: string
  // marketValue and profit are server-computed; we recompute when
  // missing for safety.
  profit?: string
}

export function unrealizedPnL(h: PnLInputs): { abs: number; pct: number | null } {
  const qty = h.quantity ?? 0
  const cost = Number(h.weightedAvgPrice ?? '0')
  const cur = Number(h.currentPrice ?? '0')
  if (qty <= 0) return { abs: 0, pct: null }
  const abs = h.profit !== undefined ? Number(h.profit) : (cur - cost) * qty
  // Percent is per-unit so it's contractSize-agnostic; the server-side
  // `profit` for futures/options already includes contract multiplier,
  // so dividing it by cost*qty would inflate the ratio by contractSize.
  const pct = cost > 0 ? ((cur - cost) / cost) * 100 : null
  return { abs, pct }
}
