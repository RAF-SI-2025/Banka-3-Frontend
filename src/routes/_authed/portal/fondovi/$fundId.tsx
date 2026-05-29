import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'
import { FundDetail } from '@/components/funds/FundDetail'

export const Route = createFileRoute('/_authed/portal/fondovi/$fundId')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (
      !hasAny(perms, [
        Permissions.Admin,
        Permissions.FundsReadSupervisor,
        Permissions.FundsManageSupervisor,
        // Profit Banke (spec p.76) links each fund row here; a
        // supervisor holding only bank.profit.read must reach the
        // detail view rather than dead-ending back on /portal.
        Permissions.BankProfitRead,
      ])
    ) {
      throw redirect({ to: '/portal' })
    }
  },
  component: FundDetailRoute,
})

function FundDetailRoute() {
  const { fundId } = Route.useParams()
  return <FundDetail fundId={fundId} />
}
