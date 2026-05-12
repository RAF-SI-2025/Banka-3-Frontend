import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'
import { OTCDiscovery } from '@/components/trading/OTCDiscovery'

export const Route = createFileRoute('/_authed/banking/otc/')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!hasAny(perms, [Permissions.OTCRead, Permissions.OTCTradeClient])) {
      throw redirect({ to: '/banking' })
    }
  },
  component: OTCDiscovery,
})
