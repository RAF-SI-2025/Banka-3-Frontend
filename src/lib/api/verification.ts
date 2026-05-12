import { api } from './client'

// VerificationKind mirrors pkg/verification.ActionKind on the backend.
// Adding a new action means: add a constant here, register a rule in
// the gateway's verification middleware, and gate the form with the
// dialog below.
export type VerificationKind =
  | 'payment'
  | 'transfer'
  | 'limit_change'
  | 'card_issue'
  | 'otc_accept'
  | 'otc_exercise'
  | 'fund_invest'
  | 'fund_withdraw'

// VerificationProof is what the dialog hands back to the caller. The
// caller passes it on to the gated mutation (payments, transfers,
// limit edits, card creation), where the API helper translates it
// into X-Verification-Id + X-Verification-Code headers.
export interface VerificationProof {
  id: string
  code: string
}

export interface IssuedVerification {
  verificationId: string
  // For inline-delivery actions (payment/transfer/limit) the backend
  // returns the code in the response and the FE renders it directly.
  // For email-delivery actions (card issuance) the code is sent by
  // email; this field is empty and `delivery` is "email".
  code: string
  expiresAt: string
  delivery: 'inline' | 'email'
}

export async function requestVerification(actionKind: VerificationKind): Promise<IssuedVerification> {
  const { data } = await api.post<IssuedVerification>('/v1/verification/request', { actionKind })
  return data
}

// proofHeaders maps a verification proof to the headers the gateway
// middleware expects. Returns an empty object when proof is undefined
// so call sites can spread unconditionally.
export function proofHeaders(proof?: VerificationProof): Record<string, string> {
  if (!proof) return {}
  return {
    'X-Verification-Id': proof.id,
    'X-Verification-Code': proof.code,
  }
}
