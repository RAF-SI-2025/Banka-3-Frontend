import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { AxiosError } from 'axios'
import { confirmPasswordReset } from '@/lib/api/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorBanner } from '@/components/ui/error'

interface Search {
  token?: string
}

export const Route = createFileRoute('/reset-lozinke/potvrda')({
  validateSearch: (search: Record<string, unknown>): Search => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  component: ResetConfirmPage,
})

function ResetConfirmPage() {
  const navigate = useNavigate()
  const { token } = Route.useSearch()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!token) {
      setError('Nedostaje token za reset')
      return
    }
    if (password !== confirm) {
      setError('Lozinke se ne poklapaju')
      return
    }
    setSubmitting(true)
    try {
      await confirmPasswordReset(token, password)
      navigate({ to: '/login' })
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.message ?? 'Reset nije uspeo')
      } else {
        setError('Reset nije uspeo')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Postavi novu lozinku</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {error && <ErrorBanner>{error}</ErrorBanner>}
            <div>
              <Label htmlFor="password">Nova lozinka</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="confirm">Potvrdi lozinku</Label>
              <Input
                id="confirm"
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Postavljanje…' : 'Postavi lozinku'}
            </Button>
            <div className="text-center text-sm">
              <Link to="/login" className="text-blue-600 hover:underline">
                Nazad na prijavu
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
