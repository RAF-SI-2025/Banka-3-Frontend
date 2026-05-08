import { createFileRoute, Outlet, redirect, Link, useNavigate } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/auth/store'
import { logout } from '@/lib/api/auth'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_authed')({
  beforeLoad: () => {
    const { accessToken } = useAuthStore.getState()
    if (!accessToken) throw redirect({ to: '/login' })
  },
  component: AuthedLayout,
})

function AuthedLayout() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.userId)
  const clear = useAuthStore((s) => s.clear)

  async function onLogout() {
    try {
      await logout()
    } finally {
      clear()
      navigate({ to: '/login' })
    }
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <Link to="/portal" className="font-semibold">
          Banka 3 — Portal
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500">{userId}</span>
          <Button variant="secondary" onClick={onLogout}>
            Odjava
          </Button>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
