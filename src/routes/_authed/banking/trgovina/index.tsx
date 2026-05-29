import { createFileRoute, redirect } from '@tanstack/react-router'
import { ListingsTable } from '@/components/trading/ListingsTable'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'

// Client trading surface. Spec p.40-42: clients trade only stocks +
// futures. Forex and options are exchange-floor only — `showForexAndOptions
// =false` hides those tabs; the gateway also enforces.
export const Route = createFileRoute('/_authed/banking/trgovina/')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!has(perms, Permissions.TradingClient)) {
      throw redirect({ to: '/banking' })
    }
  },
  component: BankingTrgovina,
})

function BankingTrgovina() {
  return <ListingsTable basePath="/banking/trgovina" showForexAndOptions={false} />
}
