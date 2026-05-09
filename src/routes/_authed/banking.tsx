import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { Header } from '@/components/shell/header'
import { Sidebar, type NavItem } from '@/components/shell/sidebar'

// /banking/* is the client-facing app. Employees use /portal — push
// them there if they wander in.
export const Route = createFileRoute('/_authed/banking')({
  beforeLoad: () => {
    const { userKind } = useAuthStore.getState()
    if (userKind === 'employee') throw redirect({ to: '/portal' })
  },
  component: BankingLayout,
})

function BankingLayout() {
  const perms = useAuthStore((s) => s.permissions)
  const items: NavItem[] = [
    { to: '/banking', label: 'Početna' },
    { to: '/banking/racuni', label: 'Računi' },
    { to: '/banking/kartice', label: 'Kartice' },
    { to: '/banking/placanja', label: 'Plaćanja' },
    { to: '/banking/transferi', label: 'Transferi' },
    { to: '/banking/menjacnica', label: 'Menjačnica' },
    { to: '/banking/primaoci', label: 'Primaoci' },
    { to: '/banking/krediti', label: 'Krediti' },
    { to: '/banking/trgovina', label: 'Trgovina', hidden: !has(perms, Permissions.TradingClient) },
  ]

  return (
    <div className="flex min-h-screen flex-col">
      <Header title="Banka 3" homeTo="/banking" />
      <div className="flex flex-1">
        <Sidebar items={items} />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
