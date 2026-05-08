import { describe, expect, it } from 'vitest'
import { formatMoney, currencyLabel, formatDate, formatDateTime, formatAccountNumber } from './format'

describe('formatMoney', () => {
  it('renders Serbian thousands and decimal separators', () => {
    // 180000.00 → "180.000,00"
    expect(formatMoney('180000', 'RSD')).toBe('180.000,00 RSD')
  })

  it('always renders two decimals', () => {
    expect(formatMoney('5')).toBe('5,00')
    expect(formatMoney('5.5')).toBe('5,50')
    // toFixed(2) rounds: 5.556 → "5.56" deterministically (5.555 is
    // float-imprecise, so we pick a value that rounds cleanly).
    expect(formatMoney('5.556')).toBe('5,56')
  })

  it('handles negative amounts', () => {
    expect(formatMoney('-1234.5', 'EUR')).toBe('-1.234,50 EUR')
  })

  it('em-dashes when amount is missing or empty', () => {
    expect(formatMoney(undefined)).toBe('—')
    expect(formatMoney('')).toBe('—')
  })

  it('strips the CURRENCY_ prefix off enum values', () => {
    expect(formatMoney('100', 'CURRENCY_USD')).toBe('100,00 USD')
  })

  it('omits the currency token when not provided', () => {
    expect(formatMoney('1000')).toBe('1.000,00')
  })
})

describe('currencyLabel', () => {
  it('strips CURRENCY_ prefix', () => {
    expect(currencyLabel('CURRENCY_RSD')).toBe('RSD')
    expect(currencyLabel('CURRENCY_EUR')).toBe('EUR')
  })

  it('returns empty string for unspecified', () => {
    expect(currencyLabel('CURRENCY_UNSPECIFIED')).toBe('')
    expect(currencyLabel('')).toBe('')
  })
})

describe('formatDate', () => {
  it('renders DD.MM.YYYY for ISO timestamps', () => {
    expect(formatDate('2026-05-08T10:30:00Z')).toMatch(/^\d{2}\.\d{2}\.2026$/)
  })

  it('handles plain dates', () => {
    expect(formatDate('2026-05-08')).toMatch(/^\d{2}\.\d{2}\.2026$/)
  })

  it('em-dashes when missing', () => {
    expect(formatDate(undefined)).toBe('—')
  })
})

describe('formatDateTime', () => {
  it('appends HH:MM after the date', () => {
    const out = formatDateTime('2026-05-08T10:30:00')
    // We can't assert the exact local-time output because it depends on
    // the host's TZ, but the shape must include HH:MM.
    expect(out).toMatch(/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/)
  })
})

describe('formatAccountNumber', () => {
  it('formats a canonical 18-digit number into BBB-FFFF-NNNNNNNNN-TT', () => {
    // 3 + 4 + 9 + 2 = 18
    const n = '265' + '0001' + '123456789' + '10'
    expect(n.length).toBe(18)
    expect(formatAccountNumber(n)).toBe('265-0001-123456789-10')
  })

  it('returns the raw string if length is wrong', () => {
    expect(formatAccountNumber('1234')).toBe('1234')
    // 21 chars (over-long) — leave as-is rather than mangle.
    const tooLong = '265000100000123456710'
    expect(formatAccountNumber(tooLong)).toBe(tooLong)
  })

  it('em-dashes when missing', () => {
    expect(formatAccountNumber(undefined)).toBe('—')
  })
})
