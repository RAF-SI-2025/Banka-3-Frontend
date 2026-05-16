import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getBankProfitTimeseries, type ProfitBucket } from '@/lib/api/profit'
import { keys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'
import { formatMoney } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ProfitTimeseriesChart } from '@/components/profit/ProfitTimeseriesChart'

const GATE = [Permissions.Admin, Permissions.BankProfitRead] as const

export const Route = createFileRoute('/_authed/portal/profit-banke/')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!hasAny(perms, [...GATE])) {
      throw redirect({ to: '/portal' })
    }
  },
  component: ProfitTrendPage,
})

const BUCKETS: { value: ProfitBucket; label: string }[] = [
  { value: 'day', label: 'Dnevno' },
  { value: 'week', label: 'Nedeljno' },
  { value: 'month', label: 'Mesečno' },
]

function ProfitTrendPage() {
  const [bucket, setBucket] = useState<ProfitBucket>('day')

  const q = useQuery({
    queryKey: keys.profit.timeseries({ bucket }),
    queryFn: () => getBankProfitTimeseries({ bucket }),
  })

  const buckets = q.data?.buckets ?? []

  return (
    <main className="container space-y-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold">Profit banke — kretanje</h1>
        <p className="text-sm text-muted-foreground">
          Ostvarena kapitalna dobit banke, po periodu i kumulativno
        </p>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Ukupna ostvarena dobit</CardTitle>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {q.isLoading ? '…' : formatMoney(q.data?.totalRsd ?? '0', 'RSD')}
            </p>
          </div>
          <div className="inline-flex rounded-md border border-border p-0.5">
            {BUCKETS.map((b) => (
              <Button
                key={b.value}
                size="sm"
                variant={bucket === b.value ? 'primary' : 'ghost'}
                onClick={() => setBucket(b.value)}
                data-cy={`profit-bucket-${b.value}`}
              >
                {b.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {q.isLoading && <p className="py-12 text-center text-muted-foreground">Učitavanje…</p>}
          {q.isError && (
            <p className="py-12 text-center text-danger">
              Greška pri učitavanju kretanja profita.
            </p>
          )}
          {!q.isLoading && !q.isError && (
            <ProfitTimeseriesChart buckets={buckets} bucket={bucket} />
          )}
        </CardContent>
      </Card>
    </main>
  )
}
