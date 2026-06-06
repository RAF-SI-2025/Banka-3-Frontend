import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'
import { OTCHistoryPage } from '@/components/trading/OTCHistoryPage'

export const Route = createFileRoute('/_authed/portal/otc/istorija')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!hasAny(perms, [Permissions.OTCTradeSupervisor, Permissions.Admin])) {
      throw redirect({ to: '/portal' })
    }
  },
  component: OTCHistoryPage,
})
