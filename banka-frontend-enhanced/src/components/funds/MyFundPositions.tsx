import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { listFundPositions, getFund } from '@/lib/api/funds'
import { keys } from '@/lib/query-keys'
import { formatMoney } from '@/lib/format'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { BANK_AS_CLIENT_OWNER_ID } from '@/lib/trading/sentinels'
import { InvestFundDialog } from './InvestFundDialog'
import { WithdrawFundDialog } from './WithdrawFundDialog'
import type { v1Fund } from '@/lib/api/generated/models/v1Fund'
import type { v1FundPosition } from '@/lib/api/generated/models/v1FundPosition'

interface Props {
  basePath: '/portal/portfolio' | '/banking/portfolio'
}

// Spec p.75 "Moji fondovi" — rows show the caller's positions across
// all funds. Supervisors browse the bank's stake (BankAsClient
// sentinel as `client_id`); clients see their own.
export function MyFundPositions({ basePath }: Props) {
  const navigate = useNavigate()
  const perms = useAuthStore((s) => s.permissions)
  const isSupervisor = has(perms, Permissions.FundsManageSupervisor)
  const clientId = isSupervisor ? BANK_AS_CLIENT_OWNER_ID : undefined

  const q = useQuery({
    queryKey: keys.funds.positions({ clientId: clientId ?? 'self' }),
    queryFn: () => listFundPositions({ clientId, status: 'active' }),
    refetchInterval: 30_000,
  })
  const rows = q.data?.positions ?? []

  const [investFor, setInvestFor] = useState<v1FundPosition | null>(null)
  const [withdrawFor, setWithdrawFor] = useState<v1FundPosition | null>(null)
  const [investFund, setInvestFund] = useState<v1Fund | null>(null)
  const [withdrawFund, setWithdrawFund] = useState<v1Fund | null>(null)

  const goDetail = (fundId: string) => {
    if (basePath === '/portal/portfolio') {
      navigate({ to: '/portal/fondovi/$fundId', params: { fundId } })
    } else {
      navigate({ to: '/banking/fondovi/$fundId', params: { fundId } })
    }
  }

  // Invest/Withdraw need the full Fund row; the positions endpoint
  // only carries `fundId` + `fundName`. Lazy-fetch on demand.
  const ensureFund = async (id: string, kind: 'invest' | 'withdraw', pos: v1FundPosition) => {
    const res = await getFund(id)
    if (!res.fund) return
    if (kind === 'invest') {
      setInvestFund(res.fund)
      setInvestFor(pos)
    } else {
      setWithdrawFund(res.fund)
      setWithdrawFor(pos)
    }
  }

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <THead>
              <TR>
                <TH>Naziv fonda</TH>
                <TH className="text-right">Vrednost</TH>
                <TH className="text-right">Udeo</TH>
                <TH className="text-right">Profit</TH>
                <TH>{/* actions */}</TH>
              </TR>
            </THead>
            <TBody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={5}>
                  {q.isFetching ? 'Učitavanje…' : 'Nemate pozicije u fondovima.'}
                </EmptyRow>
              ) : (
                rows.map((p) => {
                  const pn = Number(p.profitRsd ?? '0')
                  const color = pn >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  return (
                    <TR key={p.id} data-cy={`fund-position-${p.id}`}>
                      <TD className="font-medium">{p.fundName ?? p.fundId ?? '—'}</TD>
                      <TD className="text-right tabular-nums">{formatMoney(p.currentValueRsd, 'RSD')}</TD>
                      <TD className="text-right tabular-nums">{p.sharePct ?? '0'}%</TD>
                      <TD className={`text-right tabular-nums ${color}`}>{formatMoney(p.profitRsd, 'RSD')}</TD>
                      <TD className="space-x-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => p.fundId && goDetail(p.fundId)}
                        >
                          Detalji
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          data-cy={`fund-position-invest-${p.id}`}
                          onClick={() => p.fundId && ensureFund(p.fundId, 'invest', p)}
                        >
                          Uplata
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          data-cy={`fund-position-withdraw-${p.id}`}
                          onClick={() => p.fundId && ensureFund(p.fundId, 'withdraw', p)}
                        >
                          Povlačenje
                        </Button>
                      </TD>
                    </TR>
                  )
                })
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <InvestFundDialog
        open={Boolean(investFor && investFund)}
        fund={investFund}
        onClose={() => {
          setInvestFor(null)
          setInvestFund(null)
        }}
      />
      <WithdrawFundDialog
        open={Boolean(withdrawFor && withdrawFund)}
        fund={withdrawFund}
        position={withdrawFor}
        onClose={() => {
          setWithdrawFor(null)
          setWithdrawFund(null)
        }}
      />
    </>
  )
}
