import { type ReactNode, type ThHTMLAttributes, type TdHTMLAttributes, type MouseEvent, type KeyboardEvent, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'overflow-x-auto rounded-lg border border-border bg-surface shadow-soft',
        className,
      )}
    >
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
      {children}
    </thead>
  )
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>
}

export function TR({
  children,
  className,
  onClick,
  ...rest
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
} & Omit<HTMLAttributes<HTMLTableRowElement>, 'onClick' | 'className' | 'children'>) {
  if (!onClick) {
    return <tr className={cn(className)} {...rest}>{children}</tr>
  }
  const handleClick = (e: MouseEvent<HTMLTableRowElement>) => {
    // Don't hijack clicks that landed on an interactive element inside a cell
    // (Approve/Reject buttons, status flips, links, etc.).
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, select, textarea, [data-row-stop]')) return
    onClick()
  }
  const handleKey = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }
  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKey}
      className={cn(
        'cursor-pointer transition-colors hover:bg-accent/60 focus:bg-accent/60 focus:outline-none',
        className,
      )}
      {...rest}
    >
      {children}
    </tr>
  )
}

export function TH({ children, className, ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
  return (
    <th className={cn('px-4 py-2.5 font-medium', className)} {...rest}>
      {children}
    </th>
  )
}

export function TD({ children, className, ...rest }: TdHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
  return (
    <td className={cn('px-4 py-2.5 text-foreground', className)} {...rest}>
      {children}
    </td>
  )
}

export function EmptyRow({ colSpan, children = 'Nema rezultata.' }: { colSpan: number; children?: ReactNode }) {
  return (
    <tr>
      <td className="px-4 py-6 text-center text-sm text-muted-foreground" colSpan={colSpan}>
        {children}
      </td>
    </tr>
  )
}
