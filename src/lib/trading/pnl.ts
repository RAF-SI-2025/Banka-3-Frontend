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
  const denom = cost * qty
  const pct = denom > 0 ? (abs / denom) * 100 : null
  return { abs, pct }
}
