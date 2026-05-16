import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { listFundPositions, listFunds, getFund } from '@/lib/api/funds'
import { keys } from '@/lib/query-keys'
import { formatMoney } from '@/lib/format'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { InvestFundDialog } from './InvestFundDialog'
import { WithdrawFundDialog } from './WithdrawFundDialog'
import type { v1Fund } from '@/lib/api/generated/models/v1Fund'
import type { v1FundPosition } from '@/lib/api/generated/models/v1FundPosition'

interface Props {
  basePath: '/portal/portfolio' | '/banking/portfolio'
}

// Spec p.75 "Moji fondovi". The view differs by role:
//   - Supervisor: the funds they MANAGE, with fund value + liquidity
//     (the bank's *stake* in funds lives on Profit Banke, p.76 — a
//     different concern, not duplicated here).
//   - Client: their own positions, with value/share/profit + the
//     invest / withdraw options.
export function MyFundPositions({ basePath }: Props) {
  const perms = useAuthStore((s) => s.permissions)
  const isSupervisor = has(perms, Permissions.FundsManageSupervisor)
  return isSupervisor ? (
    <ManagedFunds basePath={basePath} />
  ) : (
    <ClientPositions basePath={basePath} />
  )
}

function fundDetailNav(basePath: Props['basePath']) {
  return basePath === '/portal/portfolio'
    ? ('/portal/fondovi/$fundId' as const)
    : ('/banking/fondovi/$fundId' as const)
}

// Supervisor view — spec p.75: spisak fondova kojima supervizor
// upravlja; Naziv i opis, Vrednost fonda, Likvidnost fonda. Click → detail.
function ManagedFunds({ basePath }: Props) {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.userId) ?? ''

  const q = useQuery({
    queryKey: keys.funds.list({ manager: userId, ctx: 'moji-fondovi' }),
    queryFn: () => listFunds({ managerUserId: userId, status: 'active' }),
    refetchInterval: 30_000,
  })
  const rows = q.data?.funds ?? []
  const to = fundDetailNav(basePath)

  return (
    <Card>
      <CardContent className="pt-6">
        <Table>
          <THead>
            <TR>
              <TH>Naziv</TH>
              <TH>Opis</TH>
              <TH className="text-right">Vrednost fonda</TH>
              <TH className="text-right">Likvidnost</TH>
              <TH>{/* actions */}</TH>
            </TR>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={5}>
                {q.isFetching ? 'Učitavanje…' : 'Ne upravljate nijednim fondom.'}
              </EmptyRow>
            ) : (
              rows.map((f) => (
                <TR key={f.id} data-cy={`managed-fund-${f.id}`}>
                  <TD className="font-medium">{f.name ?? '—'}</TD>
                  <TD className="max-w-md truncate text-muted-foreground">{f.description ?? '—'}</TD>
                  <TD className="text-right tabular-nums">{formatMoney(f.totalValueRsd, 'RSD')}</TD>
                  <TD className="text-right tabular-nums">{formatMoney(f.liquidRsd, 'RSD')}</TD>
                  <TD>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => f.id && navigate({ to, params: { fundId: f.id } })}
                    >
                      Detalji
                    </Button>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// Client view — spec p.75: positions with value/share/profit + the
// invest / withdraw options.
function ClientPositions({ basePath }: Props) {
  const navigate = useNavigate()
  const q = useQuery({
    queryKey: keys.funds.positions({ clientId: 'self' }),
    queryFn: () => listFundPositions({ status: 'active' }),
    refetchInterval: 30_000,
  })
  const rows = q.data?.positions ?? []
  const to = fundDetailNav(basePath)

  const [investFor, setInvestFor] = useState<v1FundPosition | null>(null)
  const [withdrawFor, setWithdrawFor] = useState<v1FundPosition | null>(null)
  const [investFund, setInvestFund] = useState<v1Fund | null>(null)
  const [withdrawFund, setWithdrawFund] = useState<v1Fund | null>(null)

  // Invest/Withdraw need the full Fund row; the positions endpoint
  // only carries fundId + fundName. Lazy-fetch on demand.
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
                <TH>Opis</TH>
                <TH className="text-right">Vrednost fonda</TH>
                <TH className="text-right">Vaš udeo (RSD)</TH>
                <TH className="text-right">Udeo (%)</TH>
                <TH className="text-right">Ostvareni profit</TH>
                <TH>{/* actions */}</TH>
              </TR>
            </THead>
            <TBody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={7}>
                  {q.isFetching ? 'Učitavanje…' : 'Nemate pozicije u fondovima.'}
                </EmptyRow>
              ) : (
                rows.map((p) => {
                  const pn = Number(p.profitRsd ?? '0')
                  const color = pn >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  return (
                    <TR key={p.id} data-cy={`fund-position-${p.id}`}>
                      <TD className="font-medium">{p.fundName ?? p.fundId ?? '—'}</TD>
                      <TD className="max-w-md truncate text-muted-foreground">{p.fundDescription ?? '—'}</TD>
                      <TD className="text-right tabular-nums">{formatMoney(p.fundTotalValueRsd, 'RSD')}</TD>
                      <TD className="text-right tabular-nums">{formatMoney(p.currentValueRsd, 'RSD')}</TD>
                      <TD className="text-right tabular-nums">{p.sharePct ?? '0'}%</TD>
                      <TD className={`text-right tabular-nums ${color}`}>{formatMoney(p.profitRsd, 'RSD')}</TD>
                      <TD className="space-x-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => p.fundId && navigate({ to, params: { fundId: p.fundId } })}
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
