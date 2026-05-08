import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { listAccounts } from '@/lib/api/accounts'
import { useAuthStore } from '@/lib/auth/store'
import { keys } from '@/lib/query-keys'
import { formatMoney, formatAccountNumber, currencyLabel } from '@/lib/format'
import { accountKindLabel, accountStatusLabel } from '@/lib/labels'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { v1AccountStatus } from '@/lib/api/generated/models/v1AccountStatus'

export const Route = createFileRoute('/_authed/banking/racuni/')({
  component: AccountsList,
})

function AccountsList() {
  const userId = useAuthStore((s) => s.userId)
  const accounts = useQuery({
    queryKey: keys.account.list({ ownerClientId: userId }),
    queryFn: () => listAccounts({ ownerClientId: userId ?? undefined }),
    enabled: !!userId,
  })

  return (
    <main className="container space-y-4 py-8">
      <h1 className="text-2xl font-semibold">Računi</h1>
      {accounts.isLoading && <p className="text-gray-500">Učitavanje…</p>}
      {accounts.isError && <p className="text-red-600">Greška pri učitavanju.</p>}
      {accounts.data && (
        <Table>
          <THead>
            <TR>
              <TH>Naziv</TH>
              <TH>Broj računa</TH>
              <TH>Vrsta</TH>
              <TH>Valuta</TH>
              <TH className="text-right">Stanje</TH>
              <TH className="text-right">Raspoloživo</TH>
              <TH>Status</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {accounts.data.accounts?.map((a) => (
              <TR key={a.id}>
                <TD>{a.name || '—'}</TD>
                <TD className="font-mono text-xs">{formatAccountNumber(a.number)}</TD>
                <TD>{accountKindLabel[a.kind!]}</TD>
                <TD>{currencyLabel(a.currency!)}</TD>
                <TD className="text-right">{formatMoney(a.balance)}</TD>
                <TD className="text-right">{formatMoney(a.availableBalance)}</TD>
                <TD>
                  <Badge tone={a.status === v1AccountStatus.ACCOUNT_STATUS_ACTIVE ? 'green' : 'red'}>
                    {accountStatusLabel[a.status!]}
                  </Badge>
                </TD>
                <TD>
                  <Link to="/banking/racuni/$id" params={{ id: a.id! }} className="text-blue-600 hover:underline">
                    Detalji
                  </Link>
                </TD>
              </TR>
            ))}
            {(!accounts.data.accounts || accounts.data.accounts.length === 0) && (
              <EmptyRow colSpan={8}>Nemate računa.</EmptyRow>
            )}
          </TBody>
        </Table>
      )}
    </main>
  )
}
