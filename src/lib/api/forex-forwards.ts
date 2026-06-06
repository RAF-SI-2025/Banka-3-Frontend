// Forex forwards (terminski valutni ugovori, todoSpec C3). The bank fixes
// today a rate for a future currency conversion. Concluding a forward
// reserves the RSD obligation + charges a commission, so it's
// verification-gated (same 6-digit dialog as a payment); quoting,
// listing, cancelling, and reading/editing the spread factors are not.
import { api } from './client'
import { proofHeaders, type VerificationProof } from './verification'
import type { v1QuoteForexForwardRequest } from './generated/models/v1QuoteForexForwardRequest'
import type { v1ForexForwardQuote } from './generated/models/v1ForexForwardQuote'
import type { v1CreateForexForwardRequest } from './generated/models/v1CreateForexForwardRequest'
import type { v1ForexForward } from './generated/models/v1ForexForward'
import type { v1ListForexForwardsResponse } from './generated/models/v1ListForexForwardsResponse'
import type { v1GetForexForwardSpreadsResponse } from './generated/models/v1GetForexForwardSpreadsResponse'
import type { v1ForexForwardSpread } from './generated/models/v1ForexForwardSpread'
import type { v1SetForexForwardSpreadRequest } from './generated/models/v1SetForexForwardSpreadRequest'

export type ForexForward = v1ForexForward
export type ForexForwardQuote = v1ForexForwardQuote
export type ForexForwardSpread = v1ForexForwardSpread

export async function quoteForexForward(req: v1QuoteForexForwardRequest): Promise<ForexForwardQuote> {
  const { data } = await api.post<ForexForwardQuote>('/v1/forex-forwards/quote', req)
  return data
}

export async function createForexForward(
  input: v1CreateForexForwardRequest,
  proof: VerificationProof,
): Promise<ForexForward> {
  const { data } = await api.post<ForexForward>('/v1/forex-forwards', input, { headers: proofHeaders(proof) })
  return data
}

export async function listForexForwards(): Promise<v1ListForexForwardsResponse> {
  const { data } = await api.get<v1ListForexForwardsResponse>('/v1/forex-forwards')
  return data
}

export async function cancelForexForward(id: string): Promise<ForexForward> {
  const { data } = await api.delete<ForexForward>(`/v1/forex-forwards/${id}`)
  return data
}

export async function getForexForwardSpreads(): Promise<v1GetForexForwardSpreadsResponse> {
  const { data } = await api.get<v1GetForexForwardSpreadsResponse>('/v1/forex-forwards/spreads')
  return data
}

export async function setForexForwardSpread(input: v1SetForexForwardSpreadRequest): Promise<ForexForwardSpread> {
  const { data } = await api.put<ForexForwardSpread>('/v1/forex-forwards/spreads', input)
  return data
}
