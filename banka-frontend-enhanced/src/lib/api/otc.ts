import { api } from './client'
import type { v1ListPublicHoldingsResponse } from './generated/models/v1ListPublicHoldingsResponse'
import type { v1ListOTCThreadsResponse } from './generated/models/v1ListOTCThreadsResponse'
import type { v1GetOTCThreadResponse } from './generated/models/v1GetOTCThreadResponse'
import type { v1ListOTCContractsResponse } from './generated/models/v1ListOTCContractsResponse'
import type { v1OTCOffer } from './generated/models/v1OTCOffer'
import type { v1OTCContract } from './generated/models/v1OTCContract'
import type { v1CreateOTCOfferRequest } from './generated/models/v1CreateOTCOfferRequest'
import type { v1AcceptOTCOfferResponse } from './generated/models/v1AcceptOTCOfferResponse'
import type { v1ExerciseOTCContractResponse } from './generated/models/v1ExerciseOTCContractResponse'
import type { bankaTradingV1UserKind } from './generated/models/bankaTradingV1UserKind'

export interface ListPublicHoldingsArgs {
  ticker?: string
}

export async function listPublicHoldings(args: ListPublicHoldingsArgs = {}): Promise<v1ListPublicHoldingsResponse> {
  const { data } = await api.get<v1ListPublicHoldingsResponse>('/v1/otc/discovery', { params: args })
  return data
}

export interface ListOTCThreadsArgs {
  partyUserId?: string
  partyUserKind?: bankaTradingV1UserKind
}

export async function listOTCThreads(args: ListOTCThreadsArgs = {}): Promise<v1ListOTCThreadsResponse> {
  const { data } = await api.get<v1ListOTCThreadsResponse>('/v1/otc/offers', { params: args })
  return data
}

export async function getOTCThread(threadId: string): Promise<v1GetOTCThreadResponse> {
  const { data } = await api.get<v1GetOTCThreadResponse>(
    `/v1/otc/offers/${encodeURIComponent(threadId)}`,
  )
  return data
}

export async function createOTCOffer(input: v1CreateOTCOfferRequest): Promise<v1OTCOffer> {
  const { data } = await api.post<v1OTCOffer>('/v1/otc/offers', input)
  return data
}

export interface CounterOfferInput {
  quantity?: number
  pricePerUnit?: string
  premium?: string
  settlementDate?: string
}

export async function counterOTCOffer(threadId: string, input: CounterOfferInput): Promise<v1OTCOffer> {
  const { data } = await api.post<v1OTCOffer>(
    `/v1/otc/offers/${encodeURIComponent(threadId)}/counter`,
    input,
  )
  return data
}

export async function withdrawOTCOffer(threadId: string): Promise<v1OTCOffer> {
  const { data } = await api.post<v1OTCOffer>(
    `/v1/otc/offers/${encodeURIComponent(threadId)}/withdraw`,
    {},
  )
  return data
}

export async function acceptOTCOffer(threadId: string): Promise<v1AcceptOTCOfferResponse> {
  const { data } = await api.post<v1AcceptOTCOfferResponse>(
    `/v1/otc/offers/${encodeURIComponent(threadId)}/accept`,
    {},
  )
  return data
}

export interface ListOTCContractsArgs {
  partyUserId?: string
  partyUserKind?: bankaTradingV1UserKind
  // "active" (default) | "any" | "" — backend tolerates the empty form.
  status?: 'active' | 'any' | ''
}

export async function listOTCContracts(args: ListOTCContractsArgs = {}): Promise<v1ListOTCContractsResponse> {
  const { data } = await api.get<v1ListOTCContractsResponse>('/v1/otc/contracts', { params: args })
  return data
}

export async function getOTCContract(id: string): Promise<v1OTCContract> {
  const { data } = await api.get<v1OTCContract>(`/v1/otc/contracts/${encodeURIComponent(id)}`)
  return data
}

export async function exerciseOTCContract(id: string): Promise<v1ExerciseOTCContractResponse> {
  const { data } = await api.post<v1ExerciseOTCContractResponse>(
    `/v1/otc/contracts/${encodeURIComponent(id)}/exercise`,
    {},
  )
  return data
}

// ─── Inter-bank OTC (Celina 5) ──────────────────────────────────────────────

export interface ExternalPublicHoldingItem {
  holdingId?: string
  sellerBankPrefix?: string
  sellerBankName?: string
  sellerId?: string
  sellerDisplayName?: string
  securityTicker?: string
  securityId?: string
  availableCount?: number
  currentPrice?: string
  currency?: string
}

export interface ListExternalPublicHoldingsResponse {
  items?: ExternalPublicHoldingItem[]
}

/**
 * Fetch public holdings advertised by OTHER banks.
 * Backend endpoint: GET /v1/otc/external-discovery
 * (or /v1/otc/discovery?external=true — backend picks whichever it exposes)
 */
export async function listExternalPublicHoldings(args: ListPublicHoldingsArgs = {}): Promise<ListExternalPublicHoldingsResponse> {
  try {
    const { data } = await api.get<ListExternalPublicHoldingsResponse>(
      '/v1/otc/external-discovery',
      { params: args },
    )
    return data
  } catch {
    // fallback: try the unified endpoint with external flag
    const { data } = await api.get<ListExternalPublicHoldingsResponse>(
      '/v1/otc/discovery',
      { params: { ...args, external: true } },
    )
    return data
  }
}

export interface CreateExternalOTCOfferInput {
  sellerHoldingId?: string
  sellerBankPrefix?: string
  buyerAccountId?: string
  quantity?: number
  pricePerUnit?: string
  premium?: string
  settlementDate?: string
}

/**
 * Create an OTC negotiation offer targeting a seller at another bank.
 * Backend endpoint: POST /v1/otc/external-offers
 */
export async function createExternalOTCOffer(input: CreateExternalOTCOfferInput): Promise<v1OTCOffer> {
  const { data } = await api.post<v1OTCOffer>('/v1/otc/external-offers', input)
  return data
}
