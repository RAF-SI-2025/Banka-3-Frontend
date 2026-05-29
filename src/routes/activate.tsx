import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { activateAccount } from '@/lib/api/auth'
import { apiError } from '@/lib/api/error'
import { passwordSchema } from '@/lib/auth/password'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorBanner } from '@/components/ui/error'

interface Search {
  token?: string
}

export const Route = createFileRoute('/activate')({
  validateSearch: (search: Record<string, unknown>): Search => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  component: ActivatePage,
})

const schema = z
  .object({
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ['confirm'],
    message: 'Lozinke se ne poklapaju',
  })

type Values = z.infer<typeof schema>

function ActivatePage() {
  const navigate = useNavigate()
  const { token } = Route.useSearch()
  const [done, setDone] = useState(false)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    if (!token) {
      form.setError('root', { message: 'Nedostaje aktivacioni token' })
      return
    }
    try {
      await activateAccount(token, values.password)
      setDone(true)
      setTimeout(() => navigate({ to: '/login' }), 2000)
    } catch (err) {
      form.setError('root', { message: apiError(err, 'Aktivacija nije uspela') })
    }
  })

  const rootError = form.formState.errors.root?.message

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Aktivacija naloga</CardTitle>
        </CardHeader>
        <CardContent>
          {done ? (
            <p className="text-success-soft-foreground">Nalog je aktiviran. Preusmeravamo Vas na prijavu…</p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              {rootError && <ErrorBanner>{rootError}</ErrorBanner>}
              <p className="text-sm text-muted-foreground">
                Postavite lozinku (8–32 znaka, ≥2 cifre, 1 veliko i 1 malo slovo).
              </p>
              <div>
                <Label htmlFor="password">Nova lozinka</Label>
                <PasswordInput
                  id="password"
                  autoComplete="new-password"
                  {...form.register('password')}
                />
                {form.formState.errors.password && (
                  <p className="mt-1 text-xs text-danger">{form.formState.errors.password.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="confirm">Potvrdi lozinku</Label>
                <PasswordInput
                  id="confirm"
                  autoComplete="new-password"
                  {...form.register('confirm')}
                />
                {form.formState.errors.confirm && (
                  <p className="mt-1 text-xs text-danger">{form.formState.errors.confirm.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Slanje…' : 'Aktiviraj nalog'}
              </Button>
              <div className="text-center text-sm">
                <Link to="/login" className="text-primary hover:underline">
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
