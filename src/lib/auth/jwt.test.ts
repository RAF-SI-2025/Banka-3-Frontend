import { describe, expect, it } from 'vitest'
import { jwtDecodePermissions } from './jwt'

// Build a minimal HS256-shaped token. The decoder doesn't verify the
// signature (the gateway has already done that), so a fake signature
// segment is fine.
function makeToken(payload: object, signature = 'sig'): string {
  const b64 = (s: string) =>
    btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64(JSON.stringify(payload))
  return `${header}.${body}.${signature}`
}

describe('jwtDecodePermissions', () => {
  it('returns the perms claim when present', () => {
    const tok = makeToken({ sub: 'u-1', kind: 'employee', perms: ['admin', 'employee.read'] })
    expect(jwtDecodePermissions(tok)).toEqual(['admin', 'employee.read'])
  })

  it('returns null when perms claim is missing', () => {
    const tok = makeToken({ sub: 'u-1', kind: 'employee' })
    expect(jwtDecodePermissions(tok)).toBeNull()
  })

  it('returns null for malformed JWTs', () => {
    expect(jwtDecodePermissions('')).toBeNull()
    expect(jwtDecodePermissions('not-a-jwt')).toBeNull()
    expect(jwtDecodePermissions('a.b.c')).toBeNull() // body isn't JSON
    expect(jwtDecodePermissions('only.two')).toBeNull() // body 'two' isn't JSON either
  })

  it('handles the URL-safe base64 alphabet (- and _)', () => {
    // Force a payload that round-trips through URL-safe base64.
    const tok = makeToken({ perms: ['perm-with-dash', 'perm_with_underscore'] })
    expect(jwtDecodePermissions(tok)).toEqual(['perm-with-dash', 'perm_with_underscore'])
  })

  it('returns null when the body is not JSON', () => {
    const b64 = btoa('not json').replace(/=+$/, '')
    const tok = `header.${b64}.sig`
    expect(jwtDecodePermissions(tok)).toBeNull()
  })
})
