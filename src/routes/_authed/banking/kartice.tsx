import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { listCards, setCardStatus, updateCardLimit, type Card } from '@/lib/api/cards'
import { listAccounts } from '@/lib/api/accounts'
import { useAuthStore } from '@/lib/auth/store'
import { keys } from '@/lib/query-keys'
import { formatMoney, formatAccountNumber, formatCardNumber } from '@/lib/format'
import { cardBrandLabel, cardStatusLabel } from '@/lib/labels'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CardCreateDialog } from '@/components/cards/card-create-dialog'
import { VerificationDialog } from '@/components/verification/verification-dialog'
import type { VerificationProof } from '@/lib/api/verification'
import { v1CardStatus } from '@/lib/api/generated/models/v1CardStatus'

export const Route = createFileRoute('/_authed/banking/kartice')({
  component: ClientCards,
})

function ClientCards() {
  const userId = useAuthStore((s) => s.userId)
  const qc = useQueryClient()
  const [openCreate, setOpenCreate] = useState(false)
  const [editLimitFor, setEditLimitFor] = useState<Card | null>(null)
  const [pendingLimit, setPendingLimit] = useState<{ id: string; cardLimit: string } | null>(null)

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Kartice</h1>
        <Button onClick={() => setOpenCreate(true)}>Nova kartica</Button>
      </div>
      <CardCreateDialog
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        accounts={accounts.data?.accounts ?? []}
      />
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
                  <TD className="font-mono text-xs">{formatCardNumber(c.number)}</TD>
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
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          className="px-2 py-1 text-xs"
                          onClick={() => setEditLimitFor(c)}
                        >
                          Limit
                        </Button>
                        <Button
                          variant="danger"
                          className="px-2 py-1 text-xs"
                          onClick={() => block.mutate(c.id!)}
                          disabled={block.isPending}
                        >
                          Blokiraj
                        </Button>
                      </div>
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

      <CardLimitDialog
        card={editLimitFor}
        onClose={() => setEditLimitFor(null)}
        onSubmit={(cardLimit) => {
          if (!editLimitFor?.id) return
          setPendingLimit({ id: editLimitFor.id, cardLimit })
          setEditLimitFor(null)
        }}
      />

      <VerificationDialog
        open={!!pendingLimit}
        kind="limit_change"
        title="Potvrda promene limita"
        description="Promena limita kartice zahteva potvrdu verifikacionim kodom."
        onCancel={() => setPendingLimit(null)}
        onConfirm={async (proof: VerificationProof) => {
          if (!pendingLimit) return
          await updateCardLimit(pendingLimit.id, pendingLimit.cardLimit, proof)
          qc.invalidateQueries({ queryKey: keys.card.all })
          setPendingLimit(null)
        }}
      />
    </main>
  )
}

function CardLimitDialog({
  card,
  onClose,
  onSubmit,
}: {
  card: Card | null
  onClose: () => void
  onSubmit: (cardLimit: string) => void
}) {
  const [value, setValue] = useState('')
  return (
    <Dialog open={!!card} onClose={onClose} title="Promena limita kartice">
      <p className="text-sm text-gray-600">
        Trenutni limit: <span className="font-medium">{card?.cardLimit ?? '—'}</span>
      </p>
      <div className="mt-3">
        <Label>Novi limit</Label>
        <Input
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="npr. 100000"
          autoFocus
        />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Otkaži
        </Button>
        <Button
          onClick={() => {
            const trimmed = value.trim()
            if (!/^\d+(\.\d{1,2})?$/.test(trimmed) || Number(trimmed) <= 0) return
            onSubmit(trimmed)
            setValue('')
          }}
        >
          Nastavi
        </Button>
      </div>
    </Dialog>
  )
}
