import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorBanner } from '@/components/ui/error'
import { placeOrder } from '@/lib/api/orders'
import { keys } from '@/lib/query-keys'
import { apiError } from '@/lib/api/error'
import { v1OrderType } from '@/lib/api/generated/models/v1OrderType'
import { v1Direction } from '@/lib/api/generated/models/v1Direction'
import type { v1Fund } from '@/lib/api/generated/models/v1Fund'
import type { v1FundHolding } from '@/lib/api/generated/models/v1FundHolding'

interface Props {
  open: boolean
  fund: v1Fund | null
  holding: v1FundHolding | null
  onClose: () => void
}

// Supervisor-only: place a fund-actor MARKET SELL order on one of
// the fund's holdings (spec p.74). The bank service settles against
// the fund's bank account because the order carries `on_behalf_of_fund_id`.
export function FundSellHoldingDialog({ open, fund, holding, onClose }: Props) {
  const qc = useQueryClient()
  const [qty, setQty] = useState('')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setQty(String(holding?.quantity ?? ''))
      setErr(null)
    }
  }, [open, holding?.quantity])

  const sell = useMutation({
    mutationFn: () => {
      if (!fund?.id) throw new Error('no fund')
      if (!holding?.security?.id) throw new Error('no security')
      const n = Number(qty)
      if (!Number.isFinite(n) || n <= 0) throw new Error('Količina mora biti pozitivan ceo broj.')
      return placeOrder({
        securityId: holding.security.id,
        orderType: v1OrderType.ORDER_TYPE_MARKET,
        direction: v1Direction.DIRECTION_SELL,
        quantity: Math.floor(n),
        accountId: fund.bankAccountId,
        onBehalfOfFundId: fund.id,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.funds.all })
      qc.invalidateQueries({ queryKey: keys.order.all })
      onClose()
    },
    onError: (e) => setErr(apiError(e, 'Greška prilikom prodaje hartije.')),
  })

  const max = holding?.quantity ?? 0
  const qtyN = Number(qty)
  const valid = Number.isFinite(qtyN) && qtyN > 0 && qtyN <= max

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (sell.isPending) return
        onClose()
      }}
      title="Prodaja hartije iz fonda"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={sell.isPending}>
            Otkaži
          </Button>
          <Button
            variant="primary"
            disabled={!valid || sell.isPending}
            data-cy="fund-sell-confirm"
            onClick={() => sell.mutate()}
          >
            {sell.isPending ? 'Slanje…' : 'Prodaj'}
          </Button>
        </>
      }
    >
      {holding && (
        <div className="space-y-3 text-sm">
          <p>
            Prodajete iz fonda <span className="font-medium">{fund?.name}</span> hartiju{' '}
            <span className="font-mono">{holding.security?.ticker}</span> kao MARKET nalog.
          </p>
          <div>
            <Label htmlFor="fund-sell-qty">Količina (max {max})</Label>
            <Input
              id="fund-sell-qty"
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))}
              data-cy="fund-sell-qty"
            />
          </div>
          {err && <ErrorBanner>{err}</ErrorBanner>}
        </div>
      )}
    </Dialog>
  )
}
