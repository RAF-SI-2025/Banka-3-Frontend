// Lightweight JWT decoder. We only read claims we trust the gateway has
// already verified — never use these for authorization decisions on
// the server side.

interface PartialClaims {
  perms?: string[]
  sub?: string
  kind?: string
}

export function jwtDecodePermissions(token: string): string[] | null {
  const claims = decode(token)
  return claims?.perms ?? null
}

function decode(token: string): PartialClaims | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(payload) as PartialClaims
  } catch {
    return null
  }
}
