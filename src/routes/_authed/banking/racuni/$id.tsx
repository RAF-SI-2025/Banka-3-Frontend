import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  getAccount,
  updateAccountLimits,
  updateAccountName,
} from '@/lib/api/accounts'
import { listTransactions } from '@/lib/api/payments'
import { printTransactionReceipt } from '@/lib/print/transaction-receipt'
import { listCards } from '@/lib/api/cards'
import { getCompany } from '@/lib/api/companies'
import { getClient } from '@/lib/api/clients'
import { apiError } from '@/lib/api/error'
import type { VerificationProof } from '@/lib/api/verification'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import {
  formatMoney,
  formatAccountNumber,
  formatCardNumber,
  formatDateTime,
  currencyLabel,
} from '@/lib/format'
import {
  accountKindLabel,
  accountSubtypeLabel,
  txKindLabel,
  txStatusLabel,
  cardBrandLabel,
  cardStatusLabel,
} from '@/lib/labels'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ErrorBanner } from '@/components/ui/error'
import { VerificationDialog } from '@/components/verification/verification-dialog'
import { v1TransactionStatus } from '@/lib/api/generated/models/v1TransactionStatus'

export const Route = createFileRoute('/_authed/banking/racuni/$id')({
  component: AccountDetail,
})

const renameSchema = z.object({
  name: z.string().min(1, 'Naziv je obavezan').max(64, 'Najviše 64 karaktera'),
})
type RenameValues = z.infer<typeof renameSchema>

const limitsSchema = z.object({
  dailyLimit: z.string().regex(/^[0-9]+(\.[0-9]{1,2})?$/, 'Iznos mora biti broj'),
  monthlyLimit: z.string().regex(/^[0-9]+(\.[0-9]{1,2})?$/, 'Iznos mora biti broj'),
})
type LimitsValues = z.infer<typeof limitsSchema>

function AccountDetail() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  // Use atomic selectors. Returning a fresh object on every render
  // triggers an infinite render loop because the new identity makes
  // zustand re-emit on each schedule.
  const meFirstName = useAuthStore((s) => s.firstName)
  const meLastName = useAuthStore((s) => s.lastName)
  const meUserId = useAuthStore((s) => s.userId)

  const [renameOpen, setRenameOpen] = useState(false)
  const [limitsOpen, setLimitsOpen] = useState(false)
  const [pendingLimits, setPendingLimits] = useState<LimitsValues | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  // Spec p.18 "filtriranje po datumu" — YYYY-MM-DD from the native
  // <input type="date">; converted to T00:00:00Z midnight UTC before
  // hitting grpc-gateway (proto Timestamp rejects bare YYYY-MM-DD per
  // [[yyyymmdd-proto-timestamp]]).
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const txArgs = {
    accountId: id,
    pageSize: 50,
    from: fromDate ? `${fromDate}T00:00:00Z` : undefined,
    to: toDate ? `${toDate}T23:59:59Z` : undefined,
  }

  const account = useQuery({
    queryKey: keys.account.detail(id),
    queryFn: () => getAccount(id),
  })
  const transactions = useQuery({
    queryKey: keys.transaction.list(txArgs),
    queryFn: () => listTransactions(txArgs),
  })
  const cards = useQuery({
    queryKey: keys.card.list({ accountId: id }),
    queryFn: () => listCards(id),
  })
  const company = useQuery({
    queryKey: ['company', account.data?.companyId],
    queryFn: () => getCompany(account.data!.companyId!),
    enabled: !!account.data?.companyId,
  })
  const owner = useQuery({
    queryKey: ['client', account.data?.ownerClientId],
    queryFn: () => getClient(account.data!.ownerClientId!),
    enabled: !!account.data?.ownerClientId,
  })

  if (account.isLoading) return <p className="container py-8 text-muted-foreground">Učitavanje…</p>
  if (!account.data) return <p className="container py-8 text-danger">Greška pri učitavanju.</p>

  const a = account.data
  const cur = currencyLabel(a.currency!)
  const isOwner = a.ownerClientId === meUserId
  const ownerFromQuery = owner.data
    ? [owner.data.firstName, owner.data.lastName].filter(Boolean).join(' ').trim()
    : ''
  const ownerFromStore = isOwner
    ? [meFirstName, meLastName].filter(Boolean).join(' ').trim()
    : ''
  const ownerName = ownerFromQuery || ownerFromStore || '—'
  const isBusiness =
    a.kind === 'ACCOUNT_KIND_BUSINESS_CHECKING_RSD' ||
    a.kind === 'ACCOUNT_KIND_BUSINESS_FX'

  // Spec p.20: Reserved funds is always 0 for now (no inter-bank delays
  // until c5). Always render the field so the layout is stable when
  // c5 lands.
  const reserved = '0'

  // Filter transactions client-side per spec p.18 ("filtriranje po
  // datumu, iznosu, statusu").
  const txList = transactions.data?.transactions ?? []
  const filteredTx = txList.filter((t) => {
    if (statusFilter && t.status !== statusFilter) return false
    const outflow = t.fromAccountId === id
    const amt = Number((outflow ? t.fromAmount : t.toAmount) ?? 0)
    if (minAmount && amt < Number(minAmount)) return false
    if (maxAmount && amt > Number(maxAmount)) return false
    return true
  })

  return (
    <main className="container space-y-6 py-8">
      <div>
        <Link to="/banking/racuni" className="text-sm text-muted-foreground hover:underline">
          ← Računi
        </Link>
      </div>

      <Card className="space-y-3 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{a.name || formatAccountNumber(a.number)}</h1>
            <div className="font-mono text-sm text-muted-foreground">{formatAccountNumber(a.number)}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <Field label="Vlasnik">{ownerName}</Field>
          {isBusiness && <Field label="Firma">{company.data?.name ?? '—'}</Field>}
          <Field label="Tip">{accountKindLabel[a.kind!]}</Field>
          <Field label="Podtip">{accountSubtypeLabel[a.subtype!]}</Field>
          <Field label="Valuta">{cur}</Field>
          <Field label="Mesečno održavanje">{formatMoney(a.maintenanceFee, cur)}</Field>
          <Field label="Stanje">{formatMoney(a.balance, cur)}</Field>
          <Field label="Raspoloživo">{formatMoney(a.availableBalance, cur)}</Field>
          <Field label="Rezervisana sredstva">{formatMoney(reserved, cur)}</Field>
          <Field label="Dnevni limit">{formatMoney(a.dailyLimit, cur)}</Field>
          <Field label="Mesečni limit">{formatMoney(a.monthlyLimit, cur)}</Field>
          <Field label="Dnevno potrošeno">{formatMoney(a.dailySpent, cur)}</Field>
          <Field label="Mesečno potrošeno">{formatMoney(a.monthlySpent, cur)}</Field>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          {isOwner && (
            <Button variant="secondary" onClick={() => setRenameOpen(true)}>
              Promena naziva računa
            </Button>
          )}
          <Button variant="secondary" onClick={() => navigate({ to: '/banking/placanja', search: { recipientId: undefined } })}>
            Novo plaćanje
          </Button>
          {isOwner && (
            <Button variant="secondary" onClick={() => setLimitsOpen(true)}>
              Promena limita
            </Button>
          )}
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
                  <TD className="font-mono text-xs">{formatCardNumber(c.number)}</TD>
                  <TD className="text-right">{formatMoney(c.cardLimit, cur)}</TD>
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
          <p className="text-sm text-muted-foreground">Nemate kartica za ovaj račun.</p>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <h2 className="mr-auto text-lg font-semibold">Transakcije</h2>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Svi</option>
              <option value={v1TransactionStatus.TRANSACTION_STATUS_REALIZED}>Realizovano</option>
              <option value={v1TransactionStatus.TRANSACTION_STATUS_PROCESSING}>U obradi</option>
              <option value={v1TransactionStatus.TRANSACTION_STATUS_REJECTED}>Odbijeno</option>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Min iznos</Label>
            <Input inputMode="decimal" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className="w-28" />
          </div>
          <div>
            <Label className="text-xs">Max iznos</Label>
            <Input inputMode="decimal" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} className="w-28" />
          </div>
          <div>
            <Label className="text-xs">Od datuma</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label className="text-xs">Do datuma</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
          </div>
        </div>
        {transactions.data && filteredTx.length > 0 ? (
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
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {filteredTx.map((t) => {
                const outflow = t.fromAccountId === id
                const counterpartyNumber = outflow ? t.toAccountNumber : t.fromAccountNumber
                const amount = outflow ? t.fromAmount : t.toAmount
                return (
                  <TR key={t.id}>
                    <TD className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(t.createdAt)}</TD>
                    <TD>{txKindLabel[t.kind!]}</TD>
                    <TD>{outflow ? 'Odliv' : 'Priliv'}</TD>
                    <TD className="font-mono text-xs">
                      {counterpartyNumber
                        ? formatAccountNumber(counterpartyNumber)
                        : t.recipientName || '—'}
                    </TD>
                    <TD className="text-xs text-foreground">{t.purpose || t.recipientName || '—'}</TD>
                    <TD className={`text-right ${outflow ? 'text-danger' : 'text-success-soft-foreground'}`}>
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
                    <TD className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        type="button"
                        onClick={() => printTransactionReceipt(t, id)}
                        data-cy={`print-receipt-${t.id}`}
                      >
                        Štampaj
                      </Button>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">Nema transakcija za odabrani filter.</p>
        )}
      </section>

      <RenameDialog
        open={renameOpen}
        currentName={a.name ?? ''}
        onClose={() => setRenameOpen(false)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: keys.account.detail(id) })
          qc.invalidateQueries({ queryKey: keys.account.all })
          setRenameOpen(false)
        }}
        accountId={id}
      />

      <LimitsDialog
        open={limitsOpen}
        defaultValues={{
          dailyLimit: a.dailyLimit ?? '0',
          monthlyLimit: a.monthlyLimit ?? '0',
        }}
        onClose={() => setLimitsOpen(false)}
        onSubmit={(values) => {
          setPendingLimits(values)
          setLimitsOpen(false)
        }}
      />

      <VerificationDialog
        open={!!pendingLimits}
        kind="limit_change"
        title="Potvrda promene limita"
        description="Promena limita zahteva potvrdu verifikacionim kodom."
        onCancel={() => setPendingLimits(null)}
        onConfirm={async (proof: VerificationProof) => {
          if (!pendingLimits) return
          await updateAccountLimits(id, pendingLimits, proof)
          qc.invalidateQueries({ queryKey: keys.account.detail(id) })
          qc.invalidateQueries({ queryKey: keys.account.all })
          setPendingLimits(null)
        }}
      />
    </main>
  )
}

function RenameDialog({
  open,
  currentName,
  accountId,
  onClose,
  onSaved,
}: {
  open: boolean
  currentName: string
  accountId: string
  onClose: () => void
  onSaved: () => void
}) {
  const form = useForm<RenameValues>({
    resolver: zodResolver(renameSchema),
    defaultValues: { name: currentName },
  })

  const submit = useMutation({
    mutationFn: (v: RenameValues) => updateAccountName(accountId, v.name.trim()),
    onSuccess: onSaved,
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Promena naziva računa"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submit.isPending}>
            Otkaži
          </Button>
          <Button onClick={form.handleSubmit((v) => submit.mutate(v))} disabled={submit.isPending}>
            {submit.isPending ? 'Čuvam…' : 'Sačuvaj'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Trenutno ime</Label>
          <p className="text-sm">{currentName || '—'}</p>
        </div>
        <div>
          <Label>Novo ime računa</Label>
          <Input {...form.register('name')} autoFocus />
          {form.formState.errors.name && (
            <p className="mt-1 text-xs text-danger">{form.formState.errors.name.message}</p>
          )}
        </div>
        {submit.error && <ErrorBanner>{apiError(submit.error, 'Greška pri promeni naziva.')}</ErrorBanner>}
      </div>
    </Dialog>
  )
}

function LimitsDialog({
  open,
  defaultValues,
  onClose,
  onSubmit,
}: {
  open: boolean
  defaultValues: LimitsValues
  onClose: () => void
  onSubmit: (v: LimitsValues) => void
}) {
  const form = useForm<LimitsValues>({
    resolver: zodResolver(limitsSchema),
    defaultValues,
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Promena limita"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Otkaži
          </Button>
          <Button onClick={form.handleSubmit(onSubmit)}>Nastavi</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3">
        <div>
          <Label>Dnevni limit</Label>
          <Input inputMode="decimal" {...form.register('dailyLimit')} />
          {form.formState.errors.dailyLimit && (
            <p className="mt-1 text-xs text-danger">{form.formState.errors.dailyLimit.message}</p>
          )}
        </div>
        <div>
          <Label>Mesečni limit</Label>
          <Input inputMode="decimal" {...form.register('monthlyLimit')} />
          {form.formState.errors.monthlyLimit && (
            <p className="mt-1 text-xs text-danger">{form.formState.errors.monthlyLimit.message}</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Sledeći korak: unos verifikacionog koda.</p>
      </div>
    </Dialog>
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
