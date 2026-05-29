import { api } from './client'
import type { v1ListFundsResponse } from './generated/models/v1ListFundsResponse'
import type { v1GetFundResponse } from './generated/models/v1GetFundResponse'
import type { v1ListFundPositionsResponse } from './generated/models/v1ListFundPositionsResponse'
import type { v1GetFundPerformanceResponse } from './generated/models/v1GetFundPerformanceResponse'
import type { v1ListFundTransactionsResponse } from './generated/models/v1ListFundTransactionsResponse'
import type { v1Fund } from './generated/models/v1Fund'
import type { v1CreateFundRequest } from './generated/models/v1CreateFundRequest'
import type { TradingServiceInvestInFundBody } from './generated/models/TradingServiceInvestInFundBody'
import type { TradingServiceWithdrawFromFundBody } from './generated/models/TradingServiceWithdrawFromFundBody'
import type { v1FundTransactionResponse } from './generated/models/v1FundTransactionResponse'

export interface ListFundsArgs {
  status?: 'active' | 'any' | ''
  managerUserId?: string
  minContributionAtLeast?: string
  minContributionAtMost?: string
  sort?: 'name' | 'total_value' | 'profit' | 'minimum_contribution'
  order?: 'asc' | 'desc'
}

export async function listFunds(args: ListFundsArgs = {}): Promise<v1ListFundsResponse> {
  const { data } = await api.get<v1ListFundsResponse>('/v1/funds', { params: args })
  return data
}

export async function getFund(id: string): Promise<v1GetFundResponse> {
  const { data } = await api.get<v1GetFundResponse>(`/v1/funds/${encodeURIComponent(id)}`)
  return data
}

export async function createFund(input: v1CreateFundRequest): Promise<v1Fund> {
  const { data } = await api.post<v1Fund>('/v1/funds', input)
  return data
}

export interface ListFundPositionsArgs {
  clientId?: string
  status?: 'active' | 'any' | ''
}

export async function listFundPositions(args: ListFundPositionsArgs = {}): Promise<v1ListFundPositionsResponse> {
  const { data } = await api.get<v1ListFundPositionsResponse>('/v1/funds/positions', { params: args })
  return data
}

export async function getFundPerformance(id: string, days?: number): Promise<v1GetFundPerformanceResponse> {
  const { data } = await api.get<v1GetFundPerformanceResponse>(
    `/v1/funds/${encodeURIComponent(id)}/performance`,
    { params: days != null ? { days } : undefined },
  )
  return data
}

export interface ListFundTransactionsArgs {
  clientId?: string
  status?: '' | 'pending' | 'completed' | 'failed'
  page?: number
  pageSize?: number
}

export async function listFundTransactions(
  id: string,
  args: ListFundTransactionsArgs = {},
): Promise<v1ListFundTransactionsResponse> {
  const { data } = await api.get<v1ListFundTransactionsResponse>(
    `/v1/funds/${encodeURIComponent(id)}/transactions`,
    { params: args },
  )
  return data
}

export async function investInFund(
  id: string,
  body: TradingServiceInvestInFundBody,
): Promise<v1FundTransactionResponse> {
  const { data } = await api.post<v1FundTransactionResponse>(
    `/v1/funds/${encodeURIComponent(id)}/invest`,
    body,
  )
  return data
}

export async function withdrawFromFund(
  id: string,
  body: TradingServiceWithdrawFromFundBody,
): Promise<v1FundTransactionResponse> {
  const { data } = await api.post<v1FundTransactionResponse>(
    `/v1/funds/${encodeURIComponent(id)}/withdraw`,
    body,
  )
  return data
}
