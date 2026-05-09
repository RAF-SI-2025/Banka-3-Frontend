import { describe, expect, it } from 'vitest'
import { Permissions } from '@/lib/permissions'
import { deriveActor, projectLimit } from './actor'

describe('deriveActor', () => {
  it('client trading: only canMargin requires margin perm', () => {
    const a = deriveActor([Permissions.TradingClient])
    expect(a.isClient).toBe(true)
    expect(a.isAgent).toBe(false)
    expect(a.isSupervisor).toBe(false)
    expect(a.isAdmin).toBe(false)
    expect(a.isActuary).toBe(false)
    expect(a.canMargin).toBe(false)
    expect(a.showLimitPanel).toBe(false)
    expect(a.canActOnOthers).toBe(false)
  })

  it('client with TradingMargin gets margin checkbox', () => {
    const a = deriveActor([Permissions.TradingClient, Permissions.TradingMargin])
    expect(a.canMargin).toBe(true)
    expect(a.showLimitPanel).toBe(false)
  })

  it('agent shows limit panel + can margin', () => {
    const a = deriveActor([Permissions.Actuary, Permissions.ActuaryAgent, Permissions.TradingMargin])
    expect(a.isAgent).toBe(true)
    expect(a.isActuary).toBe(true)
    expect(a.isSupervisor).toBe(false)
    expect(a.showLimitPanel).toBe(true)
    expect(a.canMargin).toBe(true)
    expect(a.canActOnOthers).toBe(false)
  })

  it('supervisor: no limit panel, can act on others', () => {
    const a = deriveActor([Permissions.Actuary, Permissions.ActuarySupervisor, Permissions.TradingMargin])
    expect(a.isSupervisor).toBe(true)
    expect(a.showLimitPanel).toBe(false)
    expect(a.canActOnOthers).toBe(true)
  })

  it('admin: never sees the limit panel even if agent perm tagged', () => {
    const a = deriveActor([Permissions.Admin, Permissions.ActuaryAgent])
    expect(a.isAdmin).toBe(true)
    expect(a.showLimitPanel).toBe(false)
    expect(a.canActOnOthers).toBe(true)
    // Admin gets every gate by virtue of has().
    expect(a.canMargin).toBe(true)
  })

  it('basic employee (no trading perm) has nothing enabled', () => {
    const a = deriveActor([Permissions.EmployeeRead])
    expect(a.canMargin).toBe(false)
    expect(a.showLimitPanel).toBe(false)
    expect(a.canActOnOthers).toBe(false)
  })
})

describe('projectLimit', () => {
  const base = { dailyLimit: 1_000_000, usedLimit: 200_000, needApproval: false }

  it('returns approval=false when projected stays under cap', () => {
    const p = projectLimit({ ...base, approxCcy: 100, rsdPerCcy: 100 }) // 10k RSD
    expect(p.rsdEquivalent).toBe(10_000)
    expect(p.projectedUsed).toBe(210_000)
    expect(p.willExceed).toBe(false)
    expect(p.willNeedApproval).toBe(false)
  })

  it('flags approval when projected crosses the daily cap', () => {
    const p = projectLimit({ ...base, approxCcy: 10_000, rsdPerCcy: 100 }) // 1m RSD on top of 200k
    expect(p.willExceed).toBe(true)
    expect(p.willNeedApproval).toBe(true)
  })

  it('flags approval when needApproval is set even under cap', () => {
    const p = projectLimit({ ...base, needApproval: true, approxCcy: 1, rsdPerCcy: 100 })
    expect(p.willExceed).toBe(false)
    expect(p.willNeedApproval).toBe(true)
  })

  it('skips projection when no rate is known', () => {
    const p = projectLimit({ ...base, approxCcy: 100, rsdPerCcy: null })
    expect(p.rsdEquivalent).toBeNull()
    expect(p.projectedUsed).toBe(200_000)
    expect(p.willExceed).toBe(false)
  })

  it('treats dailyLimit=0 as no cap', () => {
    const p = projectLimit({ dailyLimit: 0, usedLimit: 0, needApproval: false, approxCcy: 1_000_000, rsdPerCcy: 100 })
    expect(p.willExceed).toBe(false)
    expect(p.willNeedApproval).toBe(false)
  })
})
