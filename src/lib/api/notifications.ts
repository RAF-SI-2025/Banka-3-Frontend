import { api } from './client'

// Local types for the in-app notification feed. The backend's notif
// proto was extended in this branch but the generated OpenAPI models
// haven't been regenerated yet, so these mirror the grpc-gateway JSON
// (lowerCamelCase) shape by hand. Replace with generated v1Notification
// once `make proto` + the FE type codegen have run.
export interface Notification {
  id: string
  userId: string
  userKind: string
  kind: string
  title: string
  body: string
  read: boolean
  readAt: string
  createdAt: string
}

export interface ListNotificationsResponse {
  items: Notification[]
  page: number
  pageSize: number
  total: string // int64 → string over JSON
  unread: string
}

export interface ListNotificationsArgs {
  page?: number
  pageSize?: number
  unreadOnly?: boolean
}

export async function listNotifications(
  args: ListNotificationsArgs = {},
): Promise<ListNotificationsResponse> {
  const { data } = await api.get<ListNotificationsResponse>('/v1/notifications', { params: args })
  return data
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const { data } = await api.post<Notification>(`/v1/notifications/${id}/read`, {})
  return data
}

export async function markAllNotificationsRead(): Promise<{ marked: string }> {
  const { data } = await api.post<{ marked: string }>('/v1/notifications/read-all', {})
  return data
}
