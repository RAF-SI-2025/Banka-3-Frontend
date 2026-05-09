import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { listLoanRequests, decideLoanRequest, type LoanRequest } from '@/lib/api/loans'
import { getClient } from '@/lib/api/clients'
import { getAccount } from '@/lib/api/accounts'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { formatMoney, formatDate, formatAccountNumber, currencyLabel } from '@/lib/format'
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

  const [detail, setDetail] = useState<LoanRequest | null>(null)
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
      setDetail(null)
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
              <TR key={r.id} onClick={() => setDetail(r)}>
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

      <RequestDetailDialog
        request={detail}
        onClose={() => setDetail(null)}
        canDecide={canDecide}
        onApprove={(id) => decide.mutate({ id, approve: true })}
        onRequestReject={(id) => setRejectId(id)}
        deciding={decide.isPending}
      />

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

function RequestDetailDialog({
  request,
  onClose,
  canDecide,
  onApprove,
  onRequestReject,
  deciding,
}: {
  request: LoanRequest | null
  onClose: () => void
  canDecide: boolean
  onApprove: (id: string) => void
  onRequestReject: (id: string) => void
  deciding: boolean
}) {
  const client = useQuery({
    queryKey: ['client', request?.clientId],
    queryFn: () => getClient(request!.clientId!),
    enabled: !!request?.clientId,
  })
  const account = useQuery({
    queryKey: keys.account.detail(request?.accountId ?? ''),
    queryFn: () => getAccount(request!.accountId!),
    enabled: !!request?.accountId,
  })

  if (!request) return null
  const cur = currencyLabel(request.currency!)
  const isPending = request.status === v1LoanRequestStatus.LOAN_REQUEST_STATUS_PENDING

  return (
    <Dialog
      open={!!request}
      onClose={onClose}
      title={`Zahtev za kredit · ${loanTypeLabel[request.loanType!]}`}
      panelClassName="max-w-3xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Zatvori
          </Button>
          {canDecide && isPending && (
            <>
              <Button variant="danger" onClick={() => onRequestReject(request.id!)} disabled={deciding}>
                Odbij
              </Button>
              <Button onClick={() => onApprove(request.id!)} disabled={deciding}>
                Odobri
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Zahtev</h4>
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
        </section>

        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Klijent</h4>
          {client.isLoading ? (
            <p className="text-sm text-gray-500">Učitavanje…</p>
          ) : client.data ? (
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
              <Field label="Ime i prezime">
                <Link
                  to="/portal/clients/$id"
                  params={{ id: client.data.id! }}
                  className="text-blue-600 hover:underline"
                  onClick={onClose}
                >
                  {[client.data.firstName, client.data.lastName].filter(Boolean).join(' ').trim() || '—'}
                </Link>
              </Field>
              <Field label="Email">{client.data.email}</Field>
              <Field label="Telefon">{client.data.phone}</Field>
              <Field label="Datum rođenja">{formatDate(client.data.dateOfBirth)}</Field>
              <Field label="Adresa" wide>
                {client.data.address || '—'}
              </Field>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Klijent nije dostupan.</p>
          )}
        </section>

        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Račun</h4>
          {account.isLoading ? (
            <p className="text-sm text-gray-500">Učitavanje…</p>
          ) : account.data ? (
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
              <Field label="Broj">
                <Link
                  to="/portal/accounts/$id"
                  params={{ id: account.data.id! }}
                  className="font-mono text-xs text-blue-600 hover:underline"
                  onClick={onClose}
                >
                  {formatAccountNumber(account.data.number)}
                </Link>
              </Field>
              <Field label="Naziv">{account.data.name || '—'}</Field>
              <Field label="Valuta">{currencyLabel(account.data.currency!)}</Field>
              <Field label="Stanje">{formatMoney(account.data.balance, currencyLabel(account.data.currency!))}</Field>
              <Field label="Raspoloživo">
                {formatMoney(account.data.availableBalance, currencyLabel(account.data.currency!))}
              </Field>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Račun nije dostupan.</p>
          )}
        </section>
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
