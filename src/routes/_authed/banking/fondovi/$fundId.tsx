import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'
import { FundDetail } from '@/components/funds/FundDetail'

export const Route = createFileRoute('/_authed/banking/fondovi/$fundId')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!hasAny(perms, [Permissions.FundsReadClient, Permissions.FundsInvestClient])) {
      throw redirect({ to: '/banking' })
    }
  },
  component: FundDetailRoute,
})

function FundDetailRoute() {
  const { fundId } = Route.useParams()
  return <FundDetail fundId={fundId} />
}
