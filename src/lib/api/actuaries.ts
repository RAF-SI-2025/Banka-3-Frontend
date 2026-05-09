import { api } from './client'
import type { v1ActuaryInfo } from './generated/models/v1ActuaryInfo'
import type { v1ActuaryType } from './generated/models/v1ActuaryType'
import type { v1ListActuariesResponse } from './generated/models/v1ListActuariesResponse'
import type { v1RunDailyResetActuariesResponse } from './generated/models/v1RunDailyResetActuariesResponse'
import type { TradingServiceUpsertActuaryInfoBody } from './generated/models/TradingServiceUpsertActuaryInfoBody'

export type ActuaryInfo = v1ActuaryInfo

export interface ListActuariesArgs {
  emailQuery?: string
  nameQuery?: string
  type?: v1ActuaryType
  page?: number
  pageSize?: number
}

export async function listActuaries(args: ListActuariesArgs = {}): Promise<v1ListActuariesResponse> {
  const { data } = await api.get<v1ListActuariesResponse>('/v1/actuaries', { params: args })
  return data
}

export async function getActuaryInfo(employeeId: string): Promise<v1ActuaryInfo> {
  const { data } = await api.get<v1ActuaryInfo>(`/v1/actuaries/${encodeURIComponent(employeeId)}`)
  return data
}

// upsertActuary creates or updates the actuary_info row attached to
// an employee. Supervisors are forced to dailyLimit=0/needApproval=false
// server-side per spec p.38; pass them in anyway and let the server
// normalise.
export async function upsertActuary(
  employeeId: string,
  body: TradingServiceUpsertActuaryInfoBody,
): Promise<v1ActuaryInfo> {
  const { data } = await api.put<v1ActuaryInfo>(
    `/v1/actuaries/${encodeURIComponent(employeeId)}`,
    body,
  )
  return data
}

export async function updateActuaryLimit(employeeId: string, dailyLimitRsd: string): Promise<v1ActuaryInfo> {
  const { data } = await api.patch<v1ActuaryInfo>(
    `/v1/actuaries/${encodeURIComponent(employeeId)}/limit`,
    { dailyLimit: dailyLimitRsd },
  )
  return data
}

export async function setActuaryNeedApproval(employeeId: string, needApproval: boolean): Promise<v1ActuaryInfo> {
  const { data } = await api.patch<v1ActuaryInfo>(
    `/v1/actuaries/${encodeURIComponent(employeeId)}/need-approval`,
    { needApproval },
  )
  return data
}

export async function resetActuaryUsedLimit(employeeId: string): Promise<v1ActuaryInfo> {
  const { data } = await api.post<v1ActuaryInfo>(
    `/v1/actuaries/${encodeURIComponent(employeeId)}/used-limit/reset`,
    {},
  )
  return data
}

// runActuaryResetJob fires the daily-23:59-Belgrade cron manually.
// Useful for tests + manual reset; in production the cron runs
// itself.
export async function runActuaryResetJob(): Promise<v1RunDailyResetActuariesResponse> {
  const { data } = await api.post<v1RunDailyResetActuariesResponse>('/v1/actuaries/reset-job', {})
  return data
}
