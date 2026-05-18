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

// One in-flight restore per page load. Both the __root bootstrap and
// the /_authed route guard call restoreSession(); memoising the promise
// means a single /auth/refresh round-trip serves all callers and — the
// load-bearing part — the guard can *await* the same restore the
// bootstrap does instead of racing it (S35: a valid refresh-cookie
// session was bounced to /login on reload because the synchronous
// guard ran before the useEffect bootstrap).
let restorePromise: Promise<boolean> | null = null

/**
 * restoreSession ensures the auth store reflects the current session.
 *
 * No-op (true) if an access token is already in the store. Otherwise
 * it asks the gateway to refresh using the httpOnly cookie (JS can't
 * read it) and hydrates identity from /auth/me on success. The
 * cookie-refresh runs at most once per page load (concurrent callers
 * share it); the up-front accessToken check means logging back in
 * within the same tab works without a reload.
 */
export async function restoreSession(): Promise<boolean> {
  if (useAuthStore.getState().accessToken) return true
  if (!restorePromise) {
    restorePromise = (async () => {
      try {
        const { data } = await api.post<RefreshBody>('/v1/auth/refresh')
        const me = await api.get<MeBody>('/v1/auth/me', {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        })
        const perms = jwtDecodePermissions(data.accessToken) ?? []
        const principal = me.data.employee ?? me.data.client
        useAuthStore.getState().setLogin({
          accessToken: data.accessToken,
          userId: principal?.id ?? '',
          userKind: me.data.employee ? 'employee' : 'client',
          permissions: perms,
          firstName: principal?.firstName,
          lastName: principal?.lastName,
        })
        return true
      } catch {
        useAuthStore.getState().clear()
        return false
      }
    })()
  }
  return restorePromise
}

/**
 * useBootstrapAuth tries to restore a session on app start and returns
 * true once the attempt has finished (success or failure) so the root
 * layout can hold the first paint and avoid flashing the login screen.
 */
export function useBootstrapAuth(): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    restoreSession().finally(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return ready
}
