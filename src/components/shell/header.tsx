import { Link, useNavigate } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { logout } from '@/lib/api/auth'
import { useAuthStore } from '@/lib/auth/store'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/shell/theme-toggle'
import { NotificationBell } from '@/components/shell/notification-bell'

export function Header({ title, homeTo }: { title: string; homeTo: string }) {
  const navigate = useNavigate()
  const firstName = useAuthStore((s) => s.firstName)
  const lastName = useAuthStore((s) => s.lastName)
  const userId = useAuthStore((s) => s.userId)
  const clear = useAuthStore((s) => s.clear)
  const fullName = [firstName, lastName].filter(Boolean).join(' ')
  const greeting = fullName || userId || ''
  const initials =
    (firstName?.[0] ?? '') + (lastName?.[0] ?? '') || (userId?.[0] ?? '?').toUpperCase()

  async function onLogout() {
    try {
      await logout()
    } finally {
      clear()
      navigate({ to: '/login' })
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface/85 px-6 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
      <Link to={homeTo} className="flex items-center gap-2 text-sm font-semibold tracking-tight">
        <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground shadow-soft">
          B3
        </span>
        <span className="text-foreground">{title}</span>
      </Link>
      <div className="flex items-center gap-2">
        {greeting && (
          <div className="hidden items-center gap-2 pr-2 text-sm sm:flex">
            <span className="grid size-7 place-items-center rounded-full bg-primary-soft text-xs font-semibold uppercase text-primary-soft-foreground">
              {initials.slice(0, 2)}
            </span>
            <span className="text-muted-foreground">{greeting}</span>
          </div>
        )}
        <NotificationBell />
        <ThemeToggle />
        <Button variant="ghost" size="sm" onClick={onLogout}>
          <LogOut />
          <span className="hidden sm:inline">Odjava</span>
        </Button>
      </div>
    </header>
  )
}
