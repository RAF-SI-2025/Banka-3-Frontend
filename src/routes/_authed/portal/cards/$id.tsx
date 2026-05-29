import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listCards, setCardStatus } from '@/lib/api/cards'
import { getAccount } from '@/lib/api/accounts'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardBrandLabel, cardStatusLabel } from '@/lib/labels'
import { v1CardStatus } from '@/lib/api/generated/models/v1CardStatus'
import { formatMoney, formatCardNumber, formatDate, formatAccountNumber } from '@/lib/format'
import { apiError } from '@/lib/api/error'

export const Route = createFileRoute('/_authed/portal/cards/$id')({
  component: PortalCardDetail,
})

function PortalCardDetail() {
  const { id } = Route.useParams()
  const qc = useQueryClient()
  const perms = useAuthStore((s) => s.permissions)
  const canWrite = has(perms, Permissions.CardWrite)

  // No GetCard RPC exists; reuse the list query (cache-hit when arriving
  // from /portal/cards, and keys.card.all invalidation keeps it fresh).
  const cards = useQuery({
    queryKey: keys.card.list({}),
    queryFn: () => listCards(),
  })
  const c = cards.data?.cards?.find((x) => x.id === id)

  const account = useQuery({
    queryKey: keys.account.detail(c?.accountId ?? ''),
    queryFn: () => getAccount(c!.accountId!),
    enabled: !!c?.accountId,
  })

  const setStatus = useMutation({
    mutationFn: (status: v1CardStatus) => setCardStatus(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.card.all }),
  })

  if (cards.isLoading) return <p className="container py-8 text-muted-foreground">Učitavanje…</p>
  if (!c) return <p className="container py-8 text-danger">Kartica nije pronađena.</p>

  return (
    <main className="container space-y-6 py-8">
      <div>
        <Link to="/portal/cards" className="text-sm text-muted-foreground hover:underline">
          ← Kartice
        </Link>
      </div>

      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{c.name || 'Kartica'}</h1>
            <p className="font-mono text-sm text-muted-foreground">{formatCardNumber(c.number)}</p>
          </div>
          <Badge tone={c.status === v1CardStatus.CARD_STATUS_ACTIVE ? 'green' : 'red'}>
            {cardStatusLabel[c.status!]}
          </Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <Field label="Brend">{cardBrandLabel[c.brand!]}</Field>
          <Field label="Limit">{formatMoney(c.cardLimit)}</Field>
          <Field label="Datum isteka">{formatDate(c.expiresAt)}</Field>
          <Field label="Kreirana">{formatDate(c.createdAt)}</Field>
          <Field label="Račun">
            {account.data ? (
              <Link
                to="/portal/accounts/$id"
                params={{ id: account.data.id! }}
                className="font-mono text-xs text-primary hover:underline"
              >
                {formatAccountNumber(account.data.number)}
              </Link>
            ) : (
              '—'
            )}
          </Field>
          <Field label="Naziv računa">{account.data?.name ?? '—'}</Field>
        </div>
      </Card>

      {canWrite && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Akcije</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {c.status === v1CardStatus.CARD_STATUS_ACTIVE && (
              <Button
                variant="danger"
                onClick={() => setStatus.mutate(v1CardStatus.CARD_STATUS_BLOCKED)}
                disabled={setStatus.isPending}
              >
                Blokiraj
              </Button>
            )}
            {c.status === v1CardStatus.CARD_STATUS_BLOCKED && (
              <Button
                onClick={() => setStatus.mutate(v1CardStatus.CARD_STATUS_ACTIVE)}
                disabled={setStatus.isPending}
              >
                Odblokiraj
              </Button>
            )}
            {c.status !== v1CardStatus.CARD_STATUS_DEACTIVATED && (
              <Button
                variant="secondary"
                onClick={() => setStatus.mutate(v1CardStatus.CARD_STATUS_DEACTIVATED)}
                disabled={setStatus.isPending}
              >
                Deaktiviraj
              </Button>
            )}
          </div>
          {setStatus.isError && (
            <p className="mt-3 text-sm text-danger">{apiError(setStatus.error)}</p>
          )}
          {c.status === v1CardStatus.CARD_STATUS_DEACTIVATED && (
            <p className="mt-3 text-sm text-muted-foreground">
              Deaktivirana kartica se ne može ponovo aktivirati.
            </p>
          )}
        </Card>
      )}
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{children}</div>
    </div>
  )
}
