import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorBanner } from '@/components/ui/error'
import { requestVerification, type VerificationKind, type VerificationProof } from '@/lib/api/verification'

// VerificationDialog drives the 6-digit verification step (5-minute
// TTL, 3-attempt budget, enforced server-side). Two delivery modes:
//   - inline: backend returns the code in the issue response; we
//     render it next to the input (mobile-app placeholder).
//   - email:  backend has emailed the code; we tell the user to check
//     their inbox and only render the input.
//
// Caller usage: gate the actual mutation behind onConfirm so the
// proof arrives only after the user types the matching code. If the
// downstream mutation rejects with a 401 (wrong / expired / mismatch),
// the dialog stays open with the backend's Serbian message and the
// user can retry or request a fresh code.
export function VerificationDialog({
  open,
  kind,
  title,
  description,
  onCancel,
  onConfirm,
}: {
  open: boolean
  kind: VerificationKind
  title?: string
  description?: string
  onCancel: () => void
  onConfirm: (proof: VerificationProof) => Promise<void>
}) {
  const [typed, setTyped] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const issue = useQuery({
    queryKey: ['verification', kind, open],
    queryFn: () => requestVerification(kind),
    enabled: open,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })

  // Reset local UI state every time the dialog re-opens or a new code
  // is issued. Otherwise stale typed digits / errors leak between
  // sequential confirmations.
  useEffect(() => {
    if (open) {
      setTyped('')
      setSubmitError(null)
    }
  }, [open, issue.data?.verificationId])

  useEffect(() => {
    if (open && issue.data) inputRef.current?.focus()
  }, [open, issue.data])

  const submit = useMutation({
    mutationFn: async () => {
      if (!issue.data) throw new Error('verification not issued')
      if (typed.length !== 6) throw new Error('Unesite šestocifreni kod.')
      await onConfirm({ id: issue.data.verificationId, code: typed })
    },
    onError: (err) => {
      const msg = extractMsg(err) ?? 'Greška prilikom potvrde.'
      setSubmitError(msg)
      setTyped('')
      inputRef.current?.focus()
    },
  })

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (submit.isPending) return
        onCancel()
      }}
      title={title ?? 'Verifikacioni kod'}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={submit.isPending}>
            Otkaži
          </Button>
          <Button
            onClick={() => submit.mutate()}
            disabled={!issue.data || typed.length !== 6 || submit.isPending}
          >
            {submit.isPending ? 'Potvrđivanje…' : 'Potvrdi'}
          </Button>
        </>
      }
    >
      {description && <p className="mb-3 text-sm text-gray-700">{description}</p>}

      {issue.isPending && <p className="text-sm text-gray-500">Generisanje koda…</p>}
      {issue.isError && (
        <ErrorBanner>
          {extractMsg(issue.error) ?? 'Greška prilikom generisanja koda.'}
        </ErrorBanner>
      )}

      {issue.data && (
        <>
          {issue.data.delivery === 'email' ? (
            <div className="mb-4 rounded-md bg-blue-50 p-3 text-sm text-blue-900">
              Verifikacioni kod je poslat na vašu email adresu. Proverite
              poštu i unesite šestocifreni kod ispod.
            </div>
          ) : (
            <div className="mb-4 flex items-center gap-4">
              <FakeQR />
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Kod sa mobilne aplikacije
                </p>
                <p
                  className="font-mono text-2xl font-semibold tracking-widest"
                  aria-label="verifikacioni-kod"
                >
                  {issue.data.code}
                </p>
                <p className="text-xs text-gray-500">
                  Mobilna aplikacija stiže u celini 5; do tada kod prikazujemo ovde.
                </p>
              </div>
            </div>
          )}

          <Label htmlFor="verif-code">Unesite kod</Label>
          <Input
            id="verif-code"
            ref={inputRef}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]{6}"
            value={typed}
            onChange={(e) => {
              const next = e.target.value.replace(/\D/g, '').slice(0, 6)
              setTyped(next)
              setSubmitError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && typed.length === 6 && !submit.isPending) submit.mutate()
            }}
          />
          {submitError && <ErrorBanner className="mt-2">{submitError}</ErrorBanner>}
          <p className="mt-3 text-xs text-gray-500">
            Kod važi 5 minuta. Posle 3 pogrešna pokušaja, zatražite novi kod.
          </p>
        </>
      )}
    </Dialog>
  )
}

// extractMsg pulls a user-facing message out of axios errors (the
// gateway returns {code, message} bodies); returns null otherwise.
function extractMsg(err: unknown): string | null {
  if (err instanceof AxiosError) {
    const body = err.response?.data
    if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
      return body.message
    }
  }
  if (err instanceof Error) return err.message
  return null
}

// FakeQR is a decorative placeholder until the c5 mobile app provides
// a real QR. It's just a checkerboard SVG; the dialog tells the user
// what's going on.
function FakeQR() {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 8 8"
      role="img"
      aria-label="QR placeholder"
      className="rounded border border-gray-200"
    >
      <rect width="8" height="8" fill="#fff" />
      {Array.from({ length: 64 }).map((_, i) => {
        const x = i % 8
        const y = Math.floor(i / 8)
        // Draw a fixed stylized pattern so it looks like a QR but is
        // entirely cosmetic. Three corner finder squares + scattered.
        const finder =
          (x < 3 && y < 3 && (x === 0 || x === 2 || y === 0 || y === 2 || (x === 1 && y === 1))) ||
          (x > 4 && y < 3 && (x === 5 || x === 7 || y === 0 || y === 2 || (x === 6 && y === 1))) ||
          (x < 3 && y > 4 && (x === 0 || x === 2 || y === 5 || y === 7 || (x === 1 && y === 6)))
        const noise = ((x * 31 + y * 17) ^ (x + y * 3)) % 5 === 0
        return finder || noise ? <rect key={i} x={x} y={y} width="1" height="1" fill="#000" /> : null
      })}
    </svg>
  )
}
