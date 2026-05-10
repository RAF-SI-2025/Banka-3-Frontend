import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'

// Spec p.57: pending-orders queue is supervisor-only ("Samo zaposleni
// koji su supervizori imaju pristup ovom portalu"). Agents can read
// their own orders via the unfiltered list at ./index.tsx but don't
// approve, so they shouldn't bypass straight into the queue.
export const Route = createFileRoute('/_authed/portal/trgovina/nalozi/cekajuci')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!hasAny(perms, [Permissions.Admin, Permissions.ActuarySupervisor])) {
      throw redirect({ to: '/portal' })
    }
    throw redirect({
      to: '/portal/trgovina/nalozi',
      search: { status: 'pending' },
    })
  },
})
