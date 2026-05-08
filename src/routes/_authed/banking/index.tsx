import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { listAccounts } from '@/lib/api/accounts'
import { useAuthStore } from '@/lib/auth/store'
import { keys } from '@/lib/query-keys'
import { formatMoney, formatAccountNumber, currencyLabel } from '@/lib/format'
import { accountKindLabel } from '@/lib/labels'
import { Card } from '@/components/ui/card'

export const Route = createFileRoute('/_authed/banking/')({
  component: ClientHome,
})

function ClientHome() {
  const userId = useAuthStore((s) => s.userId)
  const accounts = useQuery({
    queryKey: keys.account.list({ ownerClientId: userId }),
    queryFn: () => listAccounts({ ownerClientId: userId ?? undefined }),
    enabled: !!userId,
  })

  return (
    <div className="container space-y-6 py-8">
      <h1 className="text-2xl font-semibold">Početna</h1>

      <section className="grid gap-3 md:grid-cols-2">
        {accounts.isLoading && <p className="text-gray-500">Učitavanje…</p>}
        {accounts.data?.accounts?.map((a) => (
          <Link key={a.id} to="/banking/racuni/$id" params={{ id: a.id! }}>
            <Card className="cursor-pointer p-4 transition hover:border-blue-300 hover:shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm text-gray-500">{accountKindLabel[a.kind!]}</div>
                  <div className="font-medium">{a.name || formatAccountNumber(a.number)}</div>
                  <div className="font-mono text-xs text-gray-500">{formatAccountNumber(a.number)}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold">{formatMoney(a.availableBalance, currencyLabel(a.currency!))}</div>
                  <div className="text-xs text-gray-500">Raspoloživo</div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
        {accounts.data && (!accounts.data.accounts || accounts.data.accounts.length === 0) && (
          <p className="text-gray-500">Nemate aktivnih računa.</p>
        )}
      </section>

      <section className="flex flex-wrap gap-3">
        <Link to="/banking/placanja" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Novo plaćanje
        </Link>
        <Link to="/banking/transferi" className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-300">
          Transfer između mojih računa
        </Link>
        <Link to="/banking/menjacnica" className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-300">
          Menjačnica
        </Link>
      </section>
    </div>
  )
}
