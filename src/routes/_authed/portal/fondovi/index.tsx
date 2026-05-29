import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'
import { FundsDiscovery } from '@/components/funds/FundsDiscovery'

export const Route = createFileRoute('/_authed/portal/fondovi/')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (
      !hasAny(perms, [
        Permissions.Admin,
        Permissions.FundsReadSupervisor,
        Permissions.FundsManageSupervisor,
      ])
    ) {
      throw redirect({ to: '/portal' })
    }
  },
  component: () => <FundsDiscovery basePath="/portal/fondovi" />,
})
