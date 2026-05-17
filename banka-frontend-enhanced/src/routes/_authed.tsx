import { useEffect } from 'react'
import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/auth/store'

export const Route = createFileRoute('/_authed')({
  beforeLoad: () => {
    const { accessToken } = useAuthStore.getState()
    if (!accessToken) throw redirect({ to: '/login' })
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
