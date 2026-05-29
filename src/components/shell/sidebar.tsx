import { Link, useRouterState } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

export interface NavItem {
  to: string
  label: string
  hidden?: boolean
}

export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const visible = items.filter((it) => !it.hidden)
  // Longest-prefix-wins so `/portal/trgovina/nalozi` highlights
  // "Pregled naloga" rather than its parent "/portal/trgovina".
  const activeTo = pickActive(visible.map((it) => it.to), pathname)

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-surface/60 md:block">
      <nav className="sticky top-14 flex flex-col gap-0.5 p-3 text-sm">
        {visible.map((it) => {
          const active = it.to === activeTo
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                'rounded-md px-3 py-2 transition-colors',
                active
                  ? 'bg-primary-soft text-primary-soft-foreground font-medium hover:bg-primary-soft hover:text-primary-soft-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {it.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

function pickActive(routes: string[], pathname: string): string | null {
  let best: string | null = null
  for (const r of routes) {
    if (pathname === r || pathname.startsWith(r + '/')) {
      if (best === null || r.length > best.length) best = r
    }
  }
  return best
}
