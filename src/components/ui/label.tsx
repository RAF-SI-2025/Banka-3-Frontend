import { type LabelHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Label({ className, ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('block text-sm font-medium text-gray-700 mb-1', className)} {...rest} />
}
