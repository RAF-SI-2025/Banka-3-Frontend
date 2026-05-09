import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { listCards, setCardStatus } from '@/lib/api/cards'
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
import { formatMoney } from '@/lib/format'

export const Route = createFileRoute('/_authed/portal/cards/')({
  component: PortalCards,
})

function PortalCards() {
  const qc = useQueryClient()
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

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: v1CardStatus }) => setCardStatus(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.card.all }),
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
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {cards.data.cards?.map((c) => (
              <TR key={c.id}>
                <TD>{c.name || '—'}</TD>
                <TD>{cardBrandLabel[c.brand!]}</TD>
                <TD className="font-mono text-xs">{c.number}</TD>
                <TD className="text-right">{formatMoney(c.cardLimit)}</TD>
                <TD>
                  <Badge tone={c.status === v1CardStatus.CARD_STATUS_ACTIVE ? 'green' : 'red'}>
                    {cardStatusLabel[c.status!]}
                  </Badge>
                </TD>
                <TD>
                  {canWrite && (
                    <div className="flex gap-1">
                      {c.status === v1CardStatus.CARD_STATUS_ACTIVE && (
                        <Button
                          variant="danger"
                          className="px-2 py-1 text-xs"
                          onClick={() => setStatus.mutate({ id: c.id!, status: v1CardStatus.CARD_STATUS_BLOCKED })}
                          disabled={setStatus.isPending}
                        >
                          Blokiraj
                        </Button>
                      )}
                      {c.status === v1CardStatus.CARD_STATUS_BLOCKED && (
                        <Button
                          className="px-2 py-1 text-xs"
                          onClick={() => setStatus.mutate({ id: c.id!, status: v1CardStatus.CARD_STATUS_ACTIVE })}
                          disabled={setStatus.isPending}
                        >
                          Odblokiraj
                        </Button>
                      )}
                      {c.status !== v1CardStatus.CARD_STATUS_DEACTIVATED && (
                        <Button
                          variant="secondary"
                          className="px-2 py-1 text-xs"
                          onClick={() => setStatus.mutate({ id: c.id!, status: v1CardStatus.CARD_STATUS_DEACTIVATED })}
                          disabled={setStatus.isPending}
                        >
                          Deaktiviraj
                        </Button>
                      )}
                    </div>
                  )}
                </TD>
              </TR>
            ))}
            {(!cards.data.cards || cards.data.cards.length === 0) && <EmptyRow colSpan={6}>Nema kartica.</EmptyRow>}
          </TBody>
        </Table>
      )}
    </main>
  )
}
