import { describe, it, expect } from 'vitest'
import { isSettlementPast } from './settlement'

describe('isSettlementPast', () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const pad = (value: number) => value.toString().padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  it('returns false for null / undefined / empty', () => {
    expect(isSettlementPast(null)).toBe(false)
    expect(isSettlementPast(undefined)).toBe(false)
    expect(isSettlementPast('')).toBe(false)
  })

  it('returns false for an invalid date string', () => {
    expect(isSettlementPast('not-a-date')).toBe(false)
  })

  it('returns true when the date is strictly in the past', () => {
    const past = new Date(today)
    past.setDate(today.getDate() - 1)
    expect(isSettlementPast(iso(past))).toBe(true)
    expect(isSettlementPast('2020-01-01')).toBe(true)
  })

  it('returns true when the date is today (on/before semantics matches backend)', () => {
    expect(isSettlementPast(iso(today))).toBe(true)
  })

  it('returns false when the date is in the future', () => {
    const future = new Date(today)
    future.setDate(today.getDate() + 1)
    expect(isSettlementPast(iso(future))).toBe(false)
  })
})
