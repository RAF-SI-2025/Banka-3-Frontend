import { api } from './client'
import type { v1Account } from './generated/models/v1Account'
import type { v1AccountKind } from './generated/models/v1AccountKind'
import type { v1AccountStatus } from './generated/models/v1AccountStatus'
import type { bankaBankV1Currency } from './generated/models/bankaBankV1Currency'
import type { v1CreateAccountRequest } from './generated/models/v1CreateAccountRequest'
import type { v1ListAccountsResponse } from './generated/models/v1ListAccountsResponse'
import type { BankServiceUpdateAccountLimitsBody } from './generated/models/BankServiceUpdateAccountLimitsBody'
import type { BankServiceSetAccountStatusBody } from './generated/models/BankServiceSetAccountStatusBody'

export type Account = v1Account

export interface ListAccountsArgs {
  ownerClientId?: string
  kind?: v1AccountKind
  currency?: bankaBankV1Currency
  status?: v1AccountStatus
  page?: number
  pageSize?: number
}

export async function listAccounts(args: ListAccountsArgs = {}): Promise<v1ListAccountsResponse> {
  const { data } = await api.get<v1ListAccountsResponse>('/v1/accounts', { params: args })
  return data
}

export async function getAccount(id: string): Promise<Account> {
  const { data } = await api.get<Account>(`/v1/accounts/${id}`)
  return data
}

export async function createAccount(input: v1CreateAccountRequest): Promise<Account> {
  const { data } = await api.post<Account>('/v1/accounts', input)
  return data
}

export async function updateAccountLimits(
  id: string,
  input: BankServiceUpdateAccountLimitsBody,
): Promise<Account> {
  const { data } = await api.patch<Account>(`/v1/accounts/${id}/limits`, input)
  return data
}

export async function setAccountStatus(
  id: string,
  input: BankServiceSetAccountStatusBody,
): Promise<Account> {
  const { data } = await api.post<Account>(`/v1/accounts/${id}/status`, input)
  return data
}
