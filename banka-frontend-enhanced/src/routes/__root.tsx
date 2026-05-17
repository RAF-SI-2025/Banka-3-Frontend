import { createRootRouteWithContext, Outlet, type ErrorComponentProps } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { useBootstrapAuth } from '@/lib/auth/use-auth'
import { ToastProvider } from '@/components/ui/toast'

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  errorComponent: RootErrorFallback,
})

function RootErrorFallback({ error, reset }: ErrorComponentProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-lg rounded-md border border-destructive/40 bg-destructive/5 p-6">
        <h1 className="text-lg font-semibold text-destructive">Aplikacija je naišla na grešku</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Osvežite stranicu ili se prijavite ponovo. Ako se greška ponavlja,
          obratite se podršci.
        </p>
        {import.meta.env.DEV && (
          <pre className="mt-3 max-h-48 overflow-auto rounded bg-background p-2 text-xs text-muted-foreground">
            {error.message}
          </pre>
        )}
        <button
          type="button"
          className="mt-4 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          onClick={reset}
        >
          Pokušaj ponovo
        </button>
      </div>
    </div>
  )
}

function RootLayout() {
  const ready = useBootstrapAuth()
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Učitavanje…
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <Outlet />
      <ToastProvider />
    </div>
  )
}
