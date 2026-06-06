import { api } from './client'

// Local types for the audit log. The user proto gained these in this
// branch but the generated OpenAPI models aren't regenerated yet, so
// these mirror the grpc-gateway JSON (lowerCamelCase) shape by hand.
// Replace with generated v1AuditEntry once `make api-gen` has run.
export interface AuditEntry {
  id: string
  action: string
  actorId: string
  actorKind: string
  actorName: string
  targetId: string
  targetLabel: string
  oldValue: string
  newValue: string
  note: string
  createdAt: string
}

export interface ListAuditLogResponse {
  items: AuditEntry[]
  page: number
  pageSize: number
  total: string // int64 → string over JSON
}

export interface ListAuditLogArgs {
  action?: string
  actor?: string
  from?: string // RFC3339
  to?: string // RFC3339
  page?: number
  pageSize?: number
}

export async function listAuditLog(args: ListAuditLogArgs = {}): Promise<ListAuditLogResponse> {
  const { data } = await api.get<ListAuditLogResponse>('/v1/audit-log', { params: args })
  return data
}
