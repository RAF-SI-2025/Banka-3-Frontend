import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getLoan } from '@/lib/api/loans'
import { getClient } from '@/lib/api/clients'
import { getAccount } from '@/lib/api/accounts'
import { keys } from '@/lib/query-keys'
import { formatMoney, formatDate, formatAccountNumber, currencyLabel } from '@/lib/format'
import {
  loanTypeLabel,
  loanStatusLabel,
  interestTypeLabel,
  installmentStatusLabel,
} from '@/lib/labels'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { v1InstallmentStatus } from '@/lib/api/generated/models/v1InstallmentStatus'
import { v1LoanStatus } from '@/lib/api/generated/models/v1LoanStatus'

export const Route = createFileRoute('/_authed/portal/loans/$id')({
  component: PortalLoanDetail,
})

function PortalLoanDetail() {
  const { id } = Route.useParams()
  const loan = useQuery({
    queryKey: keys.loan.detail(id),
    queryFn: () => getLoan(id),
  })
  const l = loan.data?.loan
  const client = useQuery({
    queryKey: ['client', l?.clientId],
    queryFn: () => getClient(l!.clientId!),
    enabled: !!l?.clientId,
  })
  const account = useQuery({
    queryKey: keys.account.detail(l?.accountId ?? ''),
    queryFn: () => getAccount(l!.accountId!),
    enabled: !!l?.accountId,
  })

  if (loan.isLoading) return <p className="container py-8 text-gray-500">Učitavanje…</p>
  if (!l) return <p className="container py-8 text-red-600">Greška pri učitavanju.</p>

  const installments = loan.data?.installments ?? []
  const cur = currencyLabel(l.currency!)
  const clientName = client.data
    ? [client.data.firstName, client.data.lastName].filter(Boolean).join(' ').trim()
    : ''

  return (
    <main className="container space-y-6 py-8">
      <div>
        <Link to="/portal/loans" className="text-sm text-gray-500 hover:underline">
          ← Krediti
        </Link>
      </div>

      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Kredit {l.loanNumber}</h1>
            <p className="text-sm text-gray-500">{loanTypeLabel[l.loanType!]}</p>
          </div>
          <Badge
            tone={
              l.status === v1LoanStatus.LOAN_STATUS_APPROVED
                ? 'green'
                : l.status === v1LoanStatus.LOAN_STATUS_PAID_OFF
                  ? 'blue'
                  : 'red'
            }
          >
            {loanStatusLabel[l.status!]}
          </Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <Field label="Glavnica">{formatMoney(l.principal, cur)}</Field>
          <Field label="Preostalo">{formatMoney(l.remainingPrincipal, cur)}</Field>
          <Field label="Mesečna rata">{formatMoney(l.installmentAmount, cur)}</Field>
          <Field label="Vrsta kamate">{interestTypeLabel[l.interestType!]}</Field>
          <Field label="Bazna kamata">{l.baseRate}%</Field>
          <Field label="Marža">{l.margin}%</Field>
          <Field label="Pomeraj">{l.currentOffset}%</Field>
          <Field label="Efektivna kamata">{l.effectiveRate}%</Field>
          <Field label="Broj rata">{l.installmentsTotal}</Field>
          <Field label="Sledeća rata">{formatDate(l.nextInstallmentDate)}</Field>
          <Field label="Iznos sledeće">{formatMoney(l.nextInstallmentAmount, cur)}</Field>
          <Field label="Datum dospeća">{formatDate(l.maturesAt)}</Field>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Klijent i račun</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
          <Field label="Klijent">
            {client.isLoading ? (
              '…'
            ) : client.data ? (
              <Link
                to="/portal/clients/$id"
                params={{ id: client.data.id! }}
                className="text-blue-600 hover:underline"
              >
                {clientName || '—'}
              </Link>
            ) : (
              '—'
            )}
          </Field>
          <Field label="Email">{client.data?.email ?? '—'}</Field>
          <Field label="Telefon">{client.data?.phone ?? '—'}</Field>
          <Field label="Račun">
            {account.data ? (
              <Link
                to="/portal/accounts/$id"
                params={{ id: account.data.id! }}
                className="font-mono text-xs text-blue-600 hover:underline"
              >
                {formatAccountNumber(account.data.number)}
              </Link>
            ) : (
              '—'
            )}
          </Field>
          <Field label="Naziv računa">{account.data?.name ?? '—'}</Field>
        </div>
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Plan otplate</h2>
        <Table>
          <THead>
            <TR>
              <TH>#</TH>
              <TH>Datum dospeća</TH>
              <TH className="text-right">Iznos</TH>
              <TH className="text-right">Kamata na dan</TH>
              <TH>Plaćeno</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {installments.map((i) => (
              <TR key={i.id}>
                <TD>{i.sequenceNumber}</TD>
                <TD className="text-xs">{formatDate(i.expectedDueDate)}</TD>
                <TD className="text-right">{formatMoney(i.amount, currencyLabel(i.currency!))}</TD>
                <TD className="text-right text-xs">{i.interestRateAtDue}%</TD>
                <TD className="text-xs">{i.actualPaidAt ? formatDate(i.actualPaidAt) : '—'}</TD>
                <TD>
                  <Badge
                    tone={
                      i.status === v1InstallmentStatus.INSTALLMENT_STATUS_PAID
                        ? 'green'
                        : i.status === v1InstallmentStatus.INSTALLMENT_STATUS_OVERDUE
                          ? 'red'
                          : 'yellow'
                    }
                  >
                    {installmentStatusLabel[i.status!]}
                  </Badge>
                </TD>
              </TR>
            ))}
            {installments.length === 0 && <EmptyRow colSpan={6}>Plan otplate nije generisan.</EmptyRow>}
          </TBody>
        </Table>
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
