import { type ReactNode, type ThHTMLAttributes, type TdHTMLAttributes } from 'react'
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

export function TR({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn('border-t border-gray-100', className)}>{children}</tr>
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
