import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ErrorBanner } from '@/components/ui/error'
import { listAccounts } from '@/lib/api/accounts'
import { proofHeaders } from '@/lib/api/verification'
import { api } from '@/lib/api/client'
import { keys } from '@/lib/query-keys'
import { apiError } from '@/lib/api/error'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { v1AccountStatus } from '@/lib/api/generated/models/v1AccountStatus'
import { v1AccountKind } from '@/lib/api/generated/models/v1AccountKind'
import { bankaBankV1Currency } from '@/lib/api/generated/models/bankaBankV1Currency'
import { BANK_AS_CLIENT_OWNER_ID, FOREX_BOOK_OWNER_ID } from '@/lib/trading/sentinels'
import { currencyLabel, formatMoney } from '@/lib/format'
import { VerificationDialog } from '@/components/verification/verification-dialog'
import type { v1Fund } from '@/lib/api/generated/models/v1Fund'
import type { v1FundTransactionResponse } from '@/lib/api/generated/models/v1FundTransactionResponse'

interface Props {
  open: boolean
  fund: v1Fund | null
  onClose: () => void
  defaultOnBehalfBank?: boolean
}

// Spec p.71-75. Clients invest from their own accounts; supervisors
// can additionally invest "u ime banke" (BANK_AS_CLIENT sentinel + a
// bank-side source account). Amount is in RSD — the fund's accounting
// unit (ClientFundTransaction.Iznos / minimumContribution are RSD).
// When the source account is FX the server converts RSD → that
// currency for the debit (commission on top for clients), so the fund
// always receives the full committed RSD. Mirrors WithdrawFundDialog.
export function InvestFundDialog({ open, fund, onClose, defaultOnBehalfBank = false }: Props) {
  const qc = useQueryClient()
  const perms = useAuthStore((s) => s.permissions)
  const userId = useAuthStore((s) => s.userId) ?? ''
  const canActAsBank = has(perms, Permissions.FundsManageSupervisor)

  const [onBehalfBank, setOnBehalfBank] = useState(false)
  const [sourceAccountId, setSourceAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setOnBehalfBank(canActAsBank && defaultOnBehalfBank)
      setSourceAccountId('')
      setAmount('')
      setShowVerify(false)
      setErr(null)
    }
  }, [open, canActAsBank, defaultOnBehalfBank])

  const ownerForList = onBehalfBank ? FOREX_BOOK_OWNER_ID : userId
  const accounts = useQuery({
    queryKey: keys.account.list({ owner: ownerForList, ctx: 'fund-invest' }),
    queryFn: () =>
      listAccounts({
        ownerClientId: ownerForList,
        status: v1AccountStatus.ACCOUNT_STATUS_ACTIVE,
        // bank.ListAccounts excludes forex_book by default; pass `kind`
        // explicitly when the supervisor is investing in the bank's
        // name so the picker sees the bank's per-currency book accounts.
        ...(onBehalfBank ? { kind: v1AccountKind.ACCOUNT_KIND_FOREX_BOOK } : {}),
      }),
    enabled: open && Boolean(ownerForList),
  })

  const eligible = useMemo(() => accounts.data?.accounts ?? [], [accounts.data])
  useEffect(() => {
    setSourceAccountId('')
  }, [onBehalfBank])
  useEffect(() => {
    if (!sourceAccountId && eligible.length > 0 && eligible[0].id) {
      setSourceAccountId(eligible[0].id)
    }
  }, [sourceAccountId, eligible])

  const selected = eligible.find((a) => a.id === sourceAccountId)

  const invest = useMutation({
    mutationFn: async (proof: { id: string; code: string }): Promise<v1FundTransactionResponse> => {
      if (!fund?.id) throw new Error('no fund')
      const { data } = await api.post<v1FundTransactionResponse>(
        `/v1/funds/${encodeURIComponent(fund.id)}/invest`,
        {
          amountRsd: amount,
          sourceAccountId,
          onBehalfClientId: onBehalfBank ? BANK_AS_CLIENT_OWNER_ID : undefined,
        },
        { headers: proofHeaders(proof) },
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.funds.all })
      qc.invalidateQueries({ queryKey: keys.account.all })
      setShowVerify(false)
      onClose()
    },
    onError: (e) => setErr(apiError(e, 'Greška prilikom uplate u fond.')),
  })

  const amountNum = useMemo(() => Number(amount), [amount])
  const amountValid = Number.isFinite(amountNum) && amountNum > 0
  // minimumContribution is RSD and the amount is now RSD too, so the
  // spec p.74 "proveriti constraint za minimumContribution" gate is
  // enforceable client-side (the server re-checks authoritatively).
  const minContribution = Number(fund?.minimumContribution ?? 0)
  const belowMin =
    amountValid && minContribution > 0 && amountNum < minContribution
  const canSubmit = Boolean(fund?.id && sourceAccountId && amountValid && !belowMin)
  return (
    <>
      <Dialog
        open={open && !showVerify}
        onClose={() => {
          if (invest.isPending) return
          onClose()
        }}
        title={onBehalfBank ? 'Uplata u fond (u ime banke)' : 'Uplata u fond'}
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={invest.isPending}>
              Otkaži
            </Button>
            <Button
              variant="primary"
              disabled={!canSubmit}
              data-cy="fund-invest-confirm"
              onClick={() => {
                setErr(null)
                setShowVerify(true)
              }}
            >
              Potvrdi
            </Button>
          </>
        }
      >
        {fund && (
          <div className="space-y-3 text-sm">
            <div className="rounded-md bg-primary-soft p-3 text-primary-soft-foreground">
              <div className="font-medium">{fund.name}</div>
              <div className="text-xs">Min. uplata: {formatMoney(fund.minimumContribution, 'RSD')}</div>
            </div>

            {canActAsBank && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  data-cy="fund-invest-on-behalf-bank"
                  checked={onBehalfBank}
                  onChange={(e) => setOnBehalfBank(e.target.checked)}
                />
                <span>Investiraj u ime banke</span>
              </label>
            )}

            <div>
              <Label htmlFor="fund-invest-source">Izvorni račun</Label>
              <Select
                id="fund-invest-source"
                value={sourceAccountId}
                onChange={(e) => setSourceAccountId(e.target.value)}
                disabled={accounts.isPending || eligible.length === 0}
                data-cy="fund-invest-source"
              >
                {eligible.length === 0 ? (
                  <option value="">Nema raspoloživih računa</option>
                ) : (
                  eligible.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.number} — {formatMoney(a.availableBalance, a.currency)} (
                      {currencyLabel(a.currency ?? '')})
                    </option>
                  ))
                )}
              </Select>
            </div>

            <div>
              <Label htmlFor="fund-invest-amount">Iznos (RSD)</Label>
              <Input
                id="fund-invest-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                data-cy="fund-invest-amount"
              />
              {selected?.currency &&
                selected.currency !== bankaBankV1Currency.CURRENCY_RSD && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Sredstva se konvertuju iz {currencyLabel(selected.currency)} u
                  RSD po prodajnom kursu{onBehalfBank ? '' : ' uz proviziju'}.
                </p>
              )}
              {belowMin && (
                <p className="mt-1 text-xs text-destructive" data-cy="fund-invest-below-min">
                  Iznos je ispod minimalnog uloga (
                  {formatMoney(fund.minimumContribution, 'RSD')}).
                </p>
              )}
            </div>

            {err && <ErrorBanner>{err}</ErrorBanner>}
          </div>
        )}
      </Dialog>

      <VerificationDialog
        open={showVerify}
        kind="fund_invest"
        title="Potvrda uplate u fond"
        description={`Uplaćujete ${amount || '—'} RSD u fond „${fund?.name ?? ''}".`}
        onCancel={() => setShowVerify(false)}
        onConfirm={async (proof) => {
          await invest.mutateAsync(proof)
        }}
      />
    </>
  )
}
