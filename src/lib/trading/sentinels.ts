// Sentinel UUIDs that the bank service uses as `owner_client_id` on
// bank-owned accounts. Mirrors the constants in
// `services/bank/internal/domain/domain.go`. Trading actuaries place
// orders against forex_book accounts (one per supported currency,
// pre-funded as the bank's open-FX position book), so the OrderForm
// queries on this sentinel instead of the principal's userId.

export const FOREX_BOOK_OWNER_ID = '00000000-0000-0000-0000-000000000020'

// BankAsClientOwnerID — `client_id` stamped on `client_fund_positions`
// when the bank itself holds a stake in one of its own funds (spec
// p.75 Napomena 2 — supervisor "investing in the name of the bank").
export const BANK_AS_CLIENT_OWNER_ID = '00000000-0000-0000-0000-000000000030'

// FundsOwnerID — `owner_client_id` on every bank account opened to
// hold an investment fund's RSD liquidity. Funds' own RSD accounts
// surface to supervisors via `listAccounts({ ownerClientId: this })`.
export const FUNDS_OWNER_ID = '00000000-0000-0000-0000-000000000040'
