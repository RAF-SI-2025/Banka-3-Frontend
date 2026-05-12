// Spec p.69 colour cues on the OTC threads page:
//   |Δ| ≤ 5%  → green   (offer near market)
//   5% < |Δ| ≤ 20% → yellow (caution)
//   > 20%    → red     (far from market)
// Returns null when the inputs can't form a meaningful comparison (no
// reference, zero reference, non-numeric inputs) so callers can render
// a neutral row.

export type DeviationLevel = 'green' | 'yellow' | 'red'

export function deviationLevel(
  pricePerUnit: string | number | undefined,
  reference: string | number | undefined,
): DeviationLevel | null {
  const p = typeof pricePerUnit === 'string' ? Number(pricePerUnit) : pricePerUnit
  const r = typeof reference === 'string' ? Number(reference) : reference
  if (!Number.isFinite(p) || !Number.isFinite(r) || r === 0) return null
  const d = Math.abs(((p as number) - (r as number)) / (r as number))
  if (d <= 0.05) return 'green'
  if (d <= 0.2) return 'yellow'
  return 'red'
}

export const deviationClass: Record<DeviationLevel, string> = {
  green: 'text-emerald-600',
  yellow: 'text-amber-600',
  red: 'text-rose-600',
}
