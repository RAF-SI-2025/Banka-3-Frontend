import { Component, type ReactNode } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  resetKey?: unknown
}

interface State {
  error: Error | null
}

// Scoped error boundary used inside portal/banking layouts so a render
// error in a child route doesn't take down the header + sidebar. The
// shell stays visible; only <Outlet /> is replaced with a recovery card.
//
// resetKey: when this changes (e.g. the active route path), state clears
// so navigating away from the broken route gives a fresh attempt instead
// of stickying the error.
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[RouteErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <RouteErrorCard
          error={this.state.error}
          onReset={() => this.setState({ error: null })}
        />
      )
    }
    return this.props.children
  }
}

// eslint-disable-next-line react-refresh/only-export-components -- both class + fn live here on purpose; tiny module, no churn during dev
function RouteErrorCard({ error, onReset }: { error: Error; onReset: () => void }) {
  const router = useRouter()
  return (
    <div className="p-6" data-cy="route-error-fallback">
      <div className="mx-auto max-w-2xl rounded-md border border-destructive/40 bg-destructive/5 p-6">
        <h2 className="text-lg font-semibold text-destructive">Greška u prikazu</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Došlo je do neočekivane greške pri prikazu ove stranice. Možete pokušati
          ponovo ili se vratiti na početnu.
        </p>
        {import.meta.env.DEV && (
          <pre className="mt-3 max-h-48 overflow-auto rounded bg-background p-2 text-xs text-muted-foreground">
            {error.message}
          </pre>
        )}
        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onReset()
              void router.invalidate()
            }}
            data-cy="route-error-retry"
          >
            Pokušaj ponovo
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              onReset()
              void router.navigate({ to: '/' })
            }}
          >
            Početna
          </Button>
        </div>
      </div>
    </div>
  )
}
