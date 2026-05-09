import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { requestPasswordReset } from '@/lib/api/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorBanner } from '@/components/ui/error'

export const Route = createFileRoute('/password-reset/')({
  component: ResetRequestPage,
})

const schema = z.object({
  email: z.string().email('Unesite ispravan email'),
})

type Values = z.infer<typeof schema>

function ResetRequestPage() {
  const [sent, setSent] = useState(false)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  const onSubmit = form.handleSubmit(async ({ email }) => {
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch {
      // Backend silently succeeds for unknown emails (anti-enum); only
      // network errors land here.
      form.setError('root', { message: 'Slanje nije uspelo. Pokušajte ponovo.' })
    }
  })

  const rootError = form.formState.errors.root?.message

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset lozinke</CardTitle>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-3 text-sm">
              <p className="text-green-700">
                Ako adresa postoji u sistemu, link za reset lozinke je upravo poslat. Link važi 15 minuta.
              </p>
              <Link to="/login" className="text-blue-600 hover:underline">
                Nazad na prijavu
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              {rootError && <ErrorBanner>{rootError}</ErrorBanner>}
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...form.register('email')} />
                {form.formState.errors.email && (
                  <p className="mt-1 text-xs text-red-600">{form.formState.errors.email.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Slanje…' : 'Pošalji link'}
              </Button>
              <div className="text-center text-sm">
                <Link to="/login" className="text-blue-600 hover:underline">
                  Nazad na prijavu
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
