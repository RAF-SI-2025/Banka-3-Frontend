import { Link, useNavigate } from '@tanstack/react-router'
import { logout } from '@/lib/api/auth'
import { useAuthStore } from '@/lib/auth/store'
import { Button } from '@/components/ui/button'

export function Header({ title, homeTo }: { title: string; homeTo: string }) {
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
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
      <Link to={homeTo} className="font-semibold">
        {title}
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-500">{userId}</span>
        <Button variant="secondary" onClick={onLogout}>
          Odjava
        </Button>
      </div>
    </header>
  )
}
