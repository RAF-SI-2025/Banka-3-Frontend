import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'
import { OTCContractsPage } from '@/components/trading/OTCContractsPage'

export const Route = createFileRoute('/_authed/banking/otc/ugovori')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!hasAny(perms, [Permissions.OTCRead, Permissions.OTCTradeClient])) {
      throw redirect({ to: '/banking' })
    }
  },
  component: OTCContractsPage,
})
