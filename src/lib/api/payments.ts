import { api } from './client'
import type { v1CreatePaymentRequest } from './generated/models/v1CreatePaymentRequest'
import type { v1CreateTransferRequest } from './generated/models/v1CreateTransferRequest'
import type { v1PaymentResult } from './generated/models/v1PaymentResult'
import type { v1ListTransactionsResponse } from './generated/models/v1ListTransactionsResponse'
import type { v1Transaction } from './generated/models/v1Transaction'
import type { v1QuoteExchangeRequest } from './generated/models/v1QuoteExchangeRequest'
import type { v1QuoteExchangeResponse } from './generated/models/v1QuoteExchangeResponse'
import type { v1SchedulePaymentRequest } from './generated/models/v1SchedulePaymentRequest'
import type { v1ScheduledPayment } from './generated/models/v1ScheduledPayment'
import type { v1ListScheduledPaymentsResponse } from './generated/models/v1ListScheduledPaymentsResponse'
import { proofHeaders, type VerificationProof } from './verification'

export type ScheduledPayment = v1ScheduledPayment

export type Transaction = v1Transaction
export type PaymentResult = v1PaymentResult

export interface ListTransactionsArgs {
  accountId?: string
  opKind?: 'payment' | 'transfer' | 'exchange' | 'fee'
  status?: string
  page?: number
  pageSize?: number
  // Spec p.18 / p.24 "filtriranje po datumu" — ISO timestamps
  // (T00:00:00Z midnight UTC); grpc-gateway parses these as
  // google.protobuf.Timestamp on the backend. Either bound may be
  // omitted. See [[yyyymmdd-proto-timestamp]] for the date-input
  // conversion convention.
  from?: string
  to?: string
}

export async function listTransactions(args: ListTransactionsArgs = {}): Promise<v1ListTransactionsResponse> {
  const { data } = await api.get<v1ListTransactionsResponse>('/v1/transactions', { params: args })
  return data
}

export async function createPayment(input: v1CreatePaymentRequest, proof: VerificationProof): Promise<PaymentResult> {
  const { data } = await api.post<PaymentResult>('/v1/payments', input, { headers: proofHeaders(proof) })
  return data
}

export async function createTransfer(input: v1CreateTransferRequest, proof: VerificationProof): Promise<PaymentResult> {
  const { data } = await api.post<PaymentResult>('/v1/transfers', input, { headers: proofHeaders(proof) })
  return data
}

export async function quoteExchange(req: v1QuoteExchangeRequest): Promise<v1QuoteExchangeResponse> {
  const { data } = await api.post<v1QuoteExchangeResponse>('/v1/menjacnica/quote', req)
  return data
}

// Scheduled payments — "Zakazivanje plaćanja" (todoSpec C2). Scheduling
// is verification-gated (same 6-digit dialog as an immediate payment),
// so it takes a VerificationProof. Listing + cancelling are not gated.
export async function schedulePayment(
  input: v1SchedulePaymentRequest,
  proof: VerificationProof,
): Promise<ScheduledPayment> {
  const { data } = await api.post<ScheduledPayment>('/v1/scheduled-payments', input, {
    headers: proofHeaders(proof),
  })
  return data
}

export async function listScheduledPayments(): Promise<v1ListScheduledPaymentsResponse> {
  const { data } = await api.get<v1ListScheduledPaymentsResponse>('/v1/scheduled-payments')
  return data
}

export async function cancelScheduledPayment(id: string): Promise<ScheduledPayment> {
  const { data } = await api.delete<ScheduledPayment>(`/v1/scheduled-payments/${id}`)
  return data
}
