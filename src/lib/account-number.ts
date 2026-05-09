// Client-side account-number validator. Same algorithm the backend's
// pkg/account.Validate enforces — 18 digits, then sum-of-digits mod 11
// must be 0. Lifted client-side so the payment / transfer forms can
// reject typos before round-tripping to the gateway.
//
// The shape (BBB FFFF NNNNNNNNN TT) is encoded for documentation; the
// validator itself doesn't care which segment a digit lives in.

export const ACCOUNT_NUMBER_LENGTH = 18

export type AccountNumberError =
  | 'wrong-length'
  | 'non-digit'
  | 'checksum-mismatch'

// normalizeAccountNumber strips formatting separators (dashes / spaces)
// users naturally paste back from `formatAccountNumber`. The backend
// expects a flat 18-digit string, so callers should normalize before
// validating and before sending the value.
export function normalizeAccountNumber(s: string): string {
  return s.replace(/[\s-]/g, '')
}

// validateAccountNumber returns null when s is a syntactically valid
// 18-digit number whose digit-sum is divisible by 11; otherwise it
// returns a stable error code the form layer can map to a Serbian
// message. Dashes and whitespace are stripped first so a user can paste
// the formatted "265-0001-…-10" form without re-typing it.
export function validateAccountNumber(s: string): AccountNumberError | null {
  const n = normalizeAccountNumber(s)
  if (n.length !== ACCOUNT_NUMBER_LENGTH) return 'wrong-length'
  let sum = 0
  for (let i = 0; i < n.length; i++) {
    const code = n.charCodeAt(i)
    if (code < 0x30 || code > 0x39) return 'non-digit'
    sum += code - 0x30
  }
  if (sum % 11 !== 0) return 'checksum-mismatch'
  return null
}

// isValidAccountNumber is a boolean shorthand for the same check, for
// callers that don't need to distinguish the failure reason.
export function isValidAccountNumber(s: string): boolean {
  return validateAccountNumber(s) === null
}
