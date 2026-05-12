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

// Spec p.75. Clients invest from their own accounts; supervisors can
// additionally invest "u ime banke" (BANK_AS_CLIENT sentinel + a
// bank-side source account). Amount is in source-account currency;
// server converts to RSD via menjačnica.
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
          amount,
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
      onClose()
    },
    onError: (e) => setErr(apiError(e, 'Greška prilikom uplate u fond.')),
  })

  const amountValid = useMemo(() => {
    const n = Number(amount)
    return Number.isFinite(n) && n > 0
  }, [amount])
  const canSubmit = Boolean(fund?.id && sourceAccountId && amountValid)

  // The fund's `minimumContribution` is RSD; we cannot enforce it
  // here when the source account is FX (server converts), so just
  // surface it as info text.
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
              <Label htmlFor="fund-invest-amount">
                Iznos {selected?.currency ? `(${currencyLabel(selected.currency)})` : ''}
              </Label>
              <Input
                id="fund-invest-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                data-cy="fund-invest-amount"
              />
            </div>

            {err && <ErrorBanner>{err}</ErrorBanner>}
          </div>
        )}
      </Dialog>

      <VerificationDialog
        open={showVerify}
        kind="fund_invest"
        title="Potvrda uplate u fond"
        description={`Uplaćujete ${amount || '—'} u fond „${fund?.name ?? ''}".`}
        onCancel={() => setShowVerify(false)}
        onConfirm={async (proof) => {
          await invest.mutateAsync(proof)
        }}
      />
    </>
  )
}
