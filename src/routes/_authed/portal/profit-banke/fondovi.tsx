import { useMemo, useState } from 'react'
import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { listBankFundPositions } from '@/lib/api/profit'
import { getFund } from '@/lib/api/funds'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has, hasAny } from '@/lib/permissions'
import { formatMoney } from '@/lib/format'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { InvestFundDialog } from '@/components/funds/InvestFundDialog'
import { WithdrawFundDialog } from '@/components/funds/WithdrawFundDialog'
import type { v1BankFundPosition } from '@/lib/api/generated/models/v1BankFundPosition'
import type { v1Fund } from '@/lib/api/generated/models/v1Fund'
import type { v1FundPosition } from '@/lib/api/generated/models/v1FundPosition'

const GATE = [Permissions.Admin, Permissions.BankProfitRead] as const

export const Route = createFileRoute('/_authed/portal/profit-banke/fondovi')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!hasAny(perms, [...GATE])) {
      throw redirect({ to: '/portal' })
    }
  },
  component: ProfitFundsPage,
})

type Action = 'invest' | 'withdraw'

function ProfitFundsPage() {
  const perms = useAuthStore((s) => s.permissions)
  const canManage = has(perms, Permissions.FundsManageSupervisor)

  const list = useQuery({
    queryKey: keys.profit.funds,
    queryFn: () => listBankFundPositions(),
  })

  const rows = useMemo(() => {
    const r = list.data?.rows ?? []
    return [...r].sort(
      (a, b) => Number(b.position?.profitRsd ?? 0) - Number(a.position?.profitRsd ?? 0),
    )
  }, [list.data])

  const [pending, setPending] = useState<{
    fundId: string
    position: v1FundPosition | null
    action: Action
  } | null>(null)
  const [pendingToast, setPendingToast] = useState<string | null>(null)

  // Hydrate the fund only when the user clicks an action — dialogs need
  // the full v1Fund (currency, minimum contribution, etc.) but the
  // table renders fine without it.
  const fundQ = useQuery({
    queryKey: keys.funds.detail(pending?.fundId ?? ''),
    queryFn: () => getFund(pending!.fundId),
    enabled: Boolean(pending?.fundId),
  })
  const fund: v1Fund | null = fundQ.data?.fund ?? null

  return (
    <main className="container space-y-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold">Profit banke — pozicije u fondovima</h1>
        <p className="text-sm text-muted-foreground">
          Pozicije banke u investicionim fondovima.
        </p>
      </header>

      {list.isLoading && <p className="text-muted-foreground">Učitavanje…</p>}
      {list.isError && <p className="text-danger">Greška pri učitavanju pozicija.</p>}

      <Table>
        <THead>
          <TR>
            <TH>Fond</TH>
            <TH>Menadžer</TH>
            <TH className="text-right">Udeo (%)</TH>
            <TH className="text-right">Trenutna vrednost (RSD)</TH>
            <TH className="text-right">Profit (RSD)</TH>
            {canManage && <TH className="text-right">Akcije</TH>}
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={canManage ? 6 : 5}>
              {list.isFetching ? 'Učitavanje…' : 'Banka trenutno nema pozicije u fondovima.'}
            </EmptyRow>
          ) : (
            rows.map((row) => <BankFundRow key={row.position?.id ?? row.position?.fundId ?? ''} row={row} canManage={canManage} onAction={(action) => setPending({ fundId: row.position?.fundId ?? '', position: row.position ?? null, action })} />)
          )}
        </TBody>
      </Table>

      {pendingToast && (
        <div
          className="rounded-md border border-warning-soft bg-warning-soft p-3 text-sm text-warning-soft-foreground"
          data-cy="fund-pending-toast"
        >
          {pendingToast}
        </div>
      )}

      <InvestFundDialog
        open={pending?.action === 'invest' && Boolean(fund)}
        fund={fund}
        defaultOnBehalfBank
        onClose={() => setPending(null)}
      />
      <WithdrawFundDialog
        open={pending?.action === 'withdraw' && Boolean(fund)}
        fund={fund}
        position={pending?.position ?? null}
        defaultOnBehalfBank
        onClose={() => setPending(null)}
        onPending={() =>
          setPendingToast('Likvidacija u toku — sredstva stižu uskoro.')
        }
      />
    </main>
  )
}

function BankFundRow({
  row,
  canManage,
  onAction,
}: {
  row: v1BankFundPosition
  canManage: boolean
  onAction: (action: Action) => void
}) {
  const p = row.position
  const fundId = p?.fundId ?? ''
  const sharePct = p?.sharePct ? `${Number(p.sharePct).toFixed(2)}%` : '—'
  return (
    <TR data-cy={`bank-fund-row-${fundId}`}>
      <TD>
        {fundId ? (
          <Link to="/portal/fondovi/$fundId" params={{ fundId }} className="text-primary hover:underline">
            {row.fundName || p?.fundName || '—'}
          </Link>
        ) : (
          <span>{row.fundName || '—'}</span>
        )}
      </TD>
      <TD>
        {row.managerDisplayName || <span className="text-muted-foreground">—</span>}
      </TD>
      <TD className="text-right">{sharePct}</TD>
      <TD className="text-right">{formatMoney(p?.currentValueRsd ?? '0', 'RSD')}</TD>
      <TD className="text-right" data-cy="cell-profit-rsd">
        {formatMoney(p?.profitRsd ?? '0', 'RSD')}
      </TD>
      {canManage && (
        <TD className="text-right">
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="primary"
              data-cy={`bank-fund-invest-${fundId}`}
              onClick={() => onAction('invest')}
              disabled={!fundId}
            >
              Uplata
            </Button>
            <Button
              size="sm"
              variant="ghost"
              data-cy={`bank-fund-withdraw-${fundId}`}
              onClick={() => onAction('withdraw')}
              disabled={!fundId}
            >
              Povlačenje
            </Button>
          </div>
        </TD>
      )}
    </TR>
  )
}
