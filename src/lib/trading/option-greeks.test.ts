import { describe, expect, it } from 'vitest'
import { blackScholesTheta, daysUntil } from './option-greeks'

describe('blackScholesTheta', () => {
  it('returns negative per-day theta for an at-the-money call', () => {
    const t = blackScholesTheta({
      underlying: 100,
      strike: 100,
      daysToExpiry: 30,
      iv: 0.25,
      riskFreeRate: 0.04,
      optionType: 'call',
    })
    expect(t).not.toBeNull()
    // Both calls and puts decay (negative theta). ATM 30d 25% vol
    // sits in the ~-0.05 .. -0.07 per-day range with r=4%.
    expect(t!).toBeLessThan(0)
    expect(t!).toBeGreaterThan(-0.1)
  })

  it('returns negative per-day theta for an at-the-money put', () => {
    const t = blackScholesTheta({
      underlying: 100,
      strike: 100,
      daysToExpiry: 30,
      iv: 0.25,
      optionType: 'put',
    })
    expect(t).not.toBeNull()
    expect(t!).toBeLessThan(0)
  })

  it('returns null for invalid inputs', () => {
    expect(
      blackScholesTheta({ underlying: 0, strike: 100, daysToExpiry: 30, iv: 0.2, optionType: 'call' }),
    ).toBeNull()
    expect(
      blackScholesTheta({ underlying: 100, strike: 100, daysToExpiry: 0, iv: 0.2, optionType: 'call' }),
    ).toBeNull()
    expect(
      blackScholesTheta({ underlying: 100, strike: 100, daysToExpiry: 30, iv: 0, optionType: 'call' }),
    ).toBeNull()
  })

  it('decay is faster as expiry approaches (|theta| grows)', () => {
    const farTheta = blackScholesTheta({
      underlying: 100, strike: 100, daysToExpiry: 90, iv: 0.25, optionType: 'call',
    })!
    const nearTheta = blackScholesTheta({
      underlying: 100, strike: 100, daysToExpiry: 7, iv: 0.25, optionType: 'call',
    })!
    expect(Math.abs(nearTheta)).toBeGreaterThan(Math.abs(farTheta))
  })
})

describe('daysUntil', () => {
  it('returns 0 for missing or unparseable input', () => {
    expect(daysUntil(undefined)).toBe(0)
    expect(daysUntil('')).toBe(0)
    expect(daysUntil('not-a-date')).toBe(0)
  })

  it('returns 0 for past timestamps (no negative days)', () => {
    const past = new Date(Date.now() - 86_400_000 * 5).toISOString()
    expect(daysUntil(past)).toBe(0)
  })

  it('returns roughly N for a future timestamp', () => {
    const future = new Date(Date.now() + 86_400_000 * 14).toISOString()
    const d = daysUntil(future)
    expect(d).toBeGreaterThan(13.9)
    expect(d).toBeLessThan(14.1)
  })
})
