import { createFileRoute, redirect } from '@tanstack/react-router'
import { WatchlistPage } from '@/components/trading/WatchlistPage'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'

// Trading-floor watchlist surface (todoSpec C3 S35-S39). Same audience
// as the catalog: actuaries + admin.
const TRADING_PERMS = [
  Permissions.Actuary,
  Permissions.ActuarySupervisor,
  Permissions.ActuaryAgent,
] as const

export const Route = createFileRoute('/_authed/portal/trgovina/watchlist')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!hasAny(perms, [...TRADING_PERMS, Permissions.Admin])) {
      throw redirect({ to: '/portal' })
    }
  },
  component: PortalWatchlist,
})

function PortalWatchlist() {
  return <WatchlistPage basePath="/portal/trgovina" />
}
