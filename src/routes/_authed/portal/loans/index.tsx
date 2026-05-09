import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { listLoans } from '@/lib/api/loans'
import { keys } from '@/lib/query-keys'
import { formatMoney, formatDate, currencyLabel } from '@/lib/format'
import { loanTypeLabel, loanStatusLabel, interestTypeLabel } from '@/lib/labels'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { v1LoanStatus } from '@/lib/api/generated/models/v1LoanStatus'

export const Route = createFileRoute('/_authed/portal/loans/')({
  component: PortalLoans,
})

function PortalLoans() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<v1LoanStatus>(v1LoanStatus.LOAN_STATUS_UNSPECIFIED)

  const loans = useQuery({
    queryKey: keys.loan.list({ status }),
    queryFn: () => listLoans({ status, pageSize: 100 }),
  })

  return (
    <main className="container space-y-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Krediti</h1>
      </div>

      <Select value={status} onChange={(e) => setStatus(e.target.value as v1LoanStatus)} className="max-w-xs">
        {Object.values(v1LoanStatus).map((s) => (
          <option key={s} value={s}>
            {s === v1LoanStatus.LOAN_STATUS_UNSPECIFIED ? 'Svi statusi' : loanStatusLabel[s]}
          </option>
        ))}
      </Select>

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
                onClick={() => navigate({ to: '/portal/loans/$id', params: { id: l.id! } })}
              >
                <TD className="font-mono text-xs">{l.loanNumber}</TD>
                <TD>{loanTypeLabel[l.loanType!]}</TD>
                <TD className="text-xs">{interestTypeLabel[l.interestType!]} · {l.effectiveRate}%</TD>
                <TD className="text-right">{formatMoney(l.principal, currencyLabel(l.currency!))}</TD>
                <TD className="text-right">{formatMoney(l.remainingPrincipal, currencyLabel(l.currency!))}</TD>
                <TD className="text-right">{formatMoney(l.installmentAmount, currencyLabel(l.currency!))}</TD>
                <TD className="text-xs">{formatDate(l.nextInstallmentDate)}</TD>
                <TD>
                  <Badge tone={l.status === v1LoanStatus.LOAN_STATUS_APPROVED ? 'green' : l.status === v1LoanStatus.LOAN_STATUS_PAID_OFF ? 'blue' : 'red'}>
                    {loanStatusLabel[l.status!]}
                  </Badge>
                </TD>
              </TR>
            ))}
            {(!loans.data.loans || loans.data.loans.length === 0) && <EmptyRow colSpan={8}>Nema kredita.</EmptyRow>}
          </TBody>
        </Table>
      )}
    </main>
  )
}
