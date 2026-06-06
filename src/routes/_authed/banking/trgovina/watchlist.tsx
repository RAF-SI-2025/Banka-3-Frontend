import { createFileRoute, redirect } from '@tanstack/react-router'
import { WatchlistPage } from '@/components/trading/WatchlistPage'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'

// Client watchlist surface (todoSpec C3 S35-S39).
export const Route = createFileRoute('/_authed/banking/trgovina/watchlist')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!has(perms, Permissions.TradingClient)) {
      throw redirect({ to: '/banking' })
    }
  },
  component: BankingWatchlist,
})

function BankingWatchlist() {
  return <WatchlistPage basePath="/banking/trgovina" />
}
