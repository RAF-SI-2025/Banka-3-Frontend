import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { FundsDiscovery } from '@/components/funds/FundsDiscovery'

export const Route = createFileRoute('/_authed/banking/fondovi/')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!has(perms, Permissions.TradingClient)) {
      throw redirect({ to: '/banking' })
    }
  },
  component: () => <FundsDiscovery basePath="/banking/fondovi" />,
})
