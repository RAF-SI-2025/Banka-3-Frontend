import { AxiosError } from 'axios'

// apiError extracts a user-facing message from a thrown error. The
// gateway shape is `{code, message}` (see services/gateway/internal/
// router/router.go); axios wraps it under `error.response.data`.
//
// Falls back to the supplied default when the response shape doesn't
// match — the only callers are mutation onError handlers, so the
// default is always a Serbian copy describing the action.
export function apiError(err: unknown, fallback = 'Došlo je do greške.'): string {
  if (err instanceof AxiosError) {
    const body = err.response?.data
    if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
      return body.message
    }
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}
