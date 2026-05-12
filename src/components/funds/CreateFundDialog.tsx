import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorBanner } from '@/components/ui/error'
import { createFund } from '@/lib/api/funds'
import { keys } from '@/lib/query-keys'
import { apiError } from '@/lib/api/error'

const schema = z.object({
  name: z.string().trim().min(1, 'Naziv je obavezan.').max(120, 'Naziv predug.'),
  description: z.string().trim().max(500, 'Opis predug.').optional().or(z.literal('')),
  minimumContribution: z
    .string()
    .trim()
    .min(1, 'Minimalna uplata je obavezna.')
    .refine((v) => Number(v) > 0, 'Minimalna uplata mora biti veća od 0.'),
})

type Form = z.infer<typeof schema>

// Supervisor-only fund creation. Manager defaults to the caller
// server-side; we never send `managerUserId`.
export function CreateFundDialog({
  open,
  onClose,
  basePath,
}: {
  open: boolean
  onClose: () => void
  basePath: '/portal/fondovi' | '/banking/fondovi'
}) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', minimumContribution: '' },
  })

  useEffect(() => {
    if (open) form.reset({ name: '', description: '', minimumContribution: '' })
  }, [open, form])

  const submit = useMutation({
    mutationFn: (v: Form) =>
      createFund({
        name: v.name,
        description: v.description?.trim() ? v.description : undefined,
        minimumContribution: v.minimumContribution,
      }),
    onSuccess: (fund) => {
      qc.invalidateQueries({ queryKey: keys.funds.all })
      onClose()
      if (fund.id) {
        if (basePath === '/portal/fondovi') {
          navigate({ to: '/portal/fondovi/$fundId', params: { fundId: fund.id } })
        } else {
          navigate({ to: '/banking/fondovi/$fundId', params: { fundId: fund.id } })
        }
      }
    },
  })

  const errMsg = submit.error ? apiError(submit.error, 'Greška prilikom kreiranja fonda.') : null

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (submit.isPending) return
        onClose()
      }}
      title="Kreiraj fond"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submit.isPending}>
            Otkaži
          </Button>
          <Button
            type="submit"
            form="create-fund-form"
            variant="primary"
            disabled={submit.isPending}
            data-cy="fund-create-submit"
          >
            {submit.isPending ? 'Kreiranje…' : 'Kreiraj'}
          </Button>
        </>
      }
    >
      <form
        id="create-fund-form"
        className="space-y-3"
        onSubmit={form.handleSubmit((v) => submit.mutate(v))}
      >
        <div>
          <Label htmlFor="fund-name">Naziv</Label>
          <Input id="fund-name" data-cy="fund-name" {...form.register('name')} />
          {form.formState.errors.name && (
            <p className="mt-1 text-xs text-danger">{form.formState.errors.name.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="fund-description">Opis</Label>
          <Input id="fund-description" data-cy="fund-description" {...form.register('description')} />
          {form.formState.errors.description && (
            <p className="mt-1 text-xs text-danger">{form.formState.errors.description.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="fund-min">Minimalna uplata (RSD)</Label>
          <Input
            id="fund-min"
            inputMode="decimal"
            data-cy="fund-min"
            {...form.register('minimumContribution')}
          />
          {form.formState.errors.minimumContribution && (
            <p className="mt-1 text-xs text-danger">{form.formState.errors.minimumContribution.message}</p>
          )}
        </div>
        {errMsg && <ErrorBanner>{errMsg}</ErrorBanner>}
      </form>
    </Dialog>
  )
}
