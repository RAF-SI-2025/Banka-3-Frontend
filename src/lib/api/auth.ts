import { api } from './client'

export interface LoginInput {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  accessExpiresIn: number
  userId: string
  userKind: 'employee' | 'client'
  permissions: string[]
}

export async function login(input: LoginInput): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/v1/auth/login', input)
  return data
}

export async function logout(): Promise<void> {
  await api.post('/v1/auth/logout')
}

export async function activateAccount(token: string, newPassword: string): Promise<void> {
  await api.post('/v1/auth/activate', { token, newPassword })
}

export async function requestPasswordReset(email: string): Promise<void> {
  await api.post('/v1/auth/password-reset/request', { email })
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  await api.post('/v1/auth/password-reset/confirm', { token, newPassword })
}
