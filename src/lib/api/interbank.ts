import { api } from './client'

// Inter-bank observability & control (celina 5). Supervisor/admin-facing
// wrappers for the "Međubankarske transakcije" portal: 2PC transaction
// status tracking, the comms / audit-log viewer, and blacklist
// management.
//
// Types are declared inline rather than imported from generated/ because
// these endpoints are new and the checked-in OpenAPI types lag the
// backend proto on this branch. A future `npm run api:gen` will add
// matching v1Interbank* models; the wrappers can switch to them then
// without changing call sites.

export type InterbankTxStatus =
  | 'pending'
  | 'failed'
  | 'prepared'
  | 'committed'
  | 'rolled_back'
  | string

export type InterbankDirection = 'inbound' | 'outbound' | string

export type InterbankMessageType = 'NEW_TX' | 'COMMIT_TX' | 'ROLLBACK_TX' | string

export interface InterbankTransaction {
  senderRoutingNumber?: number
  transactionId?: string
  direction?: InterbankDirection
  localAccountNumber?: string
  remoteAccountNumber?: string
  currency?: string
  amount?: string
  purpose?: string
  reservationId?: string
  opId?: string
  status?: InterbankTxStatus
  lastError?: string
  createdAt?: string
  updatedAt?: string
}

export interface ListInterbankTransactionsResponse {
  transactions?: InterbankTransaction[]
  page?: number
  pageSize?: number
  total?: string
}

export interface InterbankMessage {
  senderRoutingNumber?: number
  idempotenceKey?: string
  messageType?: InterbankMessageType
  transactionId?: string
  responseStatus?: number
  responseBody?: string
  createdAt?: string
  updatedAt?: string
}

export interface ListInterbankAuditLogResponse {
  messages?: InterbankMessage[]
  page?: number
  pageSize?: number
  total?: string
}

export interface InterbankBlacklistEntry {
  senderRoutingNumber?: number
  reason?: string
  blockedBy?: string
  blockedAt?: string
  unblockedAt?: string
  active?: boolean
}

export interface ListInterbankBlacklistResponse {
  entries?: InterbankBlacklistEntry[]
}

export interface ListInterbankTransactionsArgs {
  senderRoutingNumber?: number
  status?: InterbankTxStatus
  direction?: InterbankDirection
  // ISO timestamps; both optional.
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export interface ListInterbankAuditLogArgs {
  senderRoutingNumber?: number
  messageType?: InterbankMessageType
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

// grpc-gateway maps query params off the proto field names in camelCase.
// Drop empty / zero-valued filters so the backend treats them as "any".
function cleanParams(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(args)) {
    if (v === undefined || v === null || v === '' || v === 0) continue
    out[k] = v
  }
  return out
}

export async function listInterbankTransactions(
  args: ListInterbankTransactionsArgs = {},
): Promise<ListInterbankTransactionsResponse> {
  const { data } = await api.get<ListInterbankTransactionsResponse>(
    '/v1/interbank/transactions',
    { params: cleanParams(args as Record<string, unknown>) },
  )
  return data
}

export async function listInterbankAuditLog(
  args: ListInterbankAuditLogArgs = {},
): Promise<ListInterbankAuditLogResponse> {
  const { data } = await api.get<ListInterbankAuditLogResponse>('/v1/interbank/audit-log', {
    params: cleanParams(args as Record<string, unknown>),
  })
  return data
}

export async function listInterbankBlacklist(
  activeOnly = false,
): Promise<ListInterbankBlacklistResponse> {
  const { data } = await api.get<ListInterbankBlacklistResponse>('/v1/interbank/blacklist', {
    params: activeOnly ? { activeOnly: true } : {},
  })
  return data
}

export async function blockInterbankPartner(
  senderRoutingNumber: number,
  reason: string,
): Promise<InterbankBlacklistEntry> {
  const { data } = await api.post<InterbankBlacklistEntry>('/v1/interbank/blacklist', {
    senderRoutingNumber,
    reason,
  })
  return data
}

export async function unblockInterbankPartner(
  senderRoutingNumber: number,
): Promise<InterbankBlacklistEntry> {
  const { data } = await api.delete<InterbankBlacklistEntry>(
    `/v1/interbank/blacklist/${senderRoutingNumber}`,
  )
  return data
}
