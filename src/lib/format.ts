// Money formatting per spec: thousands separator '.', decimal ','. Two
// decimals always. Currency code follows the amount with a single space.
//
//   formatMoney("180000.00", "RSD") → "180.000,00 RSD"

import type { bankaBankV1Currency } from './api/generated/models/bankaBankV1Currency'

export function formatMoney(amount: string | number | undefined, currency?: string): string {
  if (amount === undefined || amount === null || amount === '') return '—'
  const n = typeof amount === 'string' ? Number(amount) : amount
  if (!Number.isFinite(n)) return String(amount)
  const fixed = n.toFixed(2)
  const [intPart, fracPart] = fixed.split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return currency ? `${grouped},${fracPart} ${currencyLabel(currency)}` : `${grouped},${fracPart}`
}

// formatRate renders an FX rate trimmed to 2 decimal places. The
// backend may emit "117.4523" or "1.0000" depending on which leg of
// the conversion produced it; the menjačnica UI just needs a
// human-readable kurs.
export function formatRate(rate: string | number | undefined): string {
  if (rate === undefined || rate === null || rate === '') return '—'
  const n = typeof rate === 'string' ? Number(rate) : rate
  if (!Number.isFinite(n)) return String(rate)
  return n.toFixed(2)
}

// compactRsd renders an RSD amount for chart axes/labels where the
// grouped form from formatMoney would overflow: 1.2M / 850k / 1.234.
// Sign is preserved so loss bars read as negative.
export function compactRsd(v: number): string {
  if (!Number.isFinite(v)) return '0'
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`
  if (abs >= 1_000) return `${(v / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`
  return v.toFixed(0)
}

export function currencyLabel(c: string | bankaBankV1Currency): string {
  // Strip CURRENCY_ prefix; UNSPECIFIED → empty.
  if (!c) return ''
  const s = String(c)
  if (s === 'CURRENCY_UNSPECIFIED') return ''
  return s.startsWith('CURRENCY_') ? s.slice('CURRENCY_'.length) : s
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const date = formatDate(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${date} ${hh}:${min}`
}

// Mask the full account number (18 digits) into the readable
// XXX-FFFF-NNNNNNNNN-TT layout used in the spec screenshots.
export function formatAccountNumber(n: string | undefined): string {
  if (!n) return '—'
  if (n.length !== 18) return n
  return `${n.slice(0, 3)}-${n.slice(3, 7)}-${n.slice(7, 16)}-${n.slice(16, 18)}`
}

// formatCardNumber renders a PAN in the standard four-by-four layout
// regardless of whether the backend sent a raw 16-digit number (which
// employees see) or the already-masked client form ("4111********1111"
// per spec p.29 / pkg/card.Mask). Stars are passed through unchanged
// so the masking is preserved.
//
//   "4111111111111111"  → "4111 1111 1111 1111"
//   "4111********1111"  → "4111 **** **** 1111"
//   "****1234"          → "****1234"  (notification short form, untouched)
//
// The fall-through "leave unchanged" branch keeps the function safe to
// drop into existing render sites without exhaustive enumeration of
// what the API might emit in future.
export function formatCardNumber(n: string | undefined): string {
  if (!n) return '—'
  // Spec form is exactly 16 chars; anything else (incl. the 8-char
  // notification short form `****1234`) we render verbatim so we don't
  // misalign a non-PAN string.
  if (n.length !== 16) return n
  return `${n.slice(0, 4)} ${n.slice(4, 8)} ${n.slice(8, 12)} ${n.slice(12, 16)}`
}
