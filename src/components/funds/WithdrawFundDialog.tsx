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
import type { v1FundPosition } from '@/lib/api/generated/models/v1FundPosition'
import type { v1FundTransactionResponse } from '@/lib/api/generated/models/v1FundTransactionResponse'

interface Props {
  open: boolean
  fund: v1Fund | null
  position: v1FundPosition | null
  onClose: () => void
  onPending?: () => void
}

// Spec p.75. Amount is in RSD (server-side accounting unit). When
// the fund lacks liquidity the server falls into the illiquid path
// (auto-liquidation) and returns pending=true; we surface that as
// a toast.
export function WithdrawFundDialog({ open, fund, position, onClose, onPending }: Props) {
  const qc = useQueryClient()
  const perms = useAuthStore((s) => s.permissions)
  const userId = useAuthStore((s) => s.userId) ?? ''
  const canActAsBank = has(perms, Permissions.FundsManageSupervisor)

  const [onBehalfBank, setOnBehalfBank] = useState(false)
  const [destAccountId, setDestAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [withdrawAll, setWithdrawAll] = useState(false)
  const [showVerify, setShowVerify] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setOnBehalfBank(false)
      setDestAccountId('')
      setAmount('')
      setWithdrawAll(false)
      setShowVerify(false)
      setErr(null)
    }
  }, [open])

  const ownerForList = onBehalfBank ? FOREX_BOOK_OWNER_ID : userId
  const accounts = useQuery({
    queryKey: keys.account.list({ owner: ownerForList, ctx: 'fund-withdraw' }),
    queryFn: () =>
      listAccounts({
        ownerClientId: ownerForList,
        status: v1AccountStatus.ACCOUNT_STATUS_ACTIVE,
      }),
    enabled: open && Boolean(ownerForList),
  })
  const eligible = useMemo(() => accounts.data?.accounts ?? [], [accounts.data])
  useEffect(() => {
    setDestAccountId('')
  }, [onBehalfBank])
  useEffect(() => {
    if (!destAccountId && eligible.length > 0 && eligible[0].id) {
      setDestAccountId(eligible[0].id)
    }
  }, [destAccountId, eligible])

  const withdraw = useMutation({
    mutationFn: async (proof: { id: string; code: string }): Promise<v1FundTransactionResponse> => {
      if (!fund?.id) throw new Error('no fund')
      const { data } = await api.post<v1FundTransactionResponse>(
        `/v1/funds/${encodeURIComponent(fund.id)}/withdraw`,
        {
          amountRsd: withdrawAll ? undefined : amount,
          destAccountId,
          withdrawAll: withdrawAll || undefined,
          onBehalfClientId: onBehalfBank ? BANK_AS_CLIENT_OWNER_ID : undefined,
        },
        { headers: proofHeaders(proof) },
      )
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: keys.funds.all })
      qc.invalidateQueries({ queryKey: keys.account.all })
      if (data.pending && onPending) onPending()
      onClose()
    },
    onError: (e) => setErr(apiError(e, 'Greška prilikom povlačenja iz fonda.')),
  })

  const amountValid = useMemo(() => {
    if (withdrawAll) return true
    const n = Number(amount)
    return Number.isFinite(n) && n > 0
  }, [amount, withdrawAll])
  const canSubmit = Boolean(fund?.id && destAccountId && amountValid)

  return (
    <>
      <Dialog
        open={open && !showVerify}
        onClose={() => {
          if (withdraw.isPending) return
          onClose()
        }}
        title={onBehalfBank ? 'Povlačenje iz fonda (u ime banke)' : 'Povlačenje iz fonda'}
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={withdraw.isPending}>
              Otkaži
            </Button>
            <Button
              variant="primary"
              disabled={!canSubmit}
              data-cy="fund-withdraw-confirm"
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
              {position && (
                <div className="text-xs">
                  Vaša pozicija: {formatMoney(position.currentValueRsd, 'RSD')} (
                  {position.units ?? '0'} jedinica)
                </div>
              )}
            </div>

            {canActAsBank && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  data-cy="fund-withdraw-on-behalf-bank"
                  checked={onBehalfBank}
                  onChange={(e) => setOnBehalfBank(e.target.checked)}
                />
                <span>Povuci u ime banke</span>
              </label>
            )}

            <div>
              <Label htmlFor="fund-withdraw-dest">Odredišni račun</Label>
              <Select
                id="fund-withdraw-dest"
                value={destAccountId}
                onChange={(e) => setDestAccountId(e.target.value)}
                disabled={accounts.isPending || eligible.length === 0}
                data-cy="fund-withdraw-dest"
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
              <Label htmlFor="fund-withdraw-amount">Iznos (RSD)</Label>
              <Input
                id="fund-withdraw-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={withdrawAll}
                data-cy="fund-withdraw-amount"
              />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                data-cy="fund-withdraw-all"
                checked={withdrawAll}
                onChange={(e) => setWithdrawAll(e.target.checked)}
              />
              <span>Povuci celu poziciju</span>
            </label>

            {err && <ErrorBanner>{err}</ErrorBanner>}
          </div>
        )}
      </Dialog>

      <VerificationDialog
        open={showVerify}
        kind="fund_withdraw"
        title="Potvrda povlačenja iz fonda"
        description={
          withdrawAll
            ? `Povlačite celu poziciju iz fonda „${fund?.name ?? ''}".`
            : `Povlačite ${amount || '—'} RSD iz fonda „${fund?.name ?? ''}".`
        }
        onCancel={() => setShowVerify(false)}
        onConfirm={async (proof) => {
          await withdraw.mutateAsync(proof)
        }}
      />
    </>
  )
}
