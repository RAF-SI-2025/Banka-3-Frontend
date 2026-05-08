import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { useBootstrapAuth } from '@/lib/auth/use-auth'

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

function RootLayout() {
  const ready = useBootstrapAuth()
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Učitavanje…
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Outlet />
    </div>
  )
}
