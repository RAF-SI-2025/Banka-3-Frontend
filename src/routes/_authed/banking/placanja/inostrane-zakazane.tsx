import { createFileRoute, redirect } from '@tanstack/react-router'
import { ScheduledInterbankPaymentsPage } from '@/components/banking/ScheduledInterbankPaymentsPage'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, has } from '@/lib/permissions'

// Client scheduled / periodic inter-bank payments surface (celina 5 —
// todoSpec "Scheduled/periodic inter-bank payments").
export const Route = createFileRoute('/_authed/banking/placanja/inostrane-zakazane')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!has(perms, Permissions.PaymentWrite)) {
      throw redirect({ to: '/banking' })
    }
  },
  component: BankingScheduledInterbank,
})

function BankingScheduledInterbank() {
  return <ScheduledInterbankPaymentsPage />
}
