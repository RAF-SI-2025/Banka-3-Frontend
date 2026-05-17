import { describe, expect, it } from 'vitest'
import { Permissions, has, hasAny } from './permissions'

describe('has', () => {
  it('matches when the holder has the exact permission', () => {
    expect(has([Permissions.EmployeeRead], Permissions.EmployeeRead)).toBe(true)
  })

  it('returns false when the holder lacks the permission', () => {
    expect(has([Permissions.ClientRead], Permissions.EmployeeWrite)).toBe(false)
  })

  it('treats Admin as a wildcard', () => {
    expect(has([Permissions.Admin], Permissions.EmployeeWrite)).toBe(true)
    expect(has([Permissions.Admin], Permissions.PermissionGrant)).toBe(true)
  })

  it('handles an empty holder list', () => {
    expect(has([], Permissions.EmployeeRead)).toBe(false)
  })
})

describe('hasAny', () => {
  it('returns true on any match', () => {
    expect(
      hasAny([Permissions.ClientRead], [Permissions.EmployeeWrite, Permissions.ClientRead]),
    ).toBe(true)
  })

  it('returns false when nothing matches', () => {
    expect(
      hasAny([Permissions.ClientRead], [Permissions.EmployeeWrite, Permissions.PermissionGrant]),
    ).toBe(false)
  })

  it('still treats Admin as wildcard', () => {
    expect(hasAny([Permissions.Admin], [Permissions.EmployeeWrite])).toBe(true)
  })

  it('returns false for an empty target list', () => {
    expect(hasAny([Permissions.Admin], [])).toBe(false)
  })
})
