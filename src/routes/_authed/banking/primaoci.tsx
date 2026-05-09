import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { listRecipients, createRecipient, deleteRecipient, updateRecipient } from '@/lib/api/recipients'
import { keys } from '@/lib/query-keys'
import { formatAccountNumber } from '@/lib/format'
import { validateAccountNumber } from '@/lib/account-number'
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog } from '@/components/ui/dialog'

export const Route = createFileRoute('/_authed/banking/primaoci')({
  component: Recipients,
})

const accountNumberMessage = {
  'wrong-length': 'Račun mora imati 18 cifara',
  'non-digit': 'Račun sme da sadrži samo cifre',
  'checksum-mismatch': 'Neispravan kontrolni broj računa',
} as const

const schema = z.object({
  name: z.string().min(1, 'Ime je obavezno'),
  accountNumber: z.string().superRefine((val, ctx) => {
    const err = validateAccountNumber(val)
    if (err) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: accountNumberMessage[err] })
    }
  }),
})
type FormValues = z.infer<typeof schema>

function Recipients() {
  const qc = useQueryClient()
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const recipients = useQuery({
    queryKey: keys.recipient.list(),
    queryFn: () => listRecipients(),
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', accountNumber: '' },
  })

  const create = useMutation({
    mutationFn: createRecipient,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.recipient.all })
      close()
    },
  })
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: FormValues }) => updateRecipient(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.recipient.all })
      close()
    },
  })
  const remove = useMutation({
    mutationFn: deleteRecipient,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.recipient.all }),
  })

  function close() {
    setOpen(false)
    setEditId(null)
    form.reset({ name: '', accountNumber: '' })
  }

  function startEdit(id: string) {
    const r = recipients.data?.recipients?.find((x) => x.id === id)
    if (!r) return
    setEditId(id)
    form.reset({ name: r.name ?? '', accountNumber: r.accountNumber ?? '' })
    setOpen(true)
  }

  function startCreate() {
    setEditId(null)
    form.reset({ name: '', accountNumber: '' })
    setOpen(true)
  }

  function onSubmit(v: FormValues) {
    if (editId) update.mutate({ id: editId, body: v })
    else create.mutate(v)
  }

  return (
    <main className="container space-y-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Primaoci</h1>
        <Button onClick={startCreate}>Dodaj primaoca</Button>
      </div>
      {recipients.isLoading && <p className="text-gray-500">Učitavanje…</p>}
      {recipients.data && (
        <Table>
          <THead>
            <TR>
              <TH>Ime</TH>
              <TH>Račun</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {recipients.data.recipients?.map((r) => (
              <TR key={r.id}>
                <TD>{r.name}</TD>
                <TD className="font-mono text-xs">{formatAccountNumber(r.accountNumber)}</TD>
                <TD>
                  <div className="flex gap-2">
                    <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => startEdit(r.id!)}>
                      Izmeni
                    </Button>
                    <Button
                      variant="danger"
                      className="px-2 py-1 text-xs"
                      onClick={() => remove.mutate(r.id!)}
                    >
                      Obriši
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
            {(!recipients.data.recipients || recipients.data.recipients.length === 0) && (
              <EmptyRow colSpan={3}>Nema sačuvanih primaoca.</EmptyRow>
            )}
          </TBody>
        </Table>
      )}

      <Dialog
        open={open}
        onClose={close}
        title={editId ? 'Izmena primaoca' : 'Novi primalac'}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Otkaži
            </Button>
            <Button onClick={form.handleSubmit(onSubmit)} disabled={create.isPending || update.isPending}>
              Sačuvaj
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <Label>Ime / naziv</Label>
            <Input {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div>
            <Label>Broj računa</Label>
            <Input className="font-mono" {...form.register('accountNumber')} />
            {form.formState.errors.accountNumber && (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.accountNumber.message}</p>
            )}
          </div>
        </div>
      </Dialog>
    </main>
  )
}
