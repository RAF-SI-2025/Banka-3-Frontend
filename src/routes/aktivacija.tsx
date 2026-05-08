import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { AxiosError } from 'axios'
import { activateAccount } from '@/lib/api/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorBanner } from '@/components/ui/error'

interface Search {
  token?: string
}

export const Route = createFileRoute('/aktivacija')({
  validateSearch: (search: Record<string, unknown>): Search => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  component: ActivatePage,
})

function ActivatePage() {
  const navigate = useNavigate()
  const { token } = Route.useSearch()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!token) {
      setError('Nedostaje aktivacioni token')
      return
    }
    if (password !== confirm) {
      setError('Lozinke se ne poklapaju')
      return
    }
    setSubmitting(true)
    try {
      await activateAccount(token, password)
      setDone(true)
      setTimeout(() => navigate({ to: '/login' }), 2000)
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.message ?? 'Aktivacija nije uspela')
      } else {
        setError('Aktivacija nije uspela')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Aktivacija naloga</CardTitle>
        </CardHeader>
        <CardContent>
          {done ? (
            <p className="text-green-700">
              Nalog je aktiviran. Preusmeravamo Vas na prijavu…
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              {error && <ErrorBanner>{error}</ErrorBanner>}
              <p className="text-sm text-gray-600">
                Postavite lozinku (8–32 znaka, ≥2 cifre, 1 veliko i 1 malo slovo).
              </p>
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
                {submitting ? 'Slanje…' : 'Aktiviraj nalog'}
              </Button>
              <div className="text-center text-sm">
                <Link to="/login" className="text-blue-600 hover:underline">
                  Idi na prijavu
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
