import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorBanner } from '@/components/ui/error'
import {
  getVerificationStatus,
  requestVerification,
  type VerificationKind,
  type VerificationProof,
} from '@/lib/api/verification'

// VerificationDialog drives the 6-digit verification step (5-minute
// TTL, 3-attempt budget, enforced server-side). The code is the user's
// mobile app (the second factor), so the web app never displays it.
// Two paths reach a confirmed action:
//   - quick-approve: the user taps „Odobri“ in the mobile app; the
//     status poll sees `approved` and the dialog auto-proceeds id-only.
//   - typed code: the user reads the code off their phone (the mobile
//     app's Verifikacija screen) and types it into the input here.
// `delivery: 'email'` (card issuance) keeps the inbox messaging.
//
// Caller usage: gate the actual mutation behind onConfirm so the
// proof arrives only after the user approves on the phone or types the
// matching code. If the downstream mutation rejects with a 401 (wrong /
// expired / mismatch), the dialog stays open with the backend's Serbian
// message and the user can retry or request a fresh code.
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
  // Guards a single auto-submit once the phone approves (todoSpec S12) —
  // the status poll keeps firing, so without this the gated mutation
  // would be dispatched repeatedly.
  const autoProceededRef = useRef(false)

  const issue = useQuery({
    queryKey: ['verification', kind, open],
    queryFn: () => requestVerification(kind),
    enabled: open,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })

  const verificationId = issue.data?.verificationId

  // Reset local UI state every time the dialog re-opens or a new code
  // is issued. Otherwise stale typed digits / errors leak between
  // sequential confirmations.
  useEffect(() => {
    if (open) {
      setTyped('')
      setSubmitError(null)
      autoProceededRef.current = false
    }
  }, [open, verificationId])

  useEffect(() => {
    if (open && issue.data) inputRef.current?.focus()
  }, [open, issue.data])

  const submit = useMutation({
    // code === '' is the quick-approve path (todoSpec S12): the user
    // tapped "Odobri" on the phone, so we proceed id-only (no 6-digit
    // code). Otherwise the user typed the code and we send it.
    mutationFn: async (code: string) => {
      if (!verificationId) throw new Error('verification not issued')
      if (code !== '' && code.length !== 6) throw new Error('Unesite šestocifreni kod.')
      await onConfirm({ id: verificationId, code })
    },
    onError: (err) => {
      const msg = extractMsg(err) ?? 'Greška prilikom potvrde.'
      setSubmitError(msg)
      setTyped('')
      inputRef.current?.focus()
    },
  })

  // Poll the verification status while the dialog is open and a code has
  // been issued, so the dialog can auto-proceed once the client approves
  // on the mobile app (todoSpec S12). Stops once a terminal status is
  // seen or the confirm mutation is in flight.
  const status = useQuery({
    queryKey: ['verification-status', verificationId],
    queryFn: () => getVerificationStatus(verificationId as string),
    enabled: open && !!verificationId && !submit.isPending,
    refetchInterval: (q) =>
      q.state.data && q.state.data.status !== 'pending' ? false : 2000,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })

  // Auto-proceed when the phone approves. Fire once; the guard ref keeps
  // the still-polling query from re-dispatching the gated mutation.
  useEffect(() => {
    if (!open) return
    if (status.data?.status === 'approved' && !autoProceededRef.current && !submit.isPending) {
      autoProceededRef.current = true
      submit.mutate('')
    }
  }, [open, status.data?.status, submit])

  const waitingApproval = status.data?.status === 'pending'
  const expired = status.data?.status === 'expired'

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
            onClick={() => submit.mutate(typed)}
            disabled={!issue.data || typed.length !== 6 || submit.isPending}
          >
            {submit.isPending ? 'Potvrđivanje…' : 'Potvrdi'}
          </Button>
        </>
      }
    >
      {description && <p className="mb-3 text-sm text-foreground">{description}</p>}

      {issue.isPending && <p className="text-sm text-muted-foreground">Generisanje koda…</p>}
      {issue.isError && (
        <ErrorBanner>
          {extractMsg(issue.error) ?? 'Greška prilikom generisanja koda.'}
        </ErrorBanner>
      )}

      {issue.data && (
        <>
          {issue.data.delivery === 'email' ? (
            <div className="mb-4 rounded-md bg-primary-soft p-3 text-sm text-primary-soft-foreground">
              Verifikacioni kod je poslat na vašu email adresu. Proverite
              poštu i unesite šestocifreni kod ispod.
            </div>
          ) : issue.data.code ? (
            // A code in the response only happens under Cypress stubs;
            // the real backend never sends one (see verification.ts).
            <div className="mb-4 flex items-center gap-4">
              <FakeQR />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Kod sa mobilne aplikacije
                </p>
                <p
                  className="font-mono text-2xl font-semibold tracking-widest"
                  aria-label="verifikacioni-kod"
                >
                  {issue.data.code}
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-4 flex items-center gap-4">
              <FakeQR />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Potvrda preko mobilne aplikacije
                </p>
                <p className="text-sm text-foreground">
                  Otvorite Banka 3 aplikaciju na telefonu i dodirnite
                  „Odobri“ — ili unesite šestocifreni kod prikazan na
                  telefonu ispod.
                </p>
              </div>
            </div>
          )}

          {waitingApproval && (
            <div
              className="mb-4 rounded-md bg-primary-soft p-3 text-sm text-primary-soft-foreground"
              aria-label="ceka-odobrenje"
            >
              Čeka se odobrenje sa telefona. Otvorite mobilnu aplikaciju i
              dodirnite „Odobri“ — ili unesite šestocifreni kod ispod.
            </div>
          )}
          {expired && (
            <ErrorBanner className="mb-4">
              Zahtev za verifikaciju je istekao. Zatvorite i pokušajte ponovo.
            </ErrorBanner>
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
              if (e.key === 'Enter' && typed.length === 6 && !submit.isPending) submit.mutate(typed)
            }}
          />
          {submitError && <ErrorBanner className="mt-2">{submitError}</ErrorBanner>}
          <p className="mt-3 text-xs text-muted-foreground">
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

// FakeQR is a decorative cue that the confirmation lives on the phone.
// It's just a checkerboard SVG (no real pairing payload); the dialog
// copy tells the user what to do.
function FakeQR() {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 8 8"
      role="img"
      aria-label="QR kod"
      className="rounded border border-border"
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
