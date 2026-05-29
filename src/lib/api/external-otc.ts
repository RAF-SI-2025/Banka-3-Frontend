// Celina 5 — cross-bank OTC API client. Mirrors lib/api/otc.ts but
// routes against the gateway's /v1/otc/external-* surface.
//
// Naming: every endpoint groups by thread or contract. Threads carry
// the partner's bank_code + thread_id as a (bank, id) tuple in the URL
// path so a partner identifier collision across banks doesn't shadow
// our local row.

import { api } from './client'
import type { v1CreateExternalOTCOfferRequest } from './generated/models/v1CreateExternalOTCOfferRequest'
import type { v1CreateExternalOTCOfferResponse } from './generated/models/v1CreateExternalOTCOfferResponse'
import type { v1AcceptExternalOTCOfferResponse } from './generated/models/v1AcceptExternalOTCOfferResponse'
import type { v1ExerciseExternalOTCContractResponse } from './generated/models/v1ExerciseExternalOTCContractResponse'
import type { v1ExternalOTCThread } from './generated/models/v1ExternalOTCThread'
import type { v1GetExternalOTCThreadResponse } from './generated/models/v1GetExternalOTCThreadResponse'
import type { v1ListExternalOTCThreadsResponse } from './generated/models/v1ListExternalOTCThreadsResponse'
import type { v1ListExternalOTCContractsResponse } from './generated/models/v1ListExternalOTCContractsResponse'
import type { v1ListExternalPublicHoldingsResponse } from './generated/models/v1ListExternalPublicHoldingsResponse'
import type { v1ExternalOTCThreadStatus } from './generated/models/v1ExternalOTCThreadStatus'
import type { v1ExternalOTCContractStatus } from './generated/models/v1ExternalOTCContractStatus'

// ---------------------------------------------------------------------
// Discovery — fans out across configured partner banks.
// ---------------------------------------------------------------------

export interface ListExternalPublicHoldingsArgs {
  bankCode?: string
  ticker?: string
}

export async function listExternalPublicHoldings(
  args: ListExternalPublicHoldingsArgs = {},
): Promise<v1ListExternalPublicHoldingsResponse> {
  const { data } = await api.get<v1ListExternalPublicHoldingsResponse>(
    '/v1/otc/external-discovery',
    { params: args },
  )
  return data
}

// ---------------------------------------------------------------------
// Threads.
// ---------------------------------------------------------------------

export interface ListExternalOTCThreadsArgs {
  status?: v1ExternalOTCThreadStatus
}

export async function listExternalOTCThreads(
  args: ListExternalOTCThreadsArgs = {},
): Promise<v1ListExternalOTCThreadsResponse> {
  const { data } = await api.get<v1ListExternalOTCThreadsResponse>(
    '/v1/otc/external-offers',
    { params: args },
  )
  return data
}

export async function getExternalOTCThread(
  threadId: string,
): Promise<v1GetExternalOTCThreadResponse> {
  const { data } = await api.get<v1GetExternalOTCThreadResponse>(
    `/v1/otc/external-offers/${encodeURIComponent(threadId)}`,
  )
  return data
}

export async function createExternalOTCOffer(
  input: v1CreateExternalOTCOfferRequest,
): Promise<v1CreateExternalOTCOfferResponse> {
  const { data } = await api.post<v1CreateExternalOTCOfferResponse>(
    '/v1/otc/external-offers',
    input,
  )
  return data
}

export interface CounterExternalOfferInput {
  quantity?: number
  pricePerUnit?: string
  premium?: string
  // Pin midnight UTC — see [[yyyymmdd-proto-timestamp]] memory.
  settlementDate?: string
}

export async function counterExternalOTCOffer(
  bankCode: string,
  threadId: string,
  input: CounterExternalOfferInput,
): Promise<v1ExternalOTCThread> {
  const { data } = await api.post<v1ExternalOTCThread>(
    `/v1/otc/external-offers/${encodeURIComponent(bankCode)}/${encodeURIComponent(threadId)}/counter`,
    input,
  )
  return data
}

export async function withdrawExternalOTCOffer(
  bankCode: string,
  threadId: string,
): Promise<v1ExternalOTCThread> {
  const { data } = await api.post<v1ExternalOTCThread>(
    `/v1/otc/external-offers/${encodeURIComponent(bankCode)}/${encodeURIComponent(threadId)}/withdraw`,
    {},
  )
  return data
}

export async function acceptExternalOTCOffer(
  bankCode: string,
  threadId: string,
): Promise<v1AcceptExternalOTCOfferResponse> {
  const { data } = await api.post<v1AcceptExternalOTCOfferResponse>(
    `/v1/otc/external-offers/${encodeURIComponent(bankCode)}/${encodeURIComponent(threadId)}/accept`,
    {},
  )
  return data
}

// ---------------------------------------------------------------------
// Contracts.
// ---------------------------------------------------------------------

export interface ListExternalOTCContractsArgs {
  status?: v1ExternalOTCContractStatus
}

export async function listExternalOTCContracts(
  args: ListExternalOTCContractsArgs = {},
): Promise<v1ListExternalOTCContractsResponse> {
  const { data } = await api.get<v1ListExternalOTCContractsResponse>(
    '/v1/otc/external-contracts',
    { params: args },
  )
  return data
}

export interface ExerciseExternalContractInput {
  // Optional client-supplied idempotency key for the cross-bank
  // exercise. Backend derives a deterministic id when empty.
  exerciseOpId?: string
}

export async function exerciseExternalOTCContract(
  bankCode: string,
  contractId: string,
  input: ExerciseExternalContractInput = {},
): Promise<v1ExerciseExternalOTCContractResponse> {
  const { data } = await api.post<v1ExerciseExternalOTCContractResponse>(
    `/v1/otc/external-contracts/${encodeURIComponent(bankCode)}/${encodeURIComponent(contractId)}/exercise`,
    input,
  )
  return data
}
