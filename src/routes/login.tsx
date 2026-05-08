import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { AxiosError } from 'axios'
import { login } from '@/lib/api/auth'
import { useAuthStore } from '@/lib/auth/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorBanner } from '@/components/ui/error'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const setLogin = useAuthStore((s) => s.setLogin)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const r = await login({ email, password })
      setLogin({
        accessToken: r.accessToken,
        userId: r.userId,
        userKind: r.userKind,
        permissions: r.permissions,
      })
      navigate({ to: '/' })
    } catch (err) {
      if (err instanceof AxiosError) {
        const msg = err.response?.data?.message ?? 'Greška pri prijavi'
        setError(typeof msg === 'string' ? msg : 'Greška pri prijavi')
      } else {
        setError('Greška pri prijavi')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Prijava</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {error && <ErrorBanner>{error}</ErrorBanner>}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="password">Lozinka</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Prijavljivanje…' : 'Prijavi se'}
            </Button>
            <div className="text-center text-sm">
              <Link to="/reset-lozinke" className="text-blue-600 hover:underline">
                Zaboravljena lozinka?
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
