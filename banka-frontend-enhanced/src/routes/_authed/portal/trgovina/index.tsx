import { createFileRoute, redirect } from '@tanstack/react-router'
import { ListingsTable } from '@/components/trading/ListingsTable'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'

// Catalog visible to anyone on the trading floor: actuaries (supervisor
// + agent + the marker perm) and admins. Basic employees with none of
// these get bounced — there's no per-spec read-only view for them.
const TRADING_PERMS = [
  Permissions.Actuary,
  Permissions.ActuarySupervisor,
  Permissions.ActuaryAgent,
] as const

export const Route = createFileRoute('/_authed/portal/trgovina/')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!hasAny(perms, [...TRADING_PERMS, Permissions.Admin])) {
      throw redirect({ to: '/portal' })
    }
  },
  component: PortalTrgovina,
})

function PortalTrgovina() {
  return <ListingsTable basePath="/portal/trgovina" showForexAndOptions />
}
