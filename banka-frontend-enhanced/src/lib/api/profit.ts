import { api } from './client'
import type { v1ListActuaryPerformancesResponse } from './generated/models/v1ListActuaryPerformancesResponse'
import type { v1ListBankFundPositionsResponse } from './generated/models/v1ListBankFundPositionsResponse'

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
