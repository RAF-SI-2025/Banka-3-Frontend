import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

export interface NavItem {
  to: string
  label: string
  hidden?: boolean
}

export function Sidebar({ items }: { items: NavItem[] }) {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-surface/60 md:block">
      <nav className="sticky top-14 flex flex-col gap-0.5 p-3 text-sm">
        {items
          .filter((it) => !it.hidden)
          .map((it) => (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                'rounded-md px-3 py-2 text-muted-foreground transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
              )}
              activeProps={{
                className:
                  'bg-primary-soft text-primary-soft-foreground font-medium hover:bg-primary-soft hover:text-primary-soft-foreground',
              }}
            >
              {it.label}
            </Link>
          ))}
      </nav>
    </aside>
  )
}
