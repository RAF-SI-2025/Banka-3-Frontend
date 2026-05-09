import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { listEmployees } from '@/lib/api/employees'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const Route = createFileRoute('/_authed/portal/employees/')({
  component: EmployeesPage,
})

function EmployeesPage() {
  const perms = useAuthStore((s) => s.permissions)
  const canRead = has(perms, Permissions.EmployeeRead)
  const canWrite = has(perms, Permissions.EmployeeWrite)

  const [emailQuery, setEmailQuery] = useState('')
  const [nameQuery, setNameQuery] = useState('')
  const [positionQuery, setPositionQuery] = useState('')
  const [page, setPage] = useState(1)

  const employees = useQuery({
    queryKey: keys.employee.list({ emailQuery, nameQuery, positionQuery, page }),
    queryFn: () => listEmployees({ emailQuery, nameQuery, positionQuery, page, pageSize: 25 }),
    enabled: canRead,
  })

  if (!canRead) {
    return (
      <main className="container py-8">
        <p className="text-gray-700">Nemate dozvolu za pristup ovoj stranici.</p>
      </main>
    )
  }

  return (
    <main className="container space-y-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Zaposleni</h1>
        {canWrite && (
          <Link to="/portal/employees/new">
            <Button>Novi zaposleni</Button>
          </Link>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Input placeholder="Email…" value={emailQuery} onChange={(e) => setEmailQuery(e.target.value)} />
        <Input placeholder="Ime/prezime…" value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} />
        <Input placeholder="Pozicija…" value={positionQuery} onChange={(e) => setPositionQuery(e.target.value)} />
      </div>

      {employees.isLoading && <p className="text-gray-500">Učitavanje…</p>}
      {employees.isError && <p className="text-red-600">Greška pri učitavanju.</p>}
      {employees.data && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Ime i prezime</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Pozicija</th>
                <th className="px-4 py-2 font-medium">Telefon</th>
                <th className="px-4 py-2 font-medium">Aktivan</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {employees.data.employees?.map((e) => (
                <tr key={e.id} className="border-t border-gray-100">
                  <td className="px-4 py-2">{e.firstName} {e.lastName}</td>
                  <td className="px-4 py-2">{e.email}</td>
                  <td className="px-4 py-2">{e.position}</td>
                  <td className="px-4 py-2">{e.phone}</td>
                  <td className="px-4 py-2">{e.active ? 'Da' : 'Ne'}</td>
                  <td className="px-4 py-2">
                    {canWrite && (
                      <Link to="/portal/employees/$id" params={{ id: e.id }} className="text-blue-600 hover:underline">
                        Izmeni
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
              {(!employees.data.employees || employees.data.employees.length === 0) && (
                <tr>
                  <td className="px-4 py-3 text-gray-500" colSpan={6}>
                    Nema rezultata.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          Prethodna
        </Button>
        <span className="text-sm text-gray-600">Strana {page}</span>
        <Button
          variant="secondary"
          disabled={!employees.data || page * 25 >= Number(employees.data.total ?? 0)}
          onClick={() => setPage((p) => p + 1)}
        >
          Sledeća
        </Button>
      </div>
    </main>
  )
}
