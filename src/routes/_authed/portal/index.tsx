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
    <main className="container space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Dobrodošli{firstName ? `, ${firstName}` : ''}</h1>
        <p className="text-sm text-gray-500">Izaberite sekciju portala.</p>
      </div>

      {visible.length === 0 ? (
        <p className="text-gray-700">
          Vaš nalog trenutno nema pristup nijednoj sekciji portala. Kontaktirajte administratora.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="rounded-lg border border-gray-200 bg-white p-4 transition hover:border-gray-400"
            >
              <div className="font-semibold">{t.label}</div>
              <div className="mt-1 text-sm text-gray-500">{t.description}</div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
