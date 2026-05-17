import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { listCompanies } from '@/lib/api/companies'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { keys } from '@/lib/query-keys'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const Route = createFileRoute('/_authed/portal/companies/')({
  component: CompaniesList,
})

function CompaniesList() {
  const navigate = useNavigate()
  const perms = useAuthStore((s) => s.permissions)
  const canRead = has(perms, Permissions.CompanyRead)
  const canWrite = has(perms, Permissions.CompanyWrite)

  const [nameQuery, setNameQuery] = useState('')
  const [registryIdQuery, setRegistryIdQuery] = useState('')
  const [page, setPage] = useState(1)

  const companies = useQuery({
    queryKey: keys.company.list({ nameQuery, registryIdQuery, page }),
    queryFn: () => listCompanies({ nameQuery, registryIdQuery, page, pageSize: 25 }),
    enabled: canRead,
  })

  if (!canRead) return <p className="container py-8 text-foreground">Nemate dozvolu.</p>

  return (
    <main className="container space-y-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Firme</h1>
        {canWrite && (
          <Link to="/portal/companies/new">
            <Button>Nova firma</Button>
          </Link>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Input placeholder="Naziv…" value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} />
        <Input placeholder="Matični broj…" value={registryIdQuery} onChange={(e) => setRegistryIdQuery(e.target.value)} />
      </div>

      {companies.data && (
        <Table>
          <THead>
            <TR>
              <TH>Naziv</TH>
              <TH>Matični broj</TH>
              <TH>PIB</TH>
              <TH>Šifra delatnosti</TH>
            </TR>
          </THead>
          <TBody>
            {companies.data.companies?.map((c) => (
              <TR
                key={c.id}
                onClick={() => navigate({ to: '/portal/companies/$id', params: { id: c.id! } })}
              >
                <TD>{c.name}</TD>
                <TD className="font-mono text-xs">{c.registryId}</TD>
                <TD className="font-mono text-xs">{c.taxId}</TD>
                <TD>{c.activityCode}</TD>
              </TR>
            ))}
            {(!companies.data.companies || companies.data.companies.length === 0) && (
              <EmptyRow colSpan={4}>Nema firmi.</EmptyRow>
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
          disabled={!companies.data || page * 25 >= Number(companies.data.total ?? 0)}
          onClick={() => setPage((p) => p + 1)}
        >
          Sledeća
        </Button>
      </div>
    </main>
  )
}
