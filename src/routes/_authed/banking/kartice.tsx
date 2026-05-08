import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listCards, setCardStatus } from '@/lib/api/cards'
import { listAccounts } from '@/lib/api/accounts'
import { useAuthStore } from '@/lib/auth/store'
import { keys } from '@/lib/query-keys'
import { formatMoney, formatAccountNumber } from '@/lib/format'
import { cardBrandLabel, cardStatusLabel } from '@/lib/labels'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { v1CardStatus } from '@/lib/api/generated/models/v1CardStatus'

export const Route = createFileRoute('/_authed/banking/kartice')({
  component: ClientCards,
})

function ClientCards() {
  const userId = useAuthStore((s) => s.userId)
  const qc = useQueryClient()

  const accounts = useQuery({
    queryKey: keys.account.list({ ownerClientId: userId }),
    queryFn: () => listAccounts({ ownerClientId: userId ?? undefined }),
    enabled: !!userId,
  })
  const cards = useQuery({
    queryKey: keys.card.list({ ownerClientId: userId }),
    queryFn: () => listCards(),
  })

  const accountIndex = new Map(accounts.data?.accounts?.map((a) => [a.id!, a]) ?? [])

  const block = useMutation({
    mutationFn: (id: string) => setCardStatus(id, { status: v1CardStatus.CARD_STATUS_BLOCKED }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.card.all }),
  })

  return (
    <main className="container space-y-4 py-8">
      <h1 className="text-2xl font-semibold">Kartice</h1>
      {cards.isLoading && <p className="text-gray-500">Učitavanje…</p>}
      {cards.data && (
        <Table>
          <THead>
            <TR>
              <TH>Naziv</TH>
              <TH>Brend</TH>
              <TH>Broj</TH>
              <TH>Račun</TH>
              <TH className="text-right">Limit</TH>
              <TH>Ističe</TH>
              <TH>Status</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {cards.data.cards?.map((c) => {
              const a = accountIndex.get(c.accountId!)
              const currency = a?.currency
              return (
                <TR key={c.id}>
                  <TD>{c.name || '—'}</TD>
                  <TD>{cardBrandLabel[c.brand!]}</TD>
                  <TD className="font-mono text-xs">{c.number}</TD>
                  <TD className="font-mono text-xs">{formatAccountNumber(a?.number)}</TD>
                  <TD className="text-right">{formatMoney(c.cardLimit, currency ? currency.replace('CURRENCY_', '') : '')}</TD>
                  <TD className="text-xs text-gray-600">{c.expiresAt?.slice(0, 10) ?? '—'}</TD>
                  <TD>
                    <Badge tone={c.status === v1CardStatus.CARD_STATUS_ACTIVE ? 'green' : 'red'}>
                      {cardStatusLabel[c.status!]}
                    </Badge>
                  </TD>
                  <TD>
                    {c.status === v1CardStatus.CARD_STATUS_ACTIVE && (
                      <Button
                        variant="danger"
                        className="px-2 py-1 text-xs"
                        onClick={() => block.mutate(c.id!)}
                        disabled={block.isPending}
                      >
                        Blokiraj
                      </Button>
                    )}
                  </TD>
                </TR>
              )
            })}
            {(!cards.data.cards || cards.data.cards.length === 0) && (
              <EmptyRow colSpan={8}>Nemate kartica.</EmptyRow>
            )}
          </TBody>
        </Table>
      )}
      {block.isError && <p className="text-sm text-red-600">Greška pri blokiranju kartice.</p>}
    </main>
  )
}
