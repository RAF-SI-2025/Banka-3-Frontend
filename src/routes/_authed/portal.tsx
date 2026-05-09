import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has, hasAny } from '@/lib/permissions'
import { Header } from '@/components/shell/header'
import { Sidebar, type NavItem } from '@/components/shell/sidebar'

// /portal/* is the employee back-office. Clients have no business
// here — even if a route renders an empty "Nemate dozvolu" body, we
// shouldn't show the chrome. Redirect them straight to /banking.
export const Route = createFileRoute('/_authed/portal')({
  beforeLoad: () => {
    const { userKind } = useAuthStore.getState()
    if (userKind === 'client') throw redirect({ to: '/banking' })
  },
  component: PortalLayout,
})

function PortalLayout() {
  const perms = useAuthStore((s) => s.permissions)

  const items: NavItem[] = [
    { to: '/portal', label: 'Početna' },
    { to: '/portal/employees', label: 'Zaposleni', hidden: !has(perms, Permissions.EmployeeRead) },
    { to: '/portal/clients', label: 'Klijenti', hidden: !has(perms, Permissions.ClientRead) },
    { to: '/portal/companies', label: 'Firme', hidden: !has(perms, Permissions.CompanyRead) },
    { to: '/portal/accounts', label: 'Računi', hidden: !has(perms, Permissions.AccountRead) },
    { to: '/portal/cards', label: 'Kartice', hidden: !has(perms, Permissions.CardRead) },
    { to: '/portal/loan-requests', label: 'Zahtevi za kredit', hidden: !has(perms, Permissions.LoanWrite) },
    { to: '/portal/loans', label: 'Krediti', hidden: !has(perms, Permissions.LoanRead) },
    { to: '/portal/exchange', label: 'Kursna lista', hidden: !has(perms, Permissions.ExchangeWrite) },
    {
      to: '/portal/trgovina',
      label: 'Trgovina',
      hidden: !hasAny(perms, [Permissions.Actuary, Permissions.ActuarySupervisor, Permissions.ActuaryAgent, Permissions.Admin]),
    },
    {
      to: '/portal/trgovina/nalozi',
      label: 'Pregled naloga',
      hidden: !hasAny(perms, [Permissions.Actuary, Permissions.ActuarySupervisor, Permissions.ActuaryAgent, Permissions.Admin]),
    },
    {
      to: '/portal/portfolio',
      label: 'Portfolio',
      hidden: !hasAny(perms, [Permissions.Actuary, Permissions.ActuarySupervisor, Permissions.ActuaryAgent, Permissions.Admin]),
    },
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
