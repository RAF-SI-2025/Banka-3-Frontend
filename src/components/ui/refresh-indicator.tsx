import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  updatedAt: number // ms epoch; 0 = never refreshed
  isFetching: boolean
  onRefresh: () => void
  className?: string
}

// Formats an "HH:MM:SS" stamp for an ms-epoch. Auto-polling pages refresh
// faster than minute granularity, so the global formatDateTime (date +
// HH:MM) wouldn't visibly tick.
function formatHMS(ms: number): string {
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return '—'
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

// RefreshIndicator pairs a manual-refresh button with a "Poslednje
// ažurirano" timestamp for any auto-polling query. The button stays
// enabled during isFetching so a stuck request can be retried; the icon
// spins to surface the in-flight state.
export function RefreshIndicator({ updatedAt, isFetching, onRefresh, className }: Props) {
  return (
    <div
      className={cn('flex items-center gap-3 text-xs text-muted-foreground', className)}
      data-cy="refresh-indicator"
    >
      <span data-cy="last-updated" data-testid="last-updated">
        Poslednje ažurirano: {updatedAt > 0 ? formatHMS(updatedAt) : '—'}
      </span>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        data-cy="refresh-button"
        onClick={onRefresh}
        aria-label="Osveži"
      >
        <RefreshCw className={cn('size-4', isFetching && 'animate-spin')} aria-hidden />
        <span className="ml-1.5">Osveži</span>
      </Button>
    </div>
  )
}
