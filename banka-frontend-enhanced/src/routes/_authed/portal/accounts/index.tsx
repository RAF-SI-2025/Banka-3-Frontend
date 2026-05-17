import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { listAccounts } from '@/lib/api/accounts'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { keys } from '@/lib/query-keys'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { formatMoney, formatAccountNumber, currencyLabel } from '@/lib/format'
import { accountKindLabel, accountStatusLabel } from '@/lib/labels'
import { v1AccountKind } from '@/lib/api/generated/models/v1AccountKind'
import { v1AccountStatus } from '@/lib/api/generated/models/v1AccountStatus'
import { bankaBankV1Currency } from '@/lib/api/generated/models/bankaBankV1Currency'

export const Route = createFileRoute('/_authed/portal/accounts/')({
  component: PortalAccounts,
})

function PortalAccounts() {
  const navigate = useNavigate()
  const perms = useAuthStore((s) => s.permissions)
  const canRead = has(perms, Permissions.AccountRead)
  const canWrite = has(perms, Permissions.AccountWrite)

  const [kind, setKind] = useState<v1AccountKind>(v1AccountKind.ACCOUNT_KIND_UNSPECIFIED)
  const [status, setStatus] = useState<v1AccountStatus>(v1AccountStatus.ACCOUNT_STATUS_UNSPECIFIED)
  const [currency, setCurrency] = useState<bankaBankV1Currency>(bankaBankV1Currency.CURRENCY_UNSPECIFIED)
  const [page, setPage] = useState(1)

  const accounts = useQuery({
    queryKey: keys.account.list({ kind, status, currency, page }),
    queryFn: () => listAccounts({ kind, status, currency, page, pageSize: 50 }),
    enabled: canRead,
  })

  if (!canRead) return <p className="container py-8 text-foreground">Nemate dozvolu.</p>

  return (
    <main className="container space-y-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Računi</h1>
        {canWrite && (
          <Link to="/portal/accounts/new" search={{ ownerClientId: undefined }}>
            <Button>Otvori novi račun</Button>
          </Link>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Select value={kind} onChange={(e) => setKind(e.target.value as v1AccountKind)}>
          {Object.values(v1AccountKind).map((k) => (
            <option key={k} value={k}>
              {k === v1AccountKind.ACCOUNT_KIND_UNSPECIFIED ? 'Sve vrste' : accountKindLabel[k]}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value as v1AccountStatus)}>
          {Object.values(v1AccountStatus).map((s) => (
            <option key={s} value={s}>
              {s === v1AccountStatus.ACCOUNT_STATUS_UNSPECIFIED ? 'Svi statusi' : accountStatusLabel[s]}
            </option>
          ))}
        </Select>
        <Select value={currency} onChange={(e) => setCurrency(e.target.value as bankaBankV1Currency)}>
          {Object.values(bankaBankV1Currency).map((c) => (
            <option key={c} value={c}>
              {c === bankaBankV1Currency.CURRENCY_UNSPECIFIED ? 'Sve valute' : currencyLabel(c)}
            </option>
          ))}
        </Select>
      </div>

      {accounts.data && (
        <Table>
          <THead>
            <TR>
              <TH>Broj</TH>
              <TH>Vrsta</TH>
              <TH>Valuta</TH>
              <TH className="text-right">Stanje</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {accounts.data.accounts?.map((a) => (
              <TR
                key={a.id}
                onClick={() => navigate({ to: '/portal/accounts/$id', params: { id: a.id! } })}
              >
                <TD className="font-mono text-xs">{formatAccountNumber(a.number)}</TD>
                <TD>{accountKindLabel[a.kind!]}</TD>
                <TD>{currencyLabel(a.currency!)}</TD>
                <TD className="text-right">{formatMoney(a.balance, currencyLabel(a.currency!))}</TD>
                <TD>
                  <Badge tone={a.status === v1AccountStatus.ACCOUNT_STATUS_ACTIVE ? 'green' : 'red'}>
                    {accountStatusLabel[a.status!]}
                  </Badge>
                </TD>
              </TR>
            ))}
            {(!accounts.data.accounts || accounts.data.accounts.length === 0) && (
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
          disabled={!accounts.data || page * 50 >= Number(accounts.data.total ?? 0)}
          onClick={() => setPage((p) => p + 1)}
        >
          Sledeća
        </Button>
      </div>
    </main>
  )
}
