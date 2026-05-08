import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { Header } from '@/components/shell/header'
import { Sidebar, type NavItem } from '@/components/shell/sidebar'

export const Route = createFileRoute('/_authed/portal')({
  component: PortalLayout,
})

function PortalLayout() {
  const perms = useAuthStore((s) => s.permissions)

  const items: NavItem[] = [
    { to: '/portal', label: 'Zaposleni', hidden: !has(perms, Permissions.EmployeeRead) },
    { to: '/portal/clients', label: 'Klijenti', hidden: !has(perms, Permissions.ClientRead) },
    { to: '/portal/companies', label: 'Firme', hidden: !has(perms, Permissions.CompanyRead) },
    { to: '/portal/accounts', label: 'Računi', hidden: !has(perms, Permissions.AccountRead) },
    { to: '/portal/cards', label: 'Kartice', hidden: !has(perms, Permissions.CardRead) },
    { to: '/portal/loan-requests', label: 'Zahtevi za kredit', hidden: !has(perms, Permissions.LoanWrite) },
    { to: '/portal/loans', label: 'Krediti', hidden: !has(perms, Permissions.LoanRead) },
    { to: '/portal/exchange', label: 'Kursna lista', hidden: !has(perms, Permissions.ExchangeWrite) },
  ]

  return (
    <div className="flex min-h-screen flex-col">
      <Header title="Banka 3 — Portal" homeTo="/portal" />
      <div className="flex flex-1">
        <Sidebar items={items} />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
