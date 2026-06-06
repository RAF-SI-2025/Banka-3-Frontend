import { createFileRoute, Outlet, redirect, useRouterState } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { Header } from '@/components/shell/header'
import { Sidebar, type NavItem } from '@/components/shell/sidebar'
import { RouteErrorBoundary } from '@/components/shell/error-boundary'

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
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const items: NavItem[] = [
    { to: '/banking', label: 'Početna' },
    { to: '/banking/racuni', label: 'Računi' },
    { to: '/banking/kartice', label: 'Kartice' },
    { to: '/banking/placanja', label: 'Plaćanja' },
    { to: '/banking/transferi', label: 'Transferi' },
    { to: '/banking/menjacnica', label: 'Menjačnica' },
    { to: '/banking/primaoci', label: 'Primaoci' },
    { to: '/banking/krediti', label: 'Krediti' },
    { to: '/banking/portfolio', label: 'Portfolio', hidden: !has(perms, Permissions.TradingClient) },
    { to: '/banking/trgovina', label: 'Trgovina', hidden: !has(perms, Permissions.TradingClient) },
    { to: '/banking/trgovina/nalozi', label: '↳ Moji nalozi', hidden: !has(perms, Permissions.TradingClient) },
    { to: '/banking/trgovina/watchlist', label: '↳ Liste za praćenje', hidden: !has(perms, Permissions.TradingClient) },
    { to: '/banking/otc', label: 'OTC', hidden: !has(perms, Permissions.TradingClient) },
    { to: '/banking/otc/ponude', label: '↳ Aktivne ponude', hidden: !has(perms, Permissions.TradingClient) },
    { to: '/banking/otc/ugovori', label: '↳ Sklopljeni ugovori', hidden: !has(perms, Permissions.TradingClient) },
    { to: '/banking/otc/istorija', label: '↳ Istorija pregovora', hidden: !has(perms, Permissions.TradingClient) },
    { to: '/banking/otc/eksterno', label: 'Eksterni OTC', hidden: !has(perms, Permissions.TradingClient) },
    { to: '/banking/otc/eksterno-ponude', label: '↳ Eksterne ponude', hidden: !has(perms, Permissions.TradingClient) },
    { to: '/banking/otc/eksterno-ugovori', label: '↳ Eksterni ugovori', hidden: !has(perms, Permissions.TradingClient) },
    { to: '/banking/fondovi', label: 'Fondovi', hidden: !has(perms, Permissions.TradingClient) },
  ]

  return (
    <div className="flex min-h-screen flex-col">
      <Header title="Banka 3" homeTo="/banking" />
      <div className="flex flex-1">
        <Sidebar items={items} />
        <main className="flex-1">
          <RouteErrorBoundary resetKey={pathname}>
            <Outlet />
          </RouteErrorBoundary>
        </main>
      </div>
    </div>
  )
}
