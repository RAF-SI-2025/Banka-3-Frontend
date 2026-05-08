import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { listClients } from '@/lib/api/clients'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { keys } from '@/lib/query-keys'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/_authed/portal/clients/')({
  component: ClientsList,
})

function ClientsList() {
  const perms = useAuthStore((s) => s.permissions)
  const canRead = has(perms, Permissions.ClientRead)
  const canWrite = has(perms, Permissions.ClientWrite)

  const [emailQuery, setEmailQuery] = useState('')
  const [nameQuery, setNameQuery] = useState('')
  const [page, setPage] = useState(1)

  const clients = useQuery({
    queryKey: keys.client.list({ emailQuery, nameQuery, page }),
    queryFn: () => listClients({ emailQuery, nameQuery, page, pageSize: 25 }),
    enabled: canRead,
  })

  if (!canRead) return <p className="container py-8 text-gray-700">Nemate dozvolu za pristup.</p>

  return (
    <main className="container space-y-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Klijenti</h1>
        {canWrite && (
          <Link to="/portal/clients/new">
            <Button>Novi klijent</Button>
          </Link>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Input placeholder="Email…" value={emailQuery} onChange={(e) => setEmailQuery(e.target.value)} />
        <Input placeholder="Ime/prezime…" value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} />
      </div>

      {clients.data && (
        <Table>
          <THead>
            <TR>
              <TH>Ime i prezime</TH>
              <TH>Email</TH>
              <TH>Telefon</TH>
              <TH>Aktivan</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {clients.data.clients?.map((c) => (
              <TR key={c.id}>
                <TD>{c.firstName} {c.lastName}</TD>
                <TD>{c.email}</TD>
                <TD>{c.phone}</TD>
                <TD>
                  <Badge tone={c.active ? 'green' : 'red'}>{c.active ? 'Da' : 'Ne'}</Badge>
                </TD>
                <TD>
                  <Link to="/portal/clients/$id" params={{ id: c.id! }} className="text-blue-600 hover:underline">
                    Detalji
                  </Link>
                </TD>
              </TR>
            ))}
            {(!clients.data.clients || clients.data.clients.length === 0) && (
              <EmptyRow colSpan={5}>Nema klijenata.</EmptyRow>
            )}
          </TBody>
        </Table>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          Prethodna
        </Button>
        <span className="text-sm text-gray-600">Strana {page}</span>
        <Button variant="secondary" onClick={() => setPage((p) => p + 1)}>
          Sledeća
        </Button>
      </div>
    </main>
  )
}
