import { api } from './client'
import type { v1ListActuaryPerformancesResponse } from './generated/models/v1ListActuaryPerformancesResponse'
import type { v1ListBankFundPositionsResponse } from './generated/models/v1ListBankFundPositionsResponse'
import type { v1GetBankProfitTimeseriesResponse } from './generated/models/v1GetBankProfitTimeseriesResponse'

export type ProfitBucket = 'day' | 'week' | 'month'

export interface BankProfitTimeseriesArgs {
  bucket: ProfitBucket
  // ISO timestamps; both optional — the backend fills a trailing
  // default window per bucket when omitted.
  from?: string
  to?: string
}

export interface ListActuaryPerformancesArgs {
  type?: 'agent' | 'supervisor' | ''
  nameQuery?: string
}

export async function listActuaryPerformances(
  args: ListActuaryPerformancesArgs = {},
): Promise<v1ListActuaryPerformancesResponse> {
  const { data } = await api.get<v1ListActuaryPerformancesResponse>('/v1/profit/actuaries', {
    params: args,
  })
  return data
}

export async function listBankFundPositions(): Promise<v1ListBankFundPositionsResponse> {
  const { data } = await api.get<v1ListBankFundPositionsResponse>('/v1/profit/funds')
  return data
}

export async function getBankProfitTimeseries(
  args: BankProfitTimeseriesArgs,
): Promise<v1GetBankProfitTimeseriesResponse> {
  const { data } = await api.get<v1GetBankProfitTimeseriesResponse>('/v1/profit/timeseries', {
    params: args,
  })
  return data
}
