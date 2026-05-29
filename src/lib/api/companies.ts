import { api } from './client'
import type { v1Company } from './generated/models/v1Company'
import type { v1AuthorizedPerson } from './generated/models/v1AuthorizedPerson'
import type { v1CreateCompanyRequest } from './generated/models/v1CreateCompanyRequest'
import type { v1CreateAuthorizedPersonRequest } from './generated/models/v1CreateAuthorizedPersonRequest'
import type { v1ListCompaniesResponse } from './generated/models/v1ListCompaniesResponse'
import type { v1ListAuthorizedPersonsResponse } from './generated/models/v1ListAuthorizedPersonsResponse'
import type { BankServiceUpdateCompanyBody } from './generated/models/BankServiceUpdateCompanyBody'

export type Company = v1Company
export type AuthorizedPerson = v1AuthorizedPerson

export interface ListCompaniesArgs {
  nameQuery?: string
  registryIdQuery?: string
  page?: number
  pageSize?: number
}

export async function listCompanies(args: ListCompaniesArgs = {}): Promise<v1ListCompaniesResponse> {
  const { data } = await api.get<v1ListCompaniesResponse>('/v1/companies', { params: args })
  return data
}

export async function getCompany(id: string): Promise<Company> {
  const { data } = await api.get<Company>(`/v1/companies/${id}`)
  return data
}

export async function createCompany(input: v1CreateCompanyRequest): Promise<Company> {
  const { data } = await api.post<Company>('/v1/companies', input)
  return data
}

export async function updateCompany(
  id: string,
  input: BankServiceUpdateCompanyBody,
): Promise<Company> {
  const { data } = await api.patch<Company>(`/v1/companies/${id}`, input)
  return data
}

export async function listAuthorizedPersons(companyId?: string): Promise<v1ListAuthorizedPersonsResponse> {
  const { data } = await api.get<v1ListAuthorizedPersonsResponse>('/v1/authorized-persons', {
    params: companyId ? { companyId } : {},
  })
  return data
}

export async function createAuthorizedPerson(
  input: v1CreateAuthorizedPersonRequest,
): Promise<AuthorizedPerson> {
  const { data } = await api.post<AuthorizedPerson>('/v1/authorized-persons', input)
  return data
}
