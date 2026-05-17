import { api } from './client'
import type { v1Client } from './generated/models/v1Client'
import type { v1ListClientsResponse } from './generated/models/v1ListClientsResponse'
import type { v1CreateClientRequest } from './generated/models/v1CreateClientRequest'
import type { UserServiceUpdateClientBody } from './generated/models/UserServiceUpdateClientBody'

export type Client = v1Client

export interface ListClientsArgs {
  emailQuery?: string
  nameQuery?: string
  page?: number
  pageSize?: number
}

export async function listClients(args: ListClientsArgs = {}): Promise<v1ListClientsResponse> {
  const { data } = await api.get<v1ListClientsResponse>('/v1/clients', { params: args })
  return data
}

export async function getClient(id: string): Promise<Client> {
  const { data } = await api.get<Client>(`/v1/clients/${id}`)
  return data
}

export async function createClient(input: v1CreateClientRequest): Promise<Client> {
  const { data } = await api.post<Client>('/v1/clients', input)
  return data
}

export async function updateClient(id: string, input: UserServiceUpdateClientBody): Promise<Client> {
  const { data } = await api.patch<Client>(`/v1/clients/${id}`, input)
  return data
}
