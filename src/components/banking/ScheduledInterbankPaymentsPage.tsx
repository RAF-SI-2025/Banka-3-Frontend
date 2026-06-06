// Scheduled / periodic inter-bank payments (celina 5 — todoSpec
// "Scheduled/periodic inter-bank payments"). Client surface: a creation
// form (source account, destination bank + account, amount, cadence,
// start date) plus the user's scheduled inter-bank payments with
// pause/resume/cancel. Spec example: "Svakog prvog u mesecu poslati 400
// EUR na dati račun."

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listScheduledInterbankPayments,
  createScheduledInterbankPayment,
  pauseScheduledInterbankPayment,
  resumeScheduledInterbankPayment,
  cancelScheduledInterbankPayment,
  type InterbankCadence,
  type InterbankCurrency,
  type ScheduledInterbankPayment,
} from '@/lib/api/scheduledInterbank'
import { listAccounts } from '@/lib/api/accounts'
import { apiError } from '@/lib/api/error'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { formatMoney, formatDateTime, currencyLabel } from '@/lib/format'
import { v1AccountStatus } from '@/lib/api/generated/models/v1AccountStatus'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ErrorBanner } from '@/components/ui/error'

const CADENCE_LABEL: Record<InterbankCadence, string> = {
  ONCE: 'Jednokratno',
  DAILY: 'Dnevno',
  WEEKLY: 'Nedeljno',
  MONTHLY: 'Mesečno',
}

const CADENCES: InterbankCadence[] = ['ONCE', 'MONTHLY', 'WEEKLY', 'DAILY']

// Maps the bank account's currency string to the trading-service Currency
// enum the cross-bank endpoint expects. Same code on both sides.
function toInterbankCurrency(currency: string | undefined): InterbankCurrency | '' {
  switch (currency) {
    case 'CURRENCY_RSD':
    case 'CURRENCY_EUR':
    case 'CURRENCY_CHF':
    case 'CURRENCY_USD':
    case 'CURRENCY_GBP':
    case 'CURRENCY_JPY':
    case 'CURRENCY_CAD':
    case 'CURRENCY_AUD':
      return currency
    default:
      return ''
  }
}

export function ScheduledInterbankPaymentsPage() {
  const qc = useQueryClient()
  const userId = useAuthStore((s) => s.userId)

  const [sourceAccountId, setSourceAccountId] = useState('')
  const [destBankCode, setDestBankCode] = useState('')
  const [destAccountNumber, setDestAccountNumber] = useState('')
  const [amount, setAmount] = useState('')
  const [purpose, setPurpose] = useState('')
  const [cadence, setCadence] = useState<InterbankCadence>('MONTHLY')
  const [startDate, setStartDate] = useState('')

  const accounts = useQuery({
    queryKey: keys.account.list({ ownerClientId: userId ?? '' }),
    queryFn: () => listAccounts({ ownerClientId: userId ?? undefined }),
    enabled: Boolean(userId),
  })
  const activeAccounts = (accounts.data?.accounts ?? []).filter(
    (a) => a.status === v1AccountStatus.ACCOUNT_STATUS_ACTIVE,
  )

  const selectedAccount = useMemo(
    () => activeAccounts.find((a) => a.id === sourceAccountId),
    [activeAccounts, sourceAccountId],
  )
  const currency = toInterbankCurrency(selectedAccount?.currency)

  const list = useQuery({
    queryKey: keys.scheduledInterbank.list(),
    queryFn: () => listScheduledInterbankPayments(),
  })
  const payments = list.data?.scheduledPayments ?? []

  const create = useMutation({
    mutationFn: () =>
      createScheduledInterbankPayment({
        sourceAccountId,
        destBankCode: destBankCode.trim(),
        destAccountNumber: destAccountNumber.trim(),
        currency: currency as InterbankCurrency,
        amount: amount.trim(),
        purpose: purpose.trim() || undefined,
        cadence,
        // <input type="date"> yields YYYY-MM-DD; pin midnight UTC so it
        // parses as a valid RFC3339 timestamp server-side.
        startDate: startDate ? `${startDate}T00:00:00Z` : undefined,
      }),
    onSuccess: () => {
      setDestBankCode('')
      setDestAccountNumber('')
      setAmount('')
      setPurpose('')
      setStartDate('')
      qc.invalidateQueries({ queryKey: keys.scheduledInterbank.all })
    },
  })

  const pause = useMutation({
    mutationFn: (id: string) => pauseScheduledInterbankPayment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.scheduledInterbank.all }),
  })
  const resume = useMutation({
    mutationFn: (id: string) => resumeScheduledInterbankPayment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.scheduledInterbank.all }),
  })
  const cancel = useMutation({
    mutationFn: (id: string) => cancelScheduledInterbankPayment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.scheduledInterbank.all }),
  })

  // ONCE requires a start date; recurring may omit it (defaults to one
  // interval out). Dest account is the 18-digit partner number.
  const dateValid = cadence !== 'ONCE' || startDate !== ''
  const formValid =
    Boolean(sourceAccountId) &&
    Boolean(currency) &&
    destBankCode.trim().length > 0 &&
    destAccountNumber.trim().length === 18 &&
    Number(amount) > 0 &&
    dateValid

  const errMsg = create.error
    ? apiError(create.error, 'Greška pri zakazivanju inostrane uplate.')
    : null

  return (
    <main className="container space-y-6 py-8">
      <h1 className="text-2xl font-semibold">Zakazane inostrane uplate</h1>
      <p className="text-sm text-muted-foreground">
        Zakažite plaćanje ka drugoj banci jednokratno ili periodično. Na svaki
        termin sistem pokreće prekograničnu uplatu sa izabranog računa (npr.
        „svakog prvog u mesecu poslati 400 EUR na dati račun“).
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Nova zakazana uplata</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (formValid) create.mutate()
            }}
          >
            <div>
              <Label htmlFor="sib-account">Sa računa</Label>
              <Select
                id="sib-account"
                className="w-56"
                value={sourceAccountId}
                onChange={(e) => setSourceAccountId(e.target.value)}
                data-cy="scheduled-interbank-account"
              >
                <option value="">Izaberite račun</option>
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.number} ({currencyLabel(a.currency!)})
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="sib-bank">Banka primaoca (kod)</Label>
              <Input
                id="sib-bank"
                className="w-36"
                placeholder="222"
                value={destBankCode}
                onChange={(e) => setDestBankCode(e.target.value)}
                data-cy="scheduled-interbank-bank"
              />
            </div>

            <div>
              <Label htmlFor="sib-dest">Račun primaoca</Label>
              <Input
                id="sib-dest"
                className="w-64 font-mono"
                placeholder="18 cifara"
                value={destAccountNumber}
                onChange={(e) => setDestAccountNumber(e.target.value)}
                data-cy="scheduled-interbank-dest"
              />
            </div>

            <div>
              <Label htmlFor="sib-amount">Iznos {currency ? `(${currencyLabel(currency)})` : ''}</Label>
              <Input
                id="sib-amount"
                className="w-36"
                inputMode="decimal"
                placeholder="400"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                data-cy="scheduled-interbank-amount"
              />
            </div>

            <div>
              <Label htmlFor="sib-cadence">Učestalost</Label>
              <Select
                id="sib-cadence"
                className="w-40"
                value={cadence}
                onChange={(e) => setCadence(e.target.value as InterbankCadence)}
                data-cy="scheduled-interbank-cadence"
              >
                {CADENCES.map((c) => (
                  <option key={c} value={c}>{CADENCE_LABEL[c]}</option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="sib-date">
                Datum početka{cadence === 'ONCE' ? '' : ' (opciono)'}
              </Label>
              <Input
                id="sib-date"
                className="w-44"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-cy="scheduled-interbank-date"
              />
            </div>

            <div className="w-full sm:w-72">
              <Label htmlFor="sib-purpose">Svrha (opciono)</Label>
              <Input
                id="sib-purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                data-cy="scheduled-interbank-purpose"
              />
            </div>

            <Button type="submit" disabled={!formValid || create.isPending} data-cy="scheduled-interbank-submit">
              {create.isPending ? 'Zakazujem…' : 'Zakaži uplatu'}
            </Button>
          </form>
          {errMsg && <div className="mt-3"><ErrorBanner>{errMsg}</ErrorBanner></div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Moje zakazane uplate</CardTitle>
        </CardHeader>
        <CardContent>
          {list.isLoading ? (
            <p className="text-sm text-muted-foreground">Učitavanje…</p>
          ) : payments.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-cy="scheduled-interbank-empty">
              Nemate nijednu zakazanu inostranu uplatu.
            </p>
          ) : (
            <ul className="divide-y divide-border/40" data-cy="scheduled-interbank-list">
              {payments.map((p) => (
                <ScheduledRow
                  key={p.id}
                  payment={p}
                  onPause={() => pause.mutate(p.id)}
                  onResume={() => resume.mutate(p.id)}
                  onCancel={() => cancel.mutate(p.id)}
                  busy={pause.isPending || resume.isPending || cancel.isPending}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

function ScheduledRow({
  payment,
  onPause,
  onResume,
  onCancel,
  busy,
}: {
  payment: ScheduledInterbankPayment
  onPause: () => void
  onResume: () => void
  onCancel: () => void
  busy: boolean
}) {
  const cadenceLabel = CADENCE_LABEL[payment.cadence as InterbankCadence] ?? payment.cadence
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3" data-cy="scheduled-interbank-item">
      <div className="min-w-0">
        <span className="font-mono text-xs" data-cy="scheduled-interbank-item-dest">
          {payment.destBankCode} · {payment.destAccountNumber}
        </span>
        <span className="ml-2 text-sm text-muted-foreground">
          {formatMoney(payment.amount, currencyLabel(payment.currency))} · {cadenceLabel}
        </span>
        {payment.nextRun && (
          <span className="ml-2 text-xs text-muted-foreground">
            Sledeće: {formatDateTime(payment.nextRun)}
          </span>
        )}
        {payment.lastError && (
          <p className="mt-1 text-xs text-destructive">{payment.lastError}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span data-cy="scheduled-interbank-item-status">
          <Badge tone={payment.active ? 'green' : 'neutral'}>
            {payment.active ? 'Aktivna' : 'Pauzirana'}
          </Badge>
        </span>
        {payment.active ? (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onPause} data-cy="scheduled-interbank-pause">
            Pauziraj
          </Button>
        ) : (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onResume} data-cy="scheduled-interbank-resume">
            Nastavi
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onCancel} data-cy="scheduled-interbank-cancel">
          Otkaži
        </Button>
      </div>
    </li>
  )
}
