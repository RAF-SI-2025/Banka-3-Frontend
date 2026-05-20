import { api } from './client'
import type { v1CreatePaymentRequest } from './generated/models/v1CreatePaymentRequest'
import type { v1CreateTransferRequest } from './generated/models/v1CreateTransferRequest'
import type { v1PaymentResult } from './generated/models/v1PaymentResult'
import type { v1ListTransactionsResponse } from './generated/models/v1ListTransactionsResponse'
import type { v1Transaction } from './generated/models/v1Transaction'
import type { v1QuoteExchangeRequest } from './generated/models/v1QuoteExchangeRequest'
import type { v1QuoteExchangeResponse } from './generated/models/v1QuoteExchangeResponse'
import { proofHeaders, type VerificationProof } from './verification'

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
