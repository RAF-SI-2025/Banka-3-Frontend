import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/auth/store'
import { Permissions, hasAny } from '@/lib/permissions'

// Preset filter for status=pending so supervisors land on it from the
// portal home. Renders the same component as ./index.tsx; we just
// redirect with a search param. Single-component branch in index.tsx
// reads from useSearch.
export const Route = createFileRoute('/_authed/portal/trgovina/nalozi/cekajuci')({
  beforeLoad: () => {
    const perms = useAuthStore.getState().permissions
    if (!hasAny(perms, [Permissions.Admin, Permissions.ActuarySupervisor, Permissions.ActuaryAgent, Permissions.Actuary])) {
      throw redirect({ to: '/portal' })
    }
    throw redirect({
      to: '/portal/trgovina/nalozi',
      search: { status: 'pending' },
    })
  },
})
