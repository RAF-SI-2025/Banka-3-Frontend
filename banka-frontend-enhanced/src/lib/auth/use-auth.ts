import { useEffect, useState } from 'react'
import { api } from '@/lib/api/client'
import { useAuthStore } from './store'
import { jwtDecodePermissions } from './jwt'

interface RefreshBody {
  accessToken: string
  accessExpiresIn: number
}

interface MeBody {
  employee?: { id: string; permissions: string[]; firstName?: string; lastName?: string }
  client?: { id: string; permissions: string[]; firstName?: string; lastName?: string }
}

/**
 * useBootstrapAuth tries to restore a session on app start: ask the
 * gateway to refresh (cookie-only) and, on success, hydrate the store.
 * Returns true once the bootstrap attempt has finished (success or
 * failure) so route guards can avoid flashing the login screen.
 */
export function useBootstrapAuth(): boolean {
  const [ready, setReady] = useState(false)
  const setLogin = useAuthStore((s) => s.setLogin)
  const clear = useAuthStore((s) => s.clear)
  const existingAccessToken = useAuthStore((s) => s.accessToken)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.post<RefreshBody>('/v1/auth/refresh')
        const me = await api.get<MeBody>('/v1/auth/me', {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        })
        if (cancelled) return
        const perms = jwtDecodePermissions(data.accessToken) ?? []
        const principal = me.data.employee ?? me.data.client
        const userId = principal?.id ?? ''
        const userKind: 'employee' | 'client' = me.data.employee ? 'employee' : 'client'
        setLogin({
          accessToken: data.accessToken,
          userId,
          userKind,
          permissions: perms,
          firstName: principal?.firstName,
          lastName: principal?.lastName,
        })
      } catch {
        if (!cancelled && !existingAccessToken) clear()
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [setLogin, clear, existingAccessToken])

  return ready
}
