import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeftRight, ArrowRightLeft, Send } from 'lucide-react'
import { listAccounts } from '@/lib/api/accounts'
import { useAuthStore } from '@/lib/auth/store'
import { keys } from '@/lib/query-keys'
import { formatMoney, formatAccountNumber, currencyLabel } from '@/lib/format'
import { accountKindLabel } from '@/lib/labels'
import { Card } from '@/components/ui/card'

export const Route = createFileRoute('/_authed/banking/')({
  component: ClientHome,
})

const tileClass =
  'flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-medium shadow-soft transition-colors hover:border-primary/40 hover:bg-accent'
const tileIconClass =
  'grid size-9 place-items-center rounded-md bg-primary-soft text-primary-soft-foreground'

function ClientHome() {
  const userId = useAuthStore((s) => s.userId)
  const firstName = useAuthStore((s) => s.firstName)
  const accounts = useQuery({
    queryKey: keys.account.list({ ownerClientId: userId }),
    queryFn: () => listAccounts({ ownerClientId: userId ?? undefined }),
    enabled: !!userId,
  })

  return (
    <div className="container space-y-8 py-10">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">Dobrodošli{firstName ? ',' : ''}</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {firstName ? firstName : 'Početna'}
        </h1>
      </header>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Vaši računi
          </h2>
          <Link
            to="/banking/racuni"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Pogledaj sve
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {accounts.isLoading && (
            <Card className="p-4 text-sm text-muted-foreground">Učitavanje…</Card>
          )}
          {accounts.data?.accounts?.map((a) => (
            <Link key={a.id} to="/banking/racuni/$id" params={{ id: a.id! }}>
              <Card className="group p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      {accountKindLabel[a.kind!]}
                    </div>
                    <div className="mt-1 truncate font-medium">
                      {a.name || formatAccountNumber(a.number)}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {formatAccountNumber(a.number)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-semibold tabular-nums tracking-tight">
                      {formatMoney(a.availableBalance, currencyLabel(a.currency!))}
                    </div>
                    <div className="text-xs text-muted-foreground">Raspoloživo</div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
          {accounts.data && (!accounts.data.accounts || accounts.data.accounts.length === 0) && (
            <Card className="p-4 text-sm text-muted-foreground">Nemate aktivnih računa.</Card>
          )}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link to="/banking/placanja" className={tileClass}>
          <span className={tileIconClass}>
            <Send className="size-4" />
          </span>
          <span>Novo plaćanje</span>
        </Link>
        <Link to="/banking/transferi" className={tileClass}>
          <span className={tileIconClass}>
            <ArrowRightLeft className="size-4" />
          </span>
          <span>Transfer između računa</span>
        </Link>
        <Link to="/banking/menjacnica" className={tileClass}>
          <span className={tileIconClass}>
            <ArrowLeftRight className="size-4" />
          </span>
          <span>Menjačnica</span>
        </Link>
      </section>
    </div>
  )
}
