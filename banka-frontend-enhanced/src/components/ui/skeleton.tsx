import { cn } from '@/lib/utils'

/**
 * Skeleton — a content-placeholder shimmer block.
 *
 * Usage:
 *   <Skeleton className="h-4 w-48" />
 *   <SkeletonTable rows={5} cols={4} />
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted',
        className,
      )}
      aria-hidden
    />
  )
}

/**
 * SkeletonTable — drop-in skeleton for tables while data loads.
 * Renders inside the same Table/THead/TBody/TR/TD wrappers as real data.
 */
export function SkeletonTable({
  rows = 5,
  cols = 4,
  className,
}: {
  rows?: number
  cols?: number
  className?: string
}) {
  const widths = ['w-32', 'w-24', 'w-20', 'w-28', 'w-16', 'w-36']
  return (
    <div className={cn('overflow-x-auto rounded-lg border border-border bg-surface shadow-soft', className)}>
      <table className="w-full text-sm">
        {/* thead shimmer */}
        <thead className="bg-surface-muted">
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <Skeleton className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} className="px-4 py-3">
                  <Skeleton className={cn('h-4', widths[(r * cols + c) % widths.length])} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * SkeletonCard — a card-shaped placeholder.
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border border-border bg-surface p-5 shadow-soft space-y-3', className)}>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-3 w-36" />
    </div>
  )
}
