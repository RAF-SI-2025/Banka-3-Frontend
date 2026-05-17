import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { listAccounts } from '@/lib/api/accounts'
import { useAuthStore } from '@/lib/auth/store'
import { keys } from '@/lib/query-keys'
import { formatMoney, formatAccountNumber, currencyLabel } from '@/lib/format'
import { accountKindLabel } from '@/lib/labels'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { SkeletonTable } from '@/components/ui/skeleton'
import { v1AccountStatus } from '@/lib/api/generated/models/v1AccountStatus'

export const Route = createFileRoute('/_authed/banking/racuni/')({
  component: AccountsList,
})

function AccountsList() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.userId)
  const accounts = useQuery({
    queryKey: keys.account.list({ ownerClientId: userId }),
    queryFn: () => listAccounts({ ownerClientId: userId ?? undefined }),
    enabled: !!userId,
  })

  // Spec p.19: client-facing list shows only active accounts, sorted
  // by raspoloživo (available balance) descending. Inactive accounts
  // stay visible only on the employee portal.
  const visible = (accounts.data?.accounts ?? [])
    .filter((a) => a.status === v1AccountStatus.ACCOUNT_STATUS_ACTIVE)
    .slice()
    .sort((a, b) => Number(b.availableBalance ?? 0) - Number(a.availableBalance ?? 0))

  return (
    <main className="container space-y-6 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Računi</h1>
        <p className="text-sm text-muted-foreground">
          Pregled svih vaših aktivnih računa, sortiranih po raspoloživim sredstvima.
        </p>
      </header>
      {accounts.isLoading && <SkeletonTable rows={4} cols={6} />}
      {accounts.isError && <p className="text-danger">Greška pri učitavanju.</p>}
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
            </TR>
          </THead>
          <TBody>
            {visible.map((a) => (
              <TR
                key={a.id}
                onClick={() => navigate({ to: '/banking/racuni/$id', params: { id: a.id! } })}
              >
                <TD className="font-medium">{a.name || '—'}</TD>
                <TD className="font-mono text-xs text-muted-foreground">
                  {formatAccountNumber(a.number)}
                </TD>
                <TD>{accountKindLabel[a.kind!]}</TD>
                <TD>{currencyLabel(a.currency!)}</TD>
                <TD className="text-right tabular-nums">{formatMoney(a.balance)}</TD>
                <TD className="text-right font-medium tabular-nums">
                  {formatMoney(a.availableBalance)}
                </TD>
              </TR>
            ))}
            {visible.length === 0 && <EmptyRow colSpan={6}>Nemate aktivnih računa.</EmptyRow>}
          </TBody>
        </Table>
      )}
    </main>
  )
}
