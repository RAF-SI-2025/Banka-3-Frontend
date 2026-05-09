import { describe, expect, it } from 'vitest'
import {
  validateAccountNumber,
  isValidAccountNumber,
  normalizeAccountNumber,
  ACCOUNT_NUMBER_LENGTH,
} from './account-number'

// Build a valid 17-digit head and append the digit that brings the
// sum-mod-11 to zero. Used to construct test fixtures that don't have
// to be hand-counted.
function withChecksum(head17: string): string {
  if (head17.length !== 17) throw new Error('head must be 17 digits')
  let sum = 0
  for (const c of head17) sum += c.charCodeAt(0) - 0x30
  const last = (11 - (sum % 11)) % 11
  if (last >= 10) {
    // Re-roll: bump the head by one and try again. Prevents the rare
    // case where the natural last digit is 10 (which can't fit in one
    // digit). Tests below never hit this path.
    return withChecksum(String(BigInt(head17) + 1n).padStart(17, '0'))
  }
  return head17 + String(last)
}

describe('validateAccountNumber', () => {
  it('accepts a number whose digits sum to a multiple of 11', () => {
    // BBB=333, FFFF=0001, body=000000001, TT=11 → digits sum to 13.
    // Adjust body to land on a clean checksum.
    const ok = withChecksum('33300010000000011')
    expect(ok.length).toBe(ACCOUNT_NUMBER_LENGTH)
    expect(validateAccountNumber(ok)).toBeNull()
    expect(isValidAccountNumber(ok)).toBe(true)
  })

  it('rejects the wrong length', () => {
    expect(validateAccountNumber('')).toBe('wrong-length')
    expect(validateAccountNumber('123')).toBe('wrong-length')
    expect(validateAccountNumber('1'.repeat(17))).toBe('wrong-length')
    expect(validateAccountNumber('1'.repeat(19))).toBe('wrong-length')
  })

  it('rejects non-digit input', () => {
    const ok = withChecksum('33300010000000011')
    const withLetter = ok.slice(0, 5) + 'X' + ok.slice(6)
    expect(validateAccountNumber(withLetter)).toBe('non-digit')
    // Whitespace is stripped by normalize, so a string of 18 spaces is
    // empty after normalization → wrong-length.
    expect(validateAccountNumber(' '.repeat(18))).toBe('wrong-length')
  })

  it('accepts the formatted XXX-FFFF-NNNNNNNNN-TT layout', () => {
    const ok = withChecksum('33300010000000011')
    const formatted = `${ok.slice(0, 3)}-${ok.slice(3, 7)}-${ok.slice(7, 16)}-${ok.slice(16, 18)}`
    expect(validateAccountNumber(formatted)).toBeNull()
    expect(normalizeAccountNumber(formatted)).toBe(ok)
  })

  it('rejects a one-digit typo (checksum mismatch)', () => {
    const ok = withChecksum('33300010000000011')
    // Bump a body digit by 1 — the sum is now off by 1, so mod-11
    // fails. This is the actual "fat-finger" guard.
    const idx = 8
    const flipped =
      ok.slice(0, idx) +
      String((parseInt(ok[idx], 10) + 1) % 10) +
      ok.slice(idx + 1)
    expect(flipped.length).toBe(ACCOUNT_NUMBER_LENGTH)
    expect(validateAccountNumber(flipped)).toBe('checksum-mismatch')
    expect(isValidAccountNumber(flipped)).toBe(false)
  })
})
