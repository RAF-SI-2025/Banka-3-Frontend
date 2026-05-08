import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function ErrorBanner({ children, className }: { children: ReactNode; className?: string }) {
  if (!children) return null
  return (
    <div
      role="alert"
      className={cn('rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800', className)}
    >
      {children}
    </div>
  )
}
