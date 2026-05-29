import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { listCards } from '@/lib/api/cards'
import { listAccounts } from '@/lib/api/accounts'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CardCreateDialog } from '@/components/cards/card-create-dialog'
import { cardBrandLabel, cardStatusLabel } from '@/lib/labels'
import { v1CardStatus } from '@/lib/api/generated/models/v1CardStatus'
import { formatMoney, formatCardNumber } from '@/lib/format'

export const Route = createFileRoute('/_authed/portal/cards/')({
  component: PortalCards,
})

function PortalCards() {
  const navigate = useNavigate()
  const perms = useAuthStore((s) => s.permissions)
  const canWrite = has(perms, Permissions.CardWrite)
  const [openCreate, setOpenCreate] = useState(false)

  const cards = useQuery({
    queryKey: keys.card.list({}),
    queryFn: () => listCards(),
  })

  const accounts = useQuery({
    queryKey: keys.account.list({ pageSize: 200 }),
    queryFn: () => listAccounts({ pageSize: 200 }),
    enabled: canWrite,
  })

  return (
    <main className="container space-y-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Kartice</h1>
        {canWrite && <Button onClick={() => setOpenCreate(true)}>Nova kartica</Button>}
      </div>
      <CardCreateDialog
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        accounts={accounts.data?.accounts ?? []}
      />
      {cards.data && (
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
            {cards.data.cards?.map((c) => (
              <TR
                key={c.id}
                onClick={() => navigate({ to: '/portal/cards/$id', params: { id: c.id! } })}
              >
                <TD>{c.name || '—'}</TD>
                <TD>{cardBrandLabel[c.brand!]}</TD>
                <TD className="font-mono text-xs">{formatCardNumber(c.number)}</TD>
                <TD className="text-right">{formatMoney(c.cardLimit)}</TD>
                <TD>
                  <Badge tone={c.status === v1CardStatus.CARD_STATUS_ACTIVE ? 'green' : 'red'}>
                    {cardStatusLabel[c.status!]}
                  </Badge>
                </TD>
              </TR>
            ))}
            {(!cards.data.cards || cards.data.cards.length === 0) && <EmptyRow colSpan={5}>Nema kartica.</EmptyRow>}
          </TBody>
        </Table>
      )}
    </main>
  )
}
