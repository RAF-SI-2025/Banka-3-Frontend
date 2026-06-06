import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listScheduledPayments, cancelScheduledPayment } from '@/lib/api/payments'
import { apiError } from '@/lib/api/error'
import { keys } from '@/lib/query-keys'
import { formatMoney, formatAccountNumber, currencyLabel, formatDate } from '@/lib/format'
import { scheduledPaymentStatusLabel } from '@/lib/labels'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ErrorBanner } from '@/components/ui/error'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { v1ScheduledPaymentStatus } from '@/lib/api/generated/models/v1ScheduledPaymentStatus'

export const Route = createFileRoute('/_authed/banking/placanja/zakazana')({
  component: ScheduledPayments,
})

function statusTone(status: v1ScheduledPaymentStatus | undefined) {
  switch (status) {
    case v1ScheduledPaymentStatus.SCHEDULED_PAYMENT_STATUS_COMPLETED:
      return 'green' as const
    case v1ScheduledPaymentStatus.SCHEDULED_PAYMENT_STATUS_FAILED:
      return 'red' as const
    case v1ScheduledPaymentStatus.SCHEDULED_PAYMENT_STATUS_CANCELLED:
      return 'neutral' as const
    default:
      return 'yellow' as const
  }
}

function ScheduledPayments() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const scheduled = useQuery({
    queryKey: keys.scheduledPayment.list(),
    queryFn: () => listScheduledPayments(),
  })

  const cancel = useMutation({
    mutationFn: (id: string) => cancelScheduledPayment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.scheduledPayment.all })
    },
  })

  const rows = scheduled.data?.scheduledPayments ?? []
  const errMsg = cancel.error ? apiError(cancel.error, 'Greška pri otkazivanju zakazanog plaćanja.') : null

  return (
    <main className="container max-w-4xl space-y-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Zakazana plaćanja</h1>
        <Button
          variant="secondary"
          type="button"
          onClick={() => navigate({ to: '/banking/placanja', search: { recipientId: undefined } })}
        >
          Novo plaćanje
        </Button>
      </div>

      {errMsg && <ErrorBanner>{errMsg}</ErrorBanner>}

      <Table>
        <THead>
          <TR>
            <TH>Datum izvršenja</TH>
            <TH>Primalac</TH>
            <TH>Račun primaoca</TH>
            <TH className="text-right">Iznos</TH>
            <TH>Status</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={6}>Nema zakazanih plaćanja.</EmptyRow>
          ) : (
            rows.map((sp) => {
              const canCancel = sp.status === v1ScheduledPaymentStatus.SCHEDULED_PAYMENT_STATUS_SCHEDULED
              return (
                <TR key={sp.id}>
                  <TD className="whitespace-nowrap">{formatDate(sp.scheduledDate)}</TD>
                  <TD>{sp.recipientName || '—'}</TD>
                  <TD className="font-mono text-xs">{formatAccountNumber(sp.toAccountNumber)}</TD>
                  <TD className="text-right">{formatMoney(sp.amount, currencyLabel(sp.currency!))}</TD>
                  <TD>
                    <Badge tone={statusTone(sp.status)}>{scheduledPaymentStatusLabel[sp.status!]}</Badge>
                    {sp.status === v1ScheduledPaymentStatus.SCHEDULED_PAYMENT_STATUS_FAILED && sp.failureReason && (
                      <p className="mt-1 text-xs text-muted-foreground">{sp.failureReason}</p>
                    )}
                  </TD>
                  <TD className="text-right">
                    {canCancel && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={cancel.isPending}
                        onClick={() => cancel.mutate(sp.id!)}
                      >
                        Otkaži
                      </Button>
                    )}
                  </TD>
                </TR>
              )
            })
          )}
        </TBody>
      </Table>
    </main>
  )
}
