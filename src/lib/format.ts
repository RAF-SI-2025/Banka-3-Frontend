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
