import { createFileRoute, redirect } from '@tanstack/react-router'
import { RecurringOrdersPage } from '@/components/trading/RecurringOrdersPage'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'

// Client recurring-order ("Trajni nalog" / DCA) surface (todoSpec C3
// S47-S53).
export const Route = createFileRoute('/_authed/banking/trgovina/trajni-nalozi')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!has(perms, Permissions.TradingClient)) {
      throw redirect({ to: '/banking' })
    }
  },
  component: BankingRecurringOrders,
})

function BankingRecurringOrders() {
  return <RecurringOrdersPage />
}
