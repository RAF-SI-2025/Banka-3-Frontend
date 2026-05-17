import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
}

export const Checkbox = forwardRef<HTMLInputElement, Props>(function Checkbox(
  { className, label, id, ...rest },
  ref,
) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'inline-flex cursor-pointer items-center gap-2 text-sm',
        rest.disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className={cn(
          'size-4 rounded border border-input bg-surface',
          'accent-primary cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed',
        )}
        {...rest}
      />
      {label && <span className="select-none">{label}</span>}
    </label>
  )
})
