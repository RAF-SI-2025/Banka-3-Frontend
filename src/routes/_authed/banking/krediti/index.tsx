import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { listLoans, listLoanRequests } from '@/lib/api/loans'
import { useAuthStore } from '@/lib/auth/store'
import { keys } from '@/lib/query-keys'
import { formatMoney, formatDate, currencyLabel } from '@/lib/format'
import {
  loanTypeLabel,
  loanStatusLabel,
  loanRequestStatusLabel,
  interestTypeLabel,
} from '@/lib/labels'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { v1LoanStatus } from '@/lib/api/generated/models/v1LoanStatus'
import { v1LoanRequestStatus } from '@/lib/api/generated/models/v1LoanRequestStatus'

export const Route = createFileRoute('/_authed/banking/krediti/')({
  component: ClientLoans,
})

function ClientLoans() {
  const userId = useAuthStore((s) => s.userId)

  const loans = useQuery({
    queryKey: keys.loan.list({ clientId: userId }),
    queryFn: () => listLoans({ clientId: userId ?? undefined }),
    enabled: !!userId,
  })
  const requests = useQuery({
    queryKey: keys.loanRequest.list({}),
    queryFn: () => listLoanRequests({}),
  })

  return (
    <main className="container space-y-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Krediti</h1>
        <Link to="/banking/krediti/novi">
          <Button>Novi zahtev za kredit</Button>
        </Link>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Aktivni krediti</h2>
        {loans.isLoading && <p className="text-gray-500">Učitavanje…</p>}
        {loans.data && (
          <Table>
            <THead>
              <TR>
                <TH>Broj</TH>
                <TH>Tip</TH>
                <TH>Kamata</TH>
                <TH className="text-right">Glavnica</TH>
                <TH className="text-right">Preostalo</TH>
                <TH className="text-right">Rata</TH>
                <TH>Sledeća rata</TH>
                <TH>Status</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {loans.data.loans?.map((l) => (
                <TR key={l.id}>
                  <TD className="font-mono text-xs">{l.loanNumber}</TD>
                  <TD>{loanTypeLabel[l.loanType!]}</TD>
                  <TD className="text-xs">
                    {interestTypeLabel[l.interestType!]} · {l.effectiveRate}%
                  </TD>
                  <TD className="text-right">{formatMoney(l.principal, currencyLabel(l.currency!))}</TD>
                  <TD className="text-right">{formatMoney(l.remainingPrincipal, currencyLabel(l.currency!))}</TD>
                  <TD className="text-right">{formatMoney(l.installmentAmount, currencyLabel(l.currency!))}</TD>
                  <TD className="text-xs">{formatDate(l.nextInstallmentDate)}</TD>
                  <TD>
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
                  </TD>
                  <TD>
                    <Link to="/banking/krediti/$id" params={{ id: l.id! }} className="text-blue-600 hover:underline">
                      Detalji
                    </Link>
                  </TD>
                </TR>
              ))}
              {(!loans.data.loans || loans.data.loans.length === 0) && <EmptyRow colSpan={9}>Nemate aktivnih kredita.</EmptyRow>}
            </TBody>
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Zahtevi</h2>
        {requests.data && (
          <Table>
            <THead>
              <TR>
                <TH>Tip</TH>
                <TH>Kamata</TH>
                <TH className="text-right">Iznos</TH>
                <TH>Broj rata</TH>
                <TH>Status</TH>
                <TH>Datum</TH>
              </TR>
            </THead>
            <TBody>
              {requests.data.requests?.map((r) => (
                <TR key={r.id}>
                  <TD>{loanTypeLabel[r.loanType!]}</TD>
                  <TD>{interestTypeLabel[r.interestType!]}</TD>
                  <TD className="text-right">{formatMoney(r.amount, currencyLabel(r.currency!))}</TD>
                  <TD>{r.installmentsTotal}</TD>
                  <TD>
                    <Badge
                      tone={
                        r.status === v1LoanRequestStatus.LOAN_REQUEST_STATUS_APPROVED
                          ? 'green'
                          : r.status === v1LoanRequestStatus.LOAN_REQUEST_STATUS_REJECTED
                            ? 'red'
                            : 'yellow'
                      }
                    >
                      {loanRequestStatusLabel[r.status!]}
                    </Badge>
                  </TD>
                  <TD className="text-xs">{formatDate(r.createdAt)}</TD>
                </TR>
              ))}
              {(!requests.data.requests || requests.data.requests.length === 0) && (
                <EmptyRow colSpan={6}>Nema zahteva.</EmptyRow>
              )}
            </TBody>
          </Table>
        )}
      </section>
    </main>
  )
}
