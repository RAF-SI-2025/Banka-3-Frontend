import { api } from './client'
import type { v1Card } from './generated/models/v1Card'
import type { v1CreateCardRequest } from './generated/models/v1CreateCardRequest'
import type { v1ListCardsResponse } from './generated/models/v1ListCardsResponse'
import type { BankServiceSetCardStatusBody } from './generated/models/BankServiceSetCardStatusBody'

export type Card = v1Card

export async function listCards(accountId?: string): Promise<v1ListCardsResponse> {
  const { data } = await api.get<v1ListCardsResponse>('/v1/cards', {
    params: accountId ? { accountId } : {},
  })
  return data
}

export async function createCard(input: v1CreateCardRequest): Promise<Card> {
  const { data } = await api.post<Card>('/v1/cards', input)
  return data
}

export async function setCardStatus(id: string, body: BankServiceSetCardStatusBody): Promise<Card> {
  const { data } = await api.post<Card>(`/v1/cards/${id}/status`, body)
  return data
}
