import { Link, useRouterState } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import {
  Home,
  Users,
  UserCircle2,
  Building2,
  Wallet,
  CreditCard,
  FileText,
  BadgeDollarSign,
  ArrowLeftRight,
  TrendingUp,
  BarChart2,
  ClipboardList,
  Briefcase,
  Calculator,
  Landmark,
  Package,
  MessageSquare,
  FileSignature,
  PiggyBank,
  Trophy,
  AreaChart,
  Send,
  RefreshCcw,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  hidden?: boolean
  icon?: LucideIcon
}

const iconMap: Record<string, LucideIcon> = {
  '/portal': Home,
  '/banking': Home,
  '/portal/employees': Users,
  '/portal/clients': UserCircle2,
  '/portal/companies': Building2,
  '/portal/accounts': Wallet,
  '/portal/cards': CreditCard,
  '/portal/loan-requests': FileText,
  '/portal/loans': BadgeDollarSign,
  '/portal/exchange': ArrowLeftRight,
  '/portal/trgovina': TrendingUp,
  '/portal/trgovina/nalozi': ClipboardList,
  '/portal/portfolio': BarChart2,
  '/portal/aktuari': Briefcase,
  '/portal/porez': Calculator,
  '/portal/berze': Landmark,
  '/portal/otc': Package,
  '/portal/otc/ponude': MessageSquare,
  '/portal/otc/ugovori': FileSignature,
  '/portal/fondovi': PiggyBank,
  '/portal/profit-banke/aktuari': Trophy,
  '/portal/profit-banke/fondovi': AreaChart,
  '/banking/racuni': Wallet,
  '/banking/kartice': CreditCard,
  '/banking/placanja': Send,
  '/banking/transferi': RefreshCcw,
  '/banking/menjacnica': ArrowLeftRight,
  '/banking/primaoci': Users,
  '/banking/krediti': BadgeDollarSign,
  '/banking/portfolio': BarChart2,
  '/banking/trgovina': TrendingUp,
  '/banking/trgovina/nalozi': ClipboardList,
  '/banking/otc': Package,
  '/banking/otc/ponude': MessageSquare,
  '/banking/otc/ugovori': FileSignature,
  '/banking/fondovi': PiggyBank,
}

export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const visible = items.filter((it) => !it.hidden)
  const activeTo = pickActive(visible.map((it) => it.to), pathname)

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-surface/60 md:block">
      <nav className="sticky top-14 flex flex-col gap-0.5 p-3 text-sm">
        {visible.map((it) => {
          const active = it.to === activeTo
          const Icon = it.icon ?? iconMap[it.to]
          const isSub = it.label.startsWith('↳')
          const label = isSub ? it.label.replace('↳ ', '') : it.label

          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors',
                isSub && 'ml-5',
                active
                  ? 'bg-primary-soft text-primary-soft-foreground font-medium hover:bg-primary-soft hover:text-primary-soft-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {Icon && !isSub && (
                <Icon className="size-4 shrink-0" aria-hidden />
              )}
              <span>{label}</span>
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
