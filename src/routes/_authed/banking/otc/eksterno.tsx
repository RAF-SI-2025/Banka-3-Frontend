import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { ExternalOTCDiscovery } from '@/components/trading/ExternalOTCDiscovery'

export const Route = createFileRoute('/_authed/banking/otc/eksterno')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!has(perms, Permissions.TradingClient)) {
      throw redirect({ to: '/banking' })
    }
  },
  component: ExternalOTCDiscovery,
})
