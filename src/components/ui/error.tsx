import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function ErrorBanner({ children, className }: { children: ReactNode; className?: string }) {
  if (!children) return null
  return (
    <div
      role="alert"
      className={cn(
        'rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground',
        className,
      )}
    >
      {children}
    </div>
  )
}
