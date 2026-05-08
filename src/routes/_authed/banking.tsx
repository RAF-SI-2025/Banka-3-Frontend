import { createFileRoute, Outlet } from '@tanstack/react-router'
import { Header } from '@/components/shell/header'
import { Sidebar, type NavItem } from '@/components/shell/sidebar'

export const Route = createFileRoute('/_authed/banking')({
  component: BankingLayout,
})

function BankingLayout() {
  const items: NavItem[] = [
    { to: '/banking', label: 'Početna' },
    { to: '/banking/racuni', label: 'Računi' },
    { to: '/banking/kartice', label: 'Kartice' },
    { to: '/banking/placanja', label: 'Plaćanja' },
    { to: '/banking/transferi', label: 'Transferi' },
    { to: '/banking/menjacnica', label: 'Menjačnica' },
    { to: '/banking/primaoci', label: 'Primaoci' },
    { to: '/banking/krediti', label: 'Krediti' },
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
