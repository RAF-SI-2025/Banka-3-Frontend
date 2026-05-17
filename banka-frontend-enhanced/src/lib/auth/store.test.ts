import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from './store'

function reset() {
  useAuthStore.getState().clear()
}

function makeToken(perms: string[]): string {
  const b64 = (s: string) =>
    btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${b64('{"alg":"HS256"}')}.${b64(JSON.stringify({ perms }))}.sig`
}

describe('useAuthStore', () => {
  beforeEach(reset)

  it('starts empty', () => {
    const s = useAuthStore.getState()
    expect(s.accessToken).toBeNull()
    expect(s.userId).toBeNull()
    expect(s.userKind).toBeNull()
    expect(s.permissions).toEqual([])
  })

  it('setLogin populates identity + token + permissions', () => {
    useAuthStore.getState().setLogin({
      accessToken: 't1',
      userId: 'u-1',
      userKind: 'employee',
      permissions: ['admin'],
    })
    const s = useAuthStore.getState()
    expect(s.accessToken).toBe('t1')
    expect(s.userId).toBe('u-1')
    expect(s.userKind).toBe('employee')
    expect(s.permissions).toEqual(['admin'])
  })

  it('setAccessToken updates token and refreshes permissions from JWT', () => {
    useAuthStore.getState().setLogin({
      accessToken: 'old',
      userId: 'u-1',
      userKind: 'employee',
      permissions: ['admin'],
    })
    const newTok = makeToken(['employee.read'])
    useAuthStore.getState().setAccessToken(newTok)
    const s = useAuthStore.getState()
    expect(s.accessToken).toBe(newTok)
    expect(s.permissions).toEqual(['employee.read'])
    // Identity untouched on a refresh.
    expect(s.userId).toBe('u-1')
  })

  it('setAccessToken keeps existing permissions when JWT has none', () => {
    useAuthStore.getState().setLogin({
      accessToken: 'old',
      userId: 'u-1',
      userKind: 'employee',
      permissions: ['admin'],
    })
    // Token without a perms claim — store should keep what it had.
    const noPerms = `${btoa('{}').replace(/=+$/, '')}.${btoa('{"sub":"u-1"}').replace(/=+$/, '')}.sig`
    useAuthStore.getState().setAccessToken(noPerms)
    expect(useAuthStore.getState().permissions).toEqual(['admin'])
  })

  it('clear wipes everything', () => {
    useAuthStore.getState().setLogin({
      accessToken: 't',
      userId: 'u',
      userKind: 'client',
      permissions: ['client.read'],
    })
    useAuthStore.getState().clear()
    const s = useAuthStore.getState()
    expect(s.accessToken).toBeNull()
    expect(s.userId).toBeNull()
    expect(s.userKind).toBeNull()
    expect(s.permissions).toEqual([])
  })

  it('has() returns true for held permission, true for admin wildcard, false otherwise', () => {
    const { setLogin, has } = useAuthStore.getState()

    setLogin({ accessToken: 't', userId: 'u', userKind: 'employee', permissions: ['employee.read'] })
    expect(useAuthStore.getState().has('employee.read')).toBe(true)
    expect(useAuthStore.getState().has('employee.write')).toBe(false)

    useAuthStore.getState().setLogin({
      accessToken: 't',
      userId: 'u',
      userKind: 'employee',
      permissions: ['admin'],
    })
    expect(useAuthStore.getState().has('employee.write')).toBe(true)

    void has // touch the captured reference so eslint stays happy
  })
})
