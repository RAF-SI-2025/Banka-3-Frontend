import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'neutral' | 'green' | 'red' | 'yellow' | 'blue'

const tones: Record<Tone, string> = {
  neutral: 'bg-gray-100 text-gray-800',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  blue: 'bg-blue-100 text-blue-800',
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
