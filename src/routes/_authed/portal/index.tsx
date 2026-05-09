import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has, type Permission } from '@/lib/permissions'

// /portal lands on a small dashboard. We deliberately don't auto-redirect
// to /portal/employees: a non-admin employee (e.g. RoleEmployeeAgent has
// no employee.read) would bounce into a 403 body. Instead, render tiles
// for whichever sections the current principal can actually open.
export const Route = createFileRoute('/_authed/portal/')({
  component: PortalLanding,
})

interface Tile {
  to: string
  label: string
  description: string
  perm: Permission
}

const tiles: Tile[] = [
  { to: '/portal/employees', label: 'Zaposleni', description: 'Lista zaposlenih i upravljanje nalozima.', perm: Permissions.EmployeeRead },
  { to: '/portal/clients', label: 'Klijenti', description: 'Pretraga klijenata i izmena podataka.', perm: Permissions.ClientRead },
  { to: '/portal/companies', label: 'Firme', description: 'Pravna lica i ovlašćena lica.', perm: Permissions.CompanyRead },
  { to: '/portal/accounts', label: 'Računi', description: 'Otvaranje i pregled računa klijenata.', perm: Permissions.AccountRead },
  { to: '/portal/cards', label: 'Kartice', description: 'Pregled i upravljanje karticama.', perm: Permissions.CardRead },
  { to: '/portal/loan-requests', label: 'Zahtevi za kredit', description: 'Odobravanje ili odbijanje zahteva.', perm: Permissions.LoanWrite },
  { to: '/portal/loans', label: 'Krediti', description: 'Pregled odobrenih kredita.', perm: Permissions.LoanRead },
  { to: '/portal/exchange', label: 'Kursna lista', description: 'Uređivanje kursne liste banke.', perm: Permissions.ExchangeWrite },
]

function PortalLanding() {
  const perms = useAuthStore((s) => s.permissions)
  const firstName = useAuthStore((s) => s.firstName)
  const visible = tiles.filter((t) => has(perms, t.perm))

  return (
    <main className="container space-y-8 py-10">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">Portal</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Dobrodošli{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="text-sm text-muted-foreground">Izaberite sekciju portala.</p>
      </header>

      {visible.length === 0 ? (
        <p className="text-foreground">
          Vaš nalog trenutno nema pristup nijednoj sekciji portala. Kontaktirajte administratora.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="group rounded-lg border border-border bg-surface p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated"
            >
              <div className="font-semibold tracking-tight group-hover:text-primary">{t.label}</div>
              <div className="mt-1 text-sm text-muted-foreground">{t.description}</div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
