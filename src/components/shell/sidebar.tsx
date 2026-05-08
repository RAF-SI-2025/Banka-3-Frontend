import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

export interface NavItem {
  to: string
  label: string
  hidden?: boolean
}

export function Sidebar({ items }: { items: NavItem[] }) {
  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 bg-white">
      <nav className="flex flex-col gap-1 p-3 text-sm">
        {items
          .filter((it) => !it.hidden)
          .map((it) => (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                'rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100',
              )}
              activeProps={{ className: 'bg-blue-50 text-blue-700 font-medium' }}
            >
              {it.label}
            </Link>
          ))}
      </nav>
    </aside>
  )
}
