import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getLoan } from '@/lib/api/loans'
import { keys } from '@/lib/query-keys'
import { formatMoney, formatDate, currencyLabel } from '@/lib/format'
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

export const Route = createFileRoute('/_authed/banking/krediti/$id')({
  component: LoanDetail,
})

function LoanDetail() {
  const { id } = Route.useParams()
  const loan = useQuery({
    queryKey: keys.loan.detail(id),
    queryFn: () => getLoan(id),
  })

  if (loan.isLoading) return <PageSkeleton />
  if (!loan.data?.loan) return <p className="container py-8 text-danger">Greška pri učitavanju.</p>

  const l = loan.data.loan
  const installments = loan.data.installments ?? []

  return (
    <main className="container space-y-6 py-8">
      <div>
        <Link to="/banking/krediti" className="text-sm text-muted-foreground hover:underline">
          ← Krediti
        </Link>
      </div>

      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Kredit {l.loanNumber}</h1>
            <p className="text-sm text-muted-foreground">{loanTypeLabel[l.loanType!]}</p>
          </div>
          <Badge tone={l.status === 'LOAN_STATUS_APPROVED' ? 'green' : l.status === 'LOAN_STATUS_PAID_OFF' ? 'blue' : 'red'}>
            {loanStatusLabel[l.status!]}
          </Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <Field label="Glavnica">{formatMoney(l.principal, currencyLabel(l.currency!))}</Field>
          <Field label="Preostalo">{formatMoney(l.remainingPrincipal, currencyLabel(l.currency!))}</Field>
          <Field label="Mesečna rata">{formatMoney(l.installmentAmount, currencyLabel(l.currency!))}</Field>
          <Field label="Vrsta kamate">{interestTypeLabel[l.interestType!]}</Field>
          <Field label="Bazna kamata">{l.baseRate}%</Field>
          <Field label="Marža">{l.margin}%</Field>
          <Field label="Pomeraj">{l.currentOffset}%</Field>
          <Field label="Efektivna kamata">{l.effectiveRate}%</Field>
          <Field label="Broj rata">{l.installmentsTotal}</Field>
          <Field label="Sledeća rata">{formatDate(l.nextInstallmentDate)}</Field>
          <Field label="Iznos sledeće">{formatMoney(l.nextInstallmentAmount, currencyLabel(l.currency!))}</Field>
          <Field label="Datum dospeća">{formatDate(l.maturesAt)}</Field>
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


function PageSkeleton() {
  return (
    <main className="container space-y-6 py-8">
      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
        <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="h-48 animate-pulse rounded-lg bg-muted" />
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{children}</div>
    </div>
  )
}