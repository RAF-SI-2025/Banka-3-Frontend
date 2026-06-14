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
  | 'external_otc_accept'
  | 'external_otc_exercise'
  // c5 — user-initiated cross-bank cash payment. Distinct from
  // 'payment' so an intra-bank code can't be replayed against the
  // cross-bank route (gateway DefaultRules).
  | 'interbank_payment'

// VerificationProof is what the dialog hands back to the caller. The
// caller passes it on to the gated mutation (payments, transfers,
// limit edits, card creation), where the API helper translates it
// into X-Verification-Id + X-Verification-Code headers.
//
// Two shapes:
//   - code path: the user typed the 6-digit code (code is set).
//   - quick-approve path (todoSpec S12): the user approved the action
//     from the mobile app; the dialog proceeds id-only with an empty
//     code, and proofHeaders attaches X-Verification-Id alone.
export interface VerificationProof {
  id: string
  code: string
}

export interface IssuedVerification {
  verificationId: string
  // The code is NOT returned to the web app: it is delivered only to
  // the mobile app (the second factor), which the user reads off their
  // phone or approves there. This field is therefore empty for
  // `delivery: 'mobile'`. It is only ever populated by Cypress stubs
  // that fabricate a code; real backend responses leave it empty.
  // (`'email'` is the card-issuance path: code sent by email, also no
  // inline code.)
  code?: string
  expiresAt: string
  delivery: 'mobile' | 'email'
}

export async function requestVerification(actionKind: VerificationKind): Promise<IssuedVerification> {
  const { data } = await api.post<IssuedVerification>('/v1/verification/request', { actionKind })
  return data
}

// VerificationStatus mirrors the gateway's GET /verification/{id}/status
// response (todoSpec S12). The web poll-mode dialog watches for
// "approved" to auto-proceed id-only, and treats "expired" as terminal.
export type VerificationStatusValue = 'pending' | 'approved' | 'expired'

export interface VerificationStatus {
  id: string
  status: VerificationStatusValue
}

export async function getVerificationStatus(id: string): Promise<VerificationStatus> {
  const { data } = await api.get<VerificationStatus>(`/v1/verification/${id}/status`)
  return data
}

// proofHeaders maps a verification proof to the headers the gateway
// middleware expects. Returns an empty object when proof is undefined
// so call sites can spread unconditionally. When the proof carries no
// code (quick-approve, todoSpec S12) only X-Verification-Id is sent —
// the gateway validates by id against the mobile-approved record.
export function proofHeaders(proof?: VerificationProof): Record<string, string> {
  if (!proof) return {}
  if (!proof.code) {
    return { 'X-Verification-Id': proof.id }
  }
  return {
    'X-Verification-Id': proof.id,
    'X-Verification-Code': proof.code,
  }
}
