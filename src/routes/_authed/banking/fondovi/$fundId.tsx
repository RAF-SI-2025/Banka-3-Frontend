import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'
import { FundDetail } from '@/components/funds/FundDetail'

export const Route = createFileRoute('/_authed/banking/fondovi/$fundId')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!has(perms, Permissions.TradingClient)) {
      throw redirect({ to: '/banking' })
    }
  },
  component: FundDetailRoute,
})

function FundDetailRoute() {
  const { fundId } = Route.useParams()
  return <FundDetail fundId={fundId} />
}
