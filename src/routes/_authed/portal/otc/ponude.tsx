import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'
import { OTCThreadsPage } from '@/components/trading/OTCThreadsPage'

export const Route = createFileRoute('/_authed/portal/otc/ponude')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!hasAny(perms, [Permissions.OTCRead, Permissions.OTCTradeSupervisor, Permissions.Admin])) {
      throw redirect({ to: '/portal' })
    }
  },
  component: OTCThreadsPage,
})
