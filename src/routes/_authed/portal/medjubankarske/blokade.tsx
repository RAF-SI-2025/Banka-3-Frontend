import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listInterbankBlacklist,
  blockInterbankPartner,
  unblockInterbankPartner,
} from '@/lib/api/interbank'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'
import { apiError } from '@/lib/api/error'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error'
import { formatDateTime } from '@/lib/format'

// Blacklist management — list active/historical blocks, manually block a
// partner, and unblock (celina 5).
export const Route = createFileRoute('/_authed/portal/medjubankarske/blokade')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!hasAny(perms, [Permissions.Admin, Permissions.ActuarySupervisor])) {
      throw redirect({ to: '/portal' })
    }
  },
  component: InterbankBlacklistPage,
})

function InterbankBlacklistPage() {
  const qc = useQueryClient()
  const [showHistory, setShowHistory] = useState(false)
  const [routing, setRouting] = useState('')
  const [reason, setReason] = useState('')

  const list = useQuery({
    queryKey: keys.interbank.blacklist(!showHistory),
    queryFn: () => listInterbankBlacklist(!showHistory),
  })

  const block = useMutation({
    mutationFn: () => blockInterbankPartner(Number(routing), reason.trim()),
    onSuccess: () => {
      setRouting('')
      setReason('')
      qc.invalidateQueries({ queryKey: keys.interbank.all })
    },
  })

  const unblock = useMutation({
    mutationFn: (rn: number) => unblockInterbankPartner(rn),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.interbank.all })
    },
  })

  const error =
    (block.error ? apiError(block.error, 'Greška pri blokiranju banke.') : null) ??
    (unblock.error ? apiError(unblock.error, 'Greška pri odblokiranju banke.') : null) ??
    (list.isError ? 'Greška pri učitavanju liste blokada.' : null)

  const entries = list.data?.entries ?? []
  const canBlock = routing.length > 0 && Number(routing) > 0 && !block.isPending

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-lg font-semibold">Blokirane banke</h1>
        <p className="text-sm text-muted-foreground">
          Partnerske banke sa kojima je razmena obustavljena. Banka se automatski
          blokira posle više uzastopnih neuspeha; ovde se može i ručno blokirati ili
          odblokirati.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-md border p-4">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Rutni broj banke
          <Input
            value={routing}
            onChange={(e) => setRouting(e.target.value.replace(/\D/g, ''))}
            placeholder="npr. 444"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
          Razlog
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="npr. sumnjiva aktivnost"
          />
        </label>
        <Button disabled={!canBlock} onClick={() => block.mutate()}>
          Blokiraj
        </Button>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showHistory}
          onChange={(e) => setShowHistory(e.target.checked)}
        />
        Prikaži i istoriju (odblokirane)
      </label>

      <Table>
        <THead>
          <TR>
            <TH>Banka (rutni)</TH>
            <TH>Razlog</TH>
            <TH>Blokirao</TH>
            <TH>Blokirana</TH>
            <TH>Status</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          {entries.length === 0 ? (
            <EmptyRow colSpan={6}>Nema blokiranih banaka.</EmptyRow>
          ) : (
            entries.map((e) => (
              <TR key={e.senderRoutingNumber}>
                <TD>{e.senderRoutingNumber}</TD>
                <TD>{e.reason || '—'}</TD>
                <TD>{e.blockedBy === 'system' ? 'Automatski' : e.blockedBy || '—'}</TD>
                <TD className="whitespace-nowrap">{formatDateTime(e.blockedAt)}</TD>
                <TD className={e.active ? 'text-red-600' : 'text-muted-foreground'}>
                  {e.active ? 'Aktivna blokada' : 'Odblokirana'}
                </TD>
                <TD className="text-right">
                  {e.active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={unblock.isPending}
                      onClick={() => unblock.mutate(e.senderRoutingNumber as number)}
                    >
                      Odblokiraj
                    </Button>
                  )}
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>
    </div>
  )
}
