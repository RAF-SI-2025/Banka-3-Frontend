import { api } from './client'

// Scheduled / periodic inter-bank payments (celina 5 — todoSpec
// "Scheduled/periodic inter-bank payments"). Spec example: "Svakog prvog
// u mesecu poslati 400 EUR na dati račun." The backend's OpenAPI models
// are not regenerated for this feature batch (the worktree's swagger is
// not the path api:gen reads), so the wire shapes are typed locally here
// — they mirror the grpc-gateway camelCase JSON 1:1.

// Cadence strings match pkg/schedule.Cadence on the backend. ONCE is a
// single future-dated run; the rest repeat.
export type InterbankCadence = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'

// Trading-service Currency enum (string form on the wire).
export type InterbankCurrency =
  | 'CURRENCY_RSD'
  | 'CURRENCY_EUR'
  | 'CURRENCY_CHF'
  | 'CURRENCY_USD'
  | 'CURRENCY_GBP'
  | 'CURRENCY_JPY'
  | 'CURRENCY_CAD'
  | 'CURRENCY_AUD'

export interface ScheduledInterbankPayment {
  id: string
  userId?: string
  sourceAccountId: string
  destBankCode: string
  destAccountNumber: string
  currency: InterbankCurrency | string
  amount: string
  purpose?: string
  cadence: InterbankCadence | string
  nextRun?: string
  active: boolean
  // Most recent run's outcome (saga status string) + error, if any.
  lastStatus?: string
  lastError?: string
  lastRunAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface ListScheduledInterbankPaymentsResponse {
  scheduledPayments?: ScheduledInterbankPayment[]
}

export interface CreateScheduledInterbankPaymentBody {
  sourceAccountId: string
  destBankCode: string
  destAccountNumber: string
  currency: InterbankCurrency
  amount: string
  purpose?: string
  cadence: InterbankCadence
  // RFC3339 first-run anchor. Required for ONCE (validated server-side to
  // be in the future); optional for recurring cadences.
  startDate?: string
}

const BASE = '/v1/cross-bank-payments/scheduled'

export async function listScheduledInterbankPayments(): Promise<ListScheduledInterbankPaymentsResponse> {
  const { data } = await api.get<ListScheduledInterbankPaymentsResponse>(BASE)
  return data
}

export async function createScheduledInterbankPayment(
  body: CreateScheduledInterbankPaymentBody,
): Promise<ScheduledInterbankPayment> {
  const { data } = await api.post<ScheduledInterbankPayment>(BASE, body)
  return data
}

export async function pauseScheduledInterbankPayment(id: string): Promise<ScheduledInterbankPayment> {
  const { data } = await api.post<ScheduledInterbankPayment>(
    `${BASE}/${encodeURIComponent(id)}/pause`,
    {},
  )
  return data
}

export async function resumeScheduledInterbankPayment(id: string): Promise<ScheduledInterbankPayment> {
  const { data } = await api.post<ScheduledInterbankPayment>(
    `${BASE}/${encodeURIComponent(id)}/resume`,
    {},
  )
  return data
}

export async function cancelScheduledInterbankPayment(id: string): Promise<void> {
  await api.delete(`${BASE}/${encodeURIComponent(id)}`)
}
