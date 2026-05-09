import { type ReactNode, type ThHTMLAttributes, type TdHTMLAttributes, type MouseEvent, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded-lg border border-gray-200 bg-white', className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-gray-50 text-left">{children}</thead>
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>
}

export function TR({
  children,
  className,
  onClick,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
}) {
  if (!onClick) {
    return <tr className={cn('border-t border-gray-100', className)}>{children}</tr>
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
        'cursor-pointer border-t border-gray-100 transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none',
        className,
      )}
    >
      {children}
    </tr>
  )
}

export function TH({ children, className, ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
  return (
    <th className={cn('px-4 py-2 font-medium', className)} {...rest}>
      {children}
    </th>
  )
}

export function TD({ children, className, ...rest }: TdHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
  return (
    <td className={cn('px-4 py-2', className)} {...rest}>
      {children}
    </td>
  )
}

export function EmptyRow({ colSpan, children = 'Nema rezultata.' }: { colSpan: number; children?: ReactNode }) {
  return (
    <tr>
      <td className="px-4 py-3 text-gray-500" colSpan={colSpan}>
        {children}
      </td>
    </tr>
  )
}
