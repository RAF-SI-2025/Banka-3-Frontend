import { api } from './client'
import { proofHeaders, type VerificationProof } from './verification'
import type { InterbankCurrency } from './scheduledInterbank'

// One-off, immediate cross-bank cash payment (celina 5, spec p.77+).
// Mirrors the scheduled variant in scheduledInterbank.ts but runs the
// 2PC saga synchronously: the response carries the final saga state
// (or `running` if it parked for retry). Verification-gated at the
// gateway (`interbank_payment` action kind), so it takes a
// VerificationProof exactly like createPayment.
//
// Wire shapes are typed locally — the checked-in OpenAPI models lag the
// backend proto for this feature on this branch (same reason as
// scheduledInterbank.ts).

export interface SubmitCrossBankPaymentBody {
  // Stable across retries; combined with (user_id, source_account_id)
  // server-side to derive the saga transaction_id so a re-submit after
  // a flaky verification never double-charges.
  idempotencyKey: string
  sourceAccountId: string
  remoteBankCode: string
  // 18-digit partner-bank account number; checksum (sum%11==0) is
  // re-validated server-side.
  remoteAccountNumber: string
  currency: InterbankCurrency
  amount: string
  purpose?: string
}

export type CrossBankPaymentStatus =
  | 'running'
  | 'completed'
  | 'failed'
  | 'compensating'
  | string

export interface SubmitCrossBankPaymentResult {
  transactionId?: string
  status?: CrossBankPaymentStatus
  lastError?: string
}

export async function submitCrossBankPayment(
  body: SubmitCrossBankPaymentBody,
  proof: VerificationProof,
): Promise<SubmitCrossBankPaymentResult> {
  const { data } = await api.post<SubmitCrossBankPaymentResult>(
    '/v1/payments/interbank',
    body,
    { headers: proofHeaders(proof) },
  )
  return data
}
