import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { OTCHistoryPage } from '@/components/trading/OTCHistoryPage'

export const Route = createFileRoute('/_authed/banking/otc/istorija')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!has(perms, Permissions.TradingClient)) {
      throw redirect({ to: '/banking' })
    }
  },
  component: OTCHistoryPage,
})
