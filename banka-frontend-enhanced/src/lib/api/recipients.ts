import { api } from './client'
import type { v1PaymentRecipient } from './generated/models/v1PaymentRecipient'
import type { v1ListPaymentRecipientsResponse } from './generated/models/v1ListPaymentRecipientsResponse'
import type { v1CreatePaymentRecipientRequest } from './generated/models/v1CreatePaymentRecipientRequest'
import type { BankServiceUpdatePaymentRecipientBody } from './generated/models/BankServiceUpdatePaymentRecipientBody'

export type Recipient = v1PaymentRecipient

export async function listRecipients(): Promise<v1ListPaymentRecipientsResponse> {
  const { data } = await api.get<v1ListPaymentRecipientsResponse>('/v1/payment-recipients')
  return data
}

export async function createRecipient(input: v1CreatePaymentRecipientRequest): Promise<Recipient> {
  const { data } = await api.post<Recipient>('/v1/payment-recipients', input)
  return data
}

export async function updateRecipient(
  id: string,
  input: BankServiceUpdatePaymentRecipientBody,
): Promise<Recipient> {
  const { data } = await api.patch<Recipient>(`/v1/payment-recipients/${id}`, input)
  return data
}

export async function deleteRecipient(id: string): Promise<void> {
  await api.delete(`/v1/payment-recipients/${id}`)
}
