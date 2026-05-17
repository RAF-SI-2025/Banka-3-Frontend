import { api } from './client'
import type { v1Rate } from './generated/models/v1Rate'
import type { v1ListRatesResponse } from './generated/models/v1ListRatesResponse'
import type { v1UpsertRateRequest } from './generated/models/v1UpsertRateRequest'

export type Rate = v1Rate

export async function listRates(): Promise<v1ListRatesResponse> {
  const { data } = await api.get<v1ListRatesResponse>('/v1/exchange/rates')
  return data
}

export async function upsertRate(input: v1UpsertRateRequest): Promise<Rate> {
  const { data } = await api.post<Rate>('/v1/exchange/rates', input)
  return data
}
