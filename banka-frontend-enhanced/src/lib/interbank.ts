/**
 * Inter-bank routing helpers.
 *
 * Account number format: BBB FFFF NNNNNNNNN TT (18 digits).
 * The first 3 digits are the bank routing prefix — each bank in the
 * system has its own unique prefix. Our bank's prefix is read from
 * the VITE_BANK_ROUTING_PREFIX env var (defaults to '265').
 *
 * Any account whose first 3 digits differ from our prefix belongs to
 * another bank, and CreatePayment will route it through the inter-bank
 * 2-phase-commit protocol on the backend.
 */

/** Our own bank's 3-digit routing prefix. */
export const OWN_BANK_PREFIX: string =
  import.meta.env.VITE_BANK_ROUTING_PREFIX ?? '265'

/**
 * Extract the 3-digit bank prefix from a raw 18-digit account number.
 * Returns null if the string is shorter than 3 digits after stripping spaces/dashes.
 */
export function getBankPrefix(accountNumber: string): string | null {
  const raw = accountNumber.replace(/[\s-]/g, '')
  if (raw.length < 3) return null
  return raw.slice(0, 3)
}

/**
 * Returns true when the account number belongs to a DIFFERENT bank.
 * Blanks / invalid numbers return false (let the backend validate).
 */
export function isInterbankAccount(accountNumber: string): boolean {
  const prefix = getBankPrefix(accountNumber)
  if (!prefix) return false
  return prefix !== OWN_BANK_PREFIX
}

/**
 * Human-readable bank name for a given prefix.
 * Falls back to "Banka [prefix]" for unknown prefixes.
 */
export function bankNameFromPrefix(prefix: string): string {
  const known: Record<string, string> = {
    [OWN_BANK_PREFIX]: 'Naša banka',
  }
  return known[prefix] ?? `Banka ${prefix}`
}
