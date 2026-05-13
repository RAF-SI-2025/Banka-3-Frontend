import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { OTCContractsPage } from '@/components/trading/OTCContractsPage'

export const Route = createFileRoute('/_authed/banking/otc/ugovori')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!has(perms, Permissions.TradingClient)) {
      throw redirect({ to: '/banking' })
    }
  },
  component: OTCContractsPage,
})
