import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeftRight, ArrowRightLeft, LineChart, Send, UserPlus } from 'lucide-react'
import { listAccounts } from '@/lib/api/accounts'
import { listHoldings } from '@/lib/api/portfolio'
import { listTransactions, quoteExchange } from '@/lib/api/payments'
import { listRecipients } from '@/lib/api/recipients'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { keys } from '@/lib/query-keys'
import { formatMoney, formatAccountNumber, currencyLabel, formatDateTime } from '@/lib/format'
import { accountKindLabel, txKindLabel } from '@/lib/labels'
import { bankaBankV1Currency } from '@/lib/api/generated/models/bankaBankV1Currency'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

export const Route = createFileRoute('/_authed/banking/')({
  component: ClientHome,
})

const tileClass =
  'flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-medium shadow-soft transition-colors hover:border-primary/40 hover:bg-accent'
const tileIconClass =
  'grid size-9 place-items-center rounded-md bg-primary-soft text-primary-soft-foreground'

// Spec p.22 quick-pay tile + spec p.19 FX calculator presets. RSD is
// always first since most users have an RSD account; the rest is the
// set the bank quotes against per `services/exchange/.../seed` rows.
const FX_CURRENCIES: { value: bankaBankV1Currency; label: string }[] = [
  { value: bankaBankV1Currency.CURRENCY_RSD, label: 'RSD' },
  { value: bankaBankV1Currency.CURRENCY_EUR, label: 'EUR' },
  { value: bankaBankV1Currency.CURRENCY_USD, label: 'USD' },
  { value: bankaBankV1Currency.CURRENCY_CHF, label: 'CHF' },
  { value: bankaBankV1Currency.CURRENCY_GBP, label: 'GBP' },
]

function ClientHome() {
  const userId = useAuthStore((s) => s.userId)
  const firstName = useAuthStore((s) => s.firstName)
  const perms = useAuthStore((s) => s.permissions)
  const canTrade = has(perms, Permissions.TradingClient)

  const accounts = useQuery({
    queryKey: keys.account.list({ ownerClientId: userId }),
    queryFn: () => listAccounts({ ownerClientId: userId ?? undefined }),
    enabled: !!userId,
  })

  const portfolio = useQuery({
    queryKey: keys.portfolio.list(userId ?? ''),
    queryFn: () => listHoldings(),
    enabled: !!userId && canTrade,
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

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <QuickPayWidget />
        </div>
        <FxCalculatorWidget />
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
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
        <Link to="/banking/primaoci" className={tileClass}>
          <span className={tileIconClass}>
            <UserPlus className="size-4" />
          </span>
          <span>Primaoci plaćanja</span>
        </Link>
      </section>

      <LastTransactionsWidget />

      {canTrade && (
        <section className="space-y-3" data-cy="trading-tile">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Trgovina</h2>
          <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Ukupan profit</div>
              <div className="text-2xl font-semibold tabular-nums">
                {portfolio.isLoading ? '—' : formatMoney(portfolio.data?.totalProfit)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {portfolio.data?.holdings?.length ?? 0} pozicija
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/banking/portfolio" className={tileClass}>
                <span className={tileIconClass}><LineChart className="size-4" /></span>
                <span>Portfolio</span>
              </Link>
              <Link to="/banking/trgovina" className={tileClass}>
                <span className={tileIconClass}><LineChart className="size-4" /></span>
                <span>Pretraži tržište</span>
              </Link>
            </div>
          </Card>
        </section>
      )}
    </div>
  )
}

// Spec p.22 "Brzo plaćanje": shortcut tiles for saved recipients. The
// tile deep-links to /banking/placanja with `?recipientId=<id>`; the
// payments form picks the search-param up via Route.useSearch and runs
// the same applyTemplate path it uses for the dropdown.
//
// Cap at 4 tiles so the row stays one line on lg+; the "Svi primaoci"
// tile is always present and routes to /primaoci. With zero recipients
// we render the empty-state CTA instead.
function QuickPayWidget() {
  const recipients = useQuery({
    queryKey: keys.recipient.all,
    queryFn: () => listRecipients(),
  })
  const top = (recipients.data?.recipients ?? []).slice(0, 4)

  return (
    <section className="space-y-3" data-cy="quick-pay">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Brzo plaćanje
        </h2>
        <Link
          to="/banking/placanja"
          search={{ recipientId: undefined }}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Novo plaćanje
        </Link>
      </div>
      {recipients.isLoading ? (
        <Card className="p-4 text-sm text-muted-foreground">Učitavanje…</Card>
      ) : top.length === 0 ? (
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">
            Nemate sačuvanih primalaca. Sačuvajte prvog kroz novo plaćanje, pa
            će se ovde pojaviti za brzi pristup.
          </div>
          <div className="mt-3">
            <Link to="/banking/placanja" search={{ recipientId: undefined }} className={tileClass}>
              <span className={tileIconClass}>
                <Send className="size-4" />
              </span>
              <span>Novo plaćanje</span>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {top.map((r) => (
            <Link
              key={r.id}
              to="/banking/placanja"
              search={{ recipientId: r.id! }}
              data-cy={`quick-pay-${r.id}`}
            >
              <Card className="h-full p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Primalac
                </div>
                <div className="mt-1 truncate font-medium">{r.name}</div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  {formatAccountNumber(r.accountNumber)}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

// Spec p.19 "kalkulator menjačnice na početnoj": inline FX calculator
// against /menjacnica/quote. It computes only — execution still goes
// through /banking/menjacnica because that's where the verification
// gate + source/destination account picker live. RSD↔FX uses the
// bank's ASK column on every leg per the FX edge case in /CLAUDE.md
// (commission included unless we explicitly turn it off).
function FxCalculatorWidget() {
  const [from, setFrom] = useState<bankaBankV1Currency>(bankaBankV1Currency.CURRENCY_EUR)
  const [to, setTo] = useState<bankaBankV1Currency>(bankaBankV1Currency.CURRENCY_RSD)
  const [amount, setAmount] = useState('100')

  const validAmount = /^[0-9]+(\.[0-9]{1,2})?$/.test(amount) && Number(amount) > 0
  const distinct = from !== to

  const quote = useQuery({
    queryKey: ['homeFxQuote', from, to, amount],
    queryFn: () => quoteExchange({ from, to, amount, includeCommission: true }),
    enabled: validAmount && distinct,
    staleTime: 30_000,
  })

  return (
    <section className="space-y-3" data-cy="fx-calc">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Menjačnica
        </h2>
        <Link
          to="/banking/menjacnica"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Zameni valute
        </Link>
      </div>
      <Card className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="fx-from">Iz</Label>
            <Select
              id="fx-from"
              data-cy="fx-from"
              value={from}
              onChange={(e) => setFrom(e.target.value as bankaBankV1Currency)}
            >
              {FX_CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="fx-to">U</Label>
            <Select
              id="fx-to"
              data-cy="fx-to"
              value={to}
              onChange={(e) => setTo(e.target.value as bankaBankV1Currency)}
            >
              {FX_CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="fx-amount">Iznos</Label>
          <Input
            id="fx-amount"
            data-cy="fx-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
          />
        </div>
        <div
          className="rounded-md border border-border bg-muted/30 p-3 text-sm"
          data-cy="fx-result"
        >
          {!distinct ? (
            <span className="text-muted-foreground">Izaberite različite valute.</span>
          ) : !validAmount ? (
            <span className="text-muted-foreground">Unesite iznos.</span>
          ) : quote.isLoading ? (
            <span className="text-muted-foreground">Računam…</span>
          ) : quote.isError ? (
            <span className="text-danger">Kurs nije dostupan.</span>
          ) : (
            <div className="space-y-1">
              <div className="font-medium tabular-nums" data-cy="fx-to-amount">
                {formatMoney(quote.data?.toAmount, to)}
              </div>
              <div className="text-xs text-muted-foreground">
                Kurs {quote.data?.rate} • Provizija{' '}
                <span data-cy="fx-commission">
                  {formatMoney(quote.data?.commission, from)}
                </span>
              </div>
            </div>
          )}
        </div>
      </Card>
    </section>
  )
}

// Spec p.19 "poslednjih nekoliko transakcija" on the banking home.
// Backend scope: when no accountId is passed, ListTransactions defaults
// to initiator-scoped (the user's outgoing ops) — see
// services/bank/.../transactions.go comment. Five rows is enough for a
// glance; the racuni detail page is one click away for the full list.
function LastTransactionsWidget() {
  const tx = useQuery({
    queryKey: keys.transaction.list({ pageSize: 5, scope: 'recent' }),
    queryFn: () => listTransactions({ pageSize: 5 }),
  })
  const rows = useMemo(() => (tx.data?.transactions ?? []).slice(0, 5), [tx.data])

  return (
    <section className="space-y-3" data-cy="last-transactions">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Poslednje transakcije
      </h2>
      <Card className="divide-y divide-border">
        {tx.isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Učitavanje…</div>
        ) : rows.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">Nema transakcija.</div>
        ) : (
          rows.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 p-3 text-sm"
              data-cy={`last-tx-${t.id}`}
            >
              <div className="min-w-0">
                <div className="truncate font-medium">
                  {t.recipientName || (t.kind ? txKindLabel[t.kind] : '—')}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t.createdAt ? formatDateTime(t.createdAt) : ''}
                </div>
              </div>
              <div className="text-right tabular-nums">
                <div className="font-medium">{formatMoney(t.fromAmount)}</div>
                <div className="font-mono text-[10px] uppercase text-muted-foreground">
                  {t.toAccountNumber ? formatAccountNumber(t.toAccountNumber) : ''}
                </div>
              </div>
            </div>
          ))
        )}
      </Card>
    </section>
  )
}
