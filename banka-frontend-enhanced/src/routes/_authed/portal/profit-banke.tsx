import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'

const GATE = [Permissions.Admin, Permissions.BankProfitRead] as const

// Layout wrapper for /portal/profit-banke/*.
// Guards access at the layout level so sub-routes don't each re-check.
export const Route = createFileRoute('/_authed/portal/profit-banke')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!hasAny(perms, [...GATE])) {
      throw redirect({ to: '/portal' })
    }
  },
  component: () => <Outlet />,
})
