import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        rows={3}
        className={cn(
          'block w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-soft',
          'placeholder:text-muted-foreground',
          'focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
          'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
          'resize-y',
          className,
        )}
        {...rest}
      />
    )
  },
)
