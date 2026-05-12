import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'
import { OTCThreadsPage } from '@/components/trading/OTCThreadsPage'

export const Route = createFileRoute('/_authed/banking/otc/ponude')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!hasAny(perms, [Permissions.OTCRead, Permissions.OTCTradeClient])) {
      throw redirect({ to: '/banking' })
    }
  },
  component: OTCThreadsPage,
})
