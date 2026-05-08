import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { listLoanRequests, decideLoanRequest } from '@/lib/api/loans'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { formatMoney, formatDate, currencyLabel } from '@/lib/format'
import {
  loanTypeLabel,
  interestTypeLabel,
  loanRequestStatusLabel,
  employmentStatusLabel,
} from '@/lib/labels'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { v1LoanRequestStatus } from '@/lib/api/generated/models/v1LoanRequestStatus'

export const Route = createFileRoute('/_authed/portal/loan-requests/')({
  component: LoanRequests,
})

function LoanRequests() {
  const qc = useQueryClient()
  const perms = useAuthStore((s) => s.permissions)
  const canDecide = has(perms, Permissions.LoanWrite)
  const [status, setStatus] = useState<v1LoanRequestStatus>(v1LoanRequestStatus.LOAN_REQUEST_STATUS_PENDING)

  const requests = useQuery({
    queryKey: keys.loanRequest.list({ status }),
    queryFn: () => listLoanRequests({ status, pageSize: 100 }),
  })

  const [rejectId, setRejectId] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const decide = useMutation({
    mutationFn: ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) =>
      decideLoanRequest(id, { approve, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.loanRequest.all })
      qc.invalidateQueries({ queryKey: keys.loan.all })
      setRejectId(null)
      setReason('')
    },
  })

  return (
    <main className="container space-y-4 py-8">
      <h1 className="text-2xl font-semibold">Zahtevi za kredit</h1>

      <Select value={status} onChange={(e) => setStatus(e.target.value as v1LoanRequestStatus)} className="max-w-xs">
        {Object.values(v1LoanRequestStatus).map((s) => (
          <option key={s} value={s}>
            {s === v1LoanRequestStatus.LOAN_REQUEST_STATUS_UNSPECIFIED ? 'Svi' : loanRequestStatusLabel[s]}
          </option>
        ))}
      </Select>

      {requests.data && (
        <Table>
          <THead>
            <TR>
              <TH>Datum</TH>
              <TH>Tip</TH>
              <TH>Kamata</TH>
              <TH className="text-right">Iznos</TH>
              <TH>Rate</TH>
              <TH>Plata</TH>
              <TH>Zaposlenje</TH>
              <TH>Telefon</TH>
              <TH>Status</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {requests.data.requests?.map((r) => (
              <TR key={r.id}>
                <TD className="text-xs">{formatDate(r.createdAt)}</TD>
                <TD>{loanTypeLabel[r.loanType!]}</TD>
                <TD>{interestTypeLabel[r.interestType!]}</TD>
                <TD className="text-right">{formatMoney(r.amount, currencyLabel(r.currency!))}</TD>
                <TD>{r.installmentsTotal}</TD>
                <TD className="text-xs">{formatMoney(r.monthlySalary, currencyLabel(r.currency!))}</TD>
                <TD className="text-xs">{employmentStatusLabel[r.employmentStatus!]}</TD>
                <TD className="text-xs">{r.contactPhone}</TD>
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
                <TD>
                  {canDecide && r.status === v1LoanRequestStatus.LOAN_REQUEST_STATUS_PENDING && (
                    <div className="flex gap-1">
                      <Button
                        className="px-2 py-1 text-xs"
                        onClick={() => decide.mutate({ id: r.id!, approve: true })}
                        disabled={decide.isPending}
                      >
                        Odobri
                      </Button>
                      <Button
                        variant="danger"
                        className="px-2 py-1 text-xs"
                        onClick={() => setRejectId(r.id!)}
                      >
                        Odbij
                      </Button>
                    </div>
                  )}
                </TD>
              </TR>
            ))}
            {(!requests.data.requests || requests.data.requests.length === 0) && (
              <EmptyRow colSpan={10}>Nema zahteva.</EmptyRow>
            )}
          </TBody>
        </Table>
      )}

      <Dialog
        open={!!rejectId}
        onClose={() => setRejectId(null)}
        title="Odbijanje zahteva"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectId(null)}>
              Otkaži
            </Button>
            <Button
              variant="danger"
              onClick={() => rejectId && decide.mutate({ id: rejectId, approve: false, reason })}
              disabled={decide.isPending || !reason}
            >
              Odbij zahtev
            </Button>
          </>
        }
      >
        <div>
          <Label>Razlog odbijanja</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </Dialog>
    </main>
  )
}
