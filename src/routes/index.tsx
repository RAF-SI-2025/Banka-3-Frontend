import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/auth/store'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    const { accessToken, userKind } = useAuthStore.getState()
    if (!accessToken) throw redirect({ to: '/login' })
    if (userKind === 'employee') throw redirect({ to: '/portal' })
    throw redirect({ to: '/banking' })
  },
  component: () => null,
})
