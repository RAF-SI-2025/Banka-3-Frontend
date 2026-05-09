// Sentinel UUIDs that the bank service uses as `owner_client_id` on
// bank-owned accounts. Mirrors the constants in
// `services/bank/internal/domain/domain.go`. Trading actuaries place
// orders against forex_book accounts (one per supported currency,
// pre-funded as the bank's open-FX position book), so the OrderForm
// queries on this sentinel instead of the principal's userId.

export const FOREX_BOOK_OWNER_ID = '00000000-0000-0000-0000-000000000020'
