import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { listLoans, listLoanRequests, type LoanRequest } from '@/lib/api/loans'
import { useAuthStore } from '@/lib/auth/store'
import { keys } from '@/lib/query-keys'
import { formatMoney, formatDate, currencyLabel } from '@/lib/format'
import {
  loanTypeLabel,
  loanStatusLabel,
  loanRequestStatusLabel,
  interestTypeLabel,
  employmentStatusLabel,
} from '@/lib/labels'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { v1LoanStatus } from '@/lib/api/generated/models/v1LoanStatus'
import { v1LoanRequestStatus } from '@/lib/api/generated/models/v1LoanRequestStatus'

export const Route = createFileRoute('/_authed/banking/krediti/')({
  component: ClientLoans,
})

function ClientLoans() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.userId)
  const [requestDetail, setRequestDetail] = useState<LoanRequest | null>(null)

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
              </TR>
            </THead>
            <TBody>
              {loans.data.loans?.map((l) => (
                <TR
                  key={l.id}
                  onClick={() => navigate({ to: '/banking/krediti/$id', params: { id: l.id! } })}
                >
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
                </TR>
              ))}
              {(!loans.data.loans || loans.data.loans.length === 0) && <EmptyRow colSpan={8}>Nemate aktivnih kredita.</EmptyRow>}
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
                <TR key={r.id} onClick={() => setRequestDetail(r)}>
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

      <LoanRequestDetailDialog request={requestDetail} onClose={() => setRequestDetail(null)} />
    </main>
  )
}

function LoanRequestDetailDialog({
  request,
  onClose,
}: {
  request: LoanRequest | null
  onClose: () => void
}) {
  if (!request) return null
  const cur = currencyLabel(request.currency!)
  return (
    <Dialog
      open={!!request}
      onClose={onClose}
      title={`Zahtev za kredit · ${loanTypeLabel[request.loanType!]}`}
      panelClassName="max-w-2xl"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Zatvori
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
        <Field label="Datum">{formatDate(request.createdAt)}</Field>
        <Field label="Status">
          <Badge
            tone={
              request.status === v1LoanRequestStatus.LOAN_REQUEST_STATUS_APPROVED
                ? 'green'
                : request.status === v1LoanRequestStatus.LOAN_REQUEST_STATUS_REJECTED
                  ? 'red'
                  : 'yellow'
            }
          >
            {loanRequestStatusLabel[request.status!]}
          </Badge>
        </Field>
        <Field label="Tip">{loanTypeLabel[request.loanType!]}</Field>
        <Field label="Kamata">{interestTypeLabel[request.interestType!]}</Field>
        <Field label="Iznos">{formatMoney(request.amount, cur)}</Field>
        <Field label="Broj rata">{request.installmentsTotal}</Field>
        <Field label="Mesečna plata">{formatMoney(request.monthlySalary, cur)}</Field>
        <Field label="Zaposlenje">{employmentStatusLabel[request.employmentStatus!]}</Field>
        <Field label="Staž (meseci)">{request.employmentDurationMonths ?? '—'}</Field>
        <Field label="Kontakt telefon">{request.contactPhone}</Field>
        <Field label="Svrha" wide>
          {request.purpose || '—'}
        </Field>
        {request.rejectionReason && (
          <Field label="Razlog odbijanja" wide>
            {request.rejectionReason}
          </Field>
        )}
      </div>
    </Dialog>
  )
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2 md:col-span-3' : ''}>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="font-medium">{children}</div>
    </div>
  )
}
