import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { login } from '@/lib/api/auth'
import { apiError } from '@/lib/api/error'
import { useAuthStore } from '@/lib/auth/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorBanner } from '@/components/ui/error'
import { ThemeToggle } from '@/components/shell/theme-toggle'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

const schema = z.object({
  email: z.string().email('Unesite ispravan email'),
  password: z.string().min(1, 'Lozinka je obavezna'),
})

type Values = z.infer<typeof schema>

function LoginPage() {
  const navigate = useNavigate()
  const setLogin = useAuthStore((s) => s.setLogin)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const r = await login(values)
      setLogin({
        accessToken: r.accessToken,
        userId: r.userId,
        userKind: r.userKind,
        permissions: r.permissions,
        firstName: r.firstName,
        lastName: r.lastName,
      })
      navigate({ to: '/' })
    } catch (err) {
      form.setError('root', { message: apiError(err, 'Greška pri prijavi') })
    }
  })

  const rootError = form.formState.errors.root?.message

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_60%),radial-gradient(ellipse_at_bottom,hsl(var(--primary)/0.10),transparent_55%)]"
      />
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid size-12 place-items-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground shadow-elevated">
            B3
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Banka 3</h1>
            <p className="text-sm text-muted-foreground">
              Dobrodošli nazad. Prijavite se da nastavite.
            </p>
          </div>
        </div>
        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle>Prijava</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              {rootError && <ErrorBanner>{rootError}</ErrorBanner>}
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
                {form.formState.errors.email && (
                  <p className="mt-1.5 text-xs text-danger">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="password">Lozinka</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...form.register('password')}
                />
                {form.formState.errors.password && (
                  <p className="mt-1.5 text-xs text-danger">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Prijavljivanje…' : 'Prijavi se'}
              </Button>
              <div className="text-center text-sm">
                <Link
                  to="/password-reset"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Zaboravljena lozinka?
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
