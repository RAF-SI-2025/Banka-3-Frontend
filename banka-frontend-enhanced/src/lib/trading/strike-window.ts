// Spec p.59: option chain renders N strike rows above + N below the
// at-the-money row (the one whose strike is closest to sharedPrice).
// Mirrors the backend's filterStrikeWindow in services/trading/internal/
// service/securities.go — kept here too because the chain endpoint
// doesn't accept a window query param yet, so the slice happens FE-side.
//
// `window` semantics:
//   - null / undefined / <= 0 → return rows unchanged
//   - N > 0 → up to N rows below + the row whose strike is closest to
//             sharedPrice + up to N rows above (so the visible total is
//             at most 2N+1)
//
// `sharedPrice` null → no anchor; return rows unchanged.

export interface StrikeRow {
  strikePrice?: string
}

export function applyStrikeWindow<T extends StrikeRow>(
  rows: readonly T[],
  sharedPrice: number | null,
  window: number | null,
): T[] {
  if (window == null || window <= 0 || sharedPrice == null) {
    return [...rows]
  }
  const parsed = rows
    .map((row, idx) => {
      const n = Number(row.strikePrice ?? '')
      return { row, idx, strike: Number.isFinite(n) ? n : null }
    })
    .filter((r): r is { row: T; idx: number; strike: number } => r.strike !== null)

  if (parsed.length === 0) return [...rows]

  // closest-to-shared row, ties broken by lower index for stability
  let anchorIdx = 0
  let anchorDist = Math.abs(parsed[0].strike - sharedPrice)
  for (let i = 1; i < parsed.length; i++) {
    const d = Math.abs(parsed[i].strike - sharedPrice)
    if (d < anchorDist) {
      anchorIdx = i
      anchorDist = d
    }
  }

  // Sort by strike ascending so "above/below" is positional in strike
  // space, not in the source order.
  const sorted = [...parsed].sort((a, b) => a.strike - b.strike)
  const anchorRow = parsed[anchorIdx].row
  const anchorInSorted = sorted.findIndex((r) => r.row === anchorRow)

  const start = Math.max(0, anchorInSorted - window)
  const end = Math.min(sorted.length, anchorInSorted + window + 1)
  return sorted.slice(start, end).map((r) => r.row)
}
