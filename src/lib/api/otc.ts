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
