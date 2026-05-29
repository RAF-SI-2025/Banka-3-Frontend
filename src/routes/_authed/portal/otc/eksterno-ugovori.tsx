import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'
import { ExternalOTCContractsPage } from '@/components/trading/ExternalOTCContractsPage'

export const Route = createFileRoute('/_authed/portal/otc/eksterno-ugovori')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!hasAny(perms, [Permissions.OTCTradeSupervisor, Permissions.Admin])) {
      throw redirect({ to: '/portal' })
    }
  },
  component: ExternalOTCContractsPage,
})
