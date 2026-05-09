import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { listEmployees } from '@/lib/api/employees'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'

export const Route = createFileRoute('/_authed/portal/employees/')({
  component: EmployeesPage,
})

function EmployeesPage() {
  const navigate = useNavigate()
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
        <p className="text-foreground">Nemate dozvolu za pristup ovoj stranici.</p>
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

      {employees.isLoading && <p className="text-muted-foreground">Učitavanje…</p>}
      {employees.isError && <p className="text-danger">Greška pri učitavanju.</p>}
      {employees.data && (
        <Table>
          <THead>
            <TR>
              <TH>Ime i prezime</TH>
              <TH>Email</TH>
              <TH>Pozicija</TH>
              <TH>Telefon</TH>
              <TH>Aktivan</TH>
            </TR>
          </THead>
          <TBody>
            {employees.data.employees?.map((e) => (
              <TR
                key={e.id}
                onClick={
                  canWrite ? () => navigate({ to: '/portal/employees/$id', params: { id: e.id! } }) : undefined
                }
              >
                <TD>{e.firstName} {e.lastName}</TD>
                <TD>{e.email}</TD>
                <TD>{e.position}</TD>
                <TD>{e.phone}</TD>
                <TD>{e.active ? 'Da' : 'Ne'}</TD>
              </TR>
            ))}
            {(!employees.data.employees || employees.data.employees.length === 0) && (
              <EmptyRow colSpan={5}>Nema rezultata.</EmptyRow>
            )}
          </TBody>
        </Table>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          Prethodna
        </Button>
        <span className="text-sm text-muted-foreground">Strana {page}</span>
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
