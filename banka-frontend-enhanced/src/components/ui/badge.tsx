import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'neutral' | 'green' | 'red' | 'yellow' | 'blue'

const tones: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  green: 'bg-success-soft text-success-soft-foreground',
  red: 'bg-danger-soft text-danger-soft-foreground',
  yellow: 'bg-warning-soft text-warning-soft-foreground',
  blue: 'bg-primary-soft text-primary-soft-foreground',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-current/10',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
