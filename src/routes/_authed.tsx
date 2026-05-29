import { useEffect } from 'react'
import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/auth/store'
import { restoreSession } from '@/lib/auth/use-auth'

export const Route = createFileRoute('/_authed')({
  // Await the cookie-based session restore before deciding. The store
  // is sessionStorage-backed (empty after a fresh load / closed tab),
  // so a synchronous accessToken check here redirected to /login
  // before the refresh-cookie bootstrap could run — a valid session
  // looked dead on reload (S35). restoreSession() is memoised, so this
  // shares the one /auth/refresh the root bootstrap already performs.
  beforeLoad: async () => {
    if (!(await restoreSession())) {
      throw redirect({ to: '/login' })
    }
  },
  component: AuthedShell,
})

// Subscribes to the auth store so that when the axios refresh-flow
// clears the token mid-page (spec C3-tests S35: expired session on
// submit), the user is bounced to /login instead of being left on
// a route that just stops working.
function AuthedShell() {
  const navigate = useNavigate()
  const accessToken = useAuthStore((s) => s.accessToken)
  useEffect(() => {
    if (!accessToken) {
      navigate({ to: '/login' })
    }
  }, [accessToken, navigate])
  return <Outlet />
}
