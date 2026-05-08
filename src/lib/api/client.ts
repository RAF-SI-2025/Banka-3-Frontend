import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/lib/auth/store'

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'

let refreshInFlight: Promise<string | null> | null = null

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    if (!err.response || err.response.status !== 401) throw err
    const original = err.config as InternalAxiosRequestConfig & { _retry?: boolean }
    if (original._retry || isRefreshCall(original)) throw err

    original._retry = true
    const newToken = await refresh()
    if (!newToken) throw err
    original.headers.Authorization = `Bearer ${newToken}`
    return api.request(original)
  },
)

function isRefreshCall(cfg: InternalAxiosRequestConfig | undefined): boolean {
  return !!cfg?.url?.includes('/auth/refresh')
}

async function refresh(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    try {
      const { data } = await axios.post<{ accessToken: string; accessExpiresIn: number }>(
        `${API_BASE}/v1/auth/refresh`,
        {},
        { withCredentials: true },
      )
      useAuthStore.getState().setAccessToken(data.accessToken)
      return data.accessToken
    } catch {
      useAuthStore.getState().clear()
      return null
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}
