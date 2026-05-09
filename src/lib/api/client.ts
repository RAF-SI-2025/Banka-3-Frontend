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

  // Idempotency-Key on every mutating request (per the project's API
  // conventions in CLAUDE.md). The gateway already accepts the header
  // (CORS allow-list); services hash it into a per-key result cache to
  // make retries safe. Callers can pre-set their own key (e.g. when
  // retrying explicitly) and we won't overwrite it.
  const method = (cfg.method ?? 'get').toLowerCase()
  if (method !== 'get' && method !== 'head' && method !== 'options') {
    if (!cfg.headers['Idempotency-Key']) {
      cfg.headers['Idempotency-Key'] = uuidv4()
    }
  }
  return cfg
})

// uuidv4 returns a RFC 4122 v4 UUID. We avoid pulling in the `uuid`
// package for one call site; crypto.randomUUID is available in every
// browser since 2022 and in Node 14.17+, well within our targets.
function uuidv4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback for environments without crypto.randomUUID — uses
  // Math.random which is non-cryptographic, but the key only needs to
  // be unique per request, not unguessable.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

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
