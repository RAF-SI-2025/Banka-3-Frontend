import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { confirmPasswordReset } from '@/lib/api/auth'
import { apiError } from '@/lib/api/error'
import { passwordSchema } from '@/lib/auth/password'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorBanner } from '@/components/ui/error'

interface Search {
  token?: string
}

export const Route = createFileRoute('/password-reset/confirm')({
  validateSearch: (search: Record<string, unknown>): Search => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  component: ResetConfirmPage,
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

function ResetConfirmPage() {
  const navigate = useNavigate()
  const { token } = Route.useSearch()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  })

  const onSubmit = form.handleSubmit(async ({ password }) => {
    if (!token) {
      form.setError('root', { message: 'Nedostaje token za reset' })
      return
    }
    try {
      await confirmPasswordReset(token, password)
      navigate({ to: '/login' })
    } catch (err) {
      form.setError('root', { message: apiError(err, 'Reset nije uspeo') })
    }
  })

  const rootError = form.formState.errors.root?.message

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Postavi novu lozinku</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {rootError && <ErrorBanner>{rootError}</ErrorBanner>}
            <p className="text-sm text-gray-600">
              Lozinka mora imati 8–32 znaka, ≥2 cifre, 1 veliko i 1 malo slovo.
            </p>
            <div>
              <Label htmlFor="password">Nova lozinka</Label>
              <Input id="password" type="password" {...form.register('password')} />
              {form.formState.errors.password && (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.password.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="confirm">Potvrdi lozinku</Label>
              <Input id="confirm" type="password" {...form.register('confirm')} />
              {form.formState.errors.confirm && (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.confirm.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Postavljanje…' : 'Postavi lozinku'}
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
