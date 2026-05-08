import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getAccount } from '@/lib/api/accounts'
import { listTransactions } from '@/lib/api/payments'
import { listCards } from '@/lib/api/cards'
import { keys } from '@/lib/query-keys'
import {
  formatMoney,
  formatAccountNumber,
  formatDateTime,
  currencyLabel,
} from '@/lib/format'
import {
  accountKindLabel,
  accountSubtypeLabel,
  accountStatusLabel,
  txKindLabel,
  txStatusLabel,
  cardBrandLabel,
  cardStatusLabel,
} from '@/lib/labels'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { v1TransactionStatus } from '@/lib/api/generated/models/v1TransactionStatus'

export const Route = createFileRoute('/_authed/banking/racuni/$id')({
  component: AccountDetail,
})

function AccountDetail() {
  const { id } = Route.useParams()
  const account = useQuery({
    queryKey: keys.account.detail(id),
    queryFn: () => getAccount(id),
  })
  const transactions = useQuery({
    queryKey: keys.transaction.list({ accountId: id }),
    queryFn: () => listTransactions({ accountId: id, pageSize: 50 }),
  })
  const cards = useQuery({
    queryKey: keys.card.list({ accountId: id }),
    queryFn: () => listCards(id),
  })

  if (account.isLoading) return <p className="container py-8 text-gray-500">Učitavanje…</p>
  if (!account.data) return <p className="container py-8 text-red-600">Greška pri učitavanju.</p>

  const a = account.data
  return (
    <main className="container space-y-6 py-8">
      <div>
        <Link to="/banking/racuni" className="text-sm text-gray-500 hover:underline">
          ← Računi
        </Link>
      </div>

      <Card className="space-y-3 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{a.name || formatAccountNumber(a.number)}</h1>
            <div className="font-mono text-sm text-gray-500">{formatAccountNumber(a.number)}</div>
          </div>
          <Badge tone={a.status === 'ACCOUNT_STATUS_ACTIVE' ? 'green' : 'red'}>
            {accountStatusLabel[a.status!]}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <Field label="Vrsta">{accountKindLabel[a.kind!]}</Field>
          <Field label="Podtip">{accountSubtypeLabel[a.subtype!]}</Field>
          <Field label="Valuta">{currencyLabel(a.currency!)}</Field>
          <Field label="Mesečno održavanje">{formatMoney(a.maintenanceFee, currencyLabel(a.currency!))}</Field>
          <Field label="Stanje">{formatMoney(a.balance, currencyLabel(a.currency!))}</Field>
          <Field label="Raspoloživo">{formatMoney(a.availableBalance, currencyLabel(a.currency!))}</Field>
          <Field label="Dnevni limit">{formatMoney(a.dailyLimit, currencyLabel(a.currency!))}</Field>
          <Field label="Mesečni limit">{formatMoney(a.monthlyLimit, currencyLabel(a.currency!))}</Field>
          <Field label="Dnevno potrošeno">{formatMoney(a.dailySpent, currencyLabel(a.currency!))}</Field>
          <Field label="Mesečno potrošeno">{formatMoney(a.monthlySpent, currencyLabel(a.currency!))}</Field>
        </div>
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Kartice</h2>
        {cards.data?.cards && cards.data.cards.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>Naziv</TH>
                <TH>Brend</TH>
                <TH>Broj</TH>
                <TH className="text-right">Limit</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {cards.data.cards.map((c) => (
                <TR key={c.id}>
                  <TD>{c.name || '—'}</TD>
                  <TD>{cardBrandLabel[c.brand!]}</TD>
                  <TD className="font-mono text-xs">{c.number}</TD>
                  <TD className="text-right">{formatMoney(c.cardLimit, currencyLabel(a.currency!))}</TD>
                  <TD>
                    <Badge tone={c.status === 'CARD_STATUS_ACTIVE' ? 'green' : 'red'}>
                      {cardStatusLabel[c.status!]}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : (
          <p className="text-sm text-gray-500">Nemate kartica za ovaj račun.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Transakcije</h2>
        {transactions.data && transactions.data.transactions && transactions.data.transactions.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>Datum</TH>
                <TH>Tip</TH>
                <TH>Smer</TH>
                <TH>Drugi račun</TH>
                <TH>Svrha</TH>
                <TH className="text-right">Iznos</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {transactions.data.transactions.map((t) => {
                const outflow = t.fromAccountId === id
                const counterparty = outflow ? t.toAccountId : t.fromAccountId
                const amount = outflow ? t.fromAmount : t.toAmount
                return (
                  <TR key={t.id}>
                    <TD className="whitespace-nowrap text-xs text-gray-600">{formatDateTime(t.createdAt)}</TD>
                    <TD>{txKindLabel[t.kind!]}</TD>
                    <TD>{outflow ? 'Odliv' : 'Priliv'}</TD>
                    <TD className="font-mono text-xs">{counterparty || '—'}</TD>
                    <TD className="text-xs text-gray-700">{t.purpose || t.recipientName || '—'}</TD>
                    <TD className={`text-right ${outflow ? 'text-red-600' : 'text-green-700'}`}>
                      {outflow ? '-' : '+'}
                      {formatMoney(amount)}
                    </TD>
                    <TD>
                      <Badge
                        tone={
                          t.status === v1TransactionStatus.TRANSACTION_STATUS_REALIZED
                            ? 'green'
                            : t.status === v1TransactionStatus.TRANSACTION_STATUS_REJECTED
                              ? 'red'
                              : 'yellow'
                        }
                      >
                        {txStatusLabel[t.status!]}
                      </Badge>
                    </TD>
                  </TR>
                )
              })}
              {(!transactions.data.transactions || transactions.data.transactions.length === 0) && (
                <EmptyRow colSpan={7}>Nema transakcija.</EmptyRow>
              )}
            </TBody>
          </Table>
        ) : (
          <p className="text-sm text-gray-500">Nema transakcija.</p>
        )}
      </section>
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="font-medium">{children}</div>
    </div>
  )
}
