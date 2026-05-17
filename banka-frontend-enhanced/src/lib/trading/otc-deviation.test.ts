import { describe, expect, it } from 'vitest'
import { deviationLevel } from './otc-deviation'

describe('deviationLevel', () => {
  it('returns null when reference is missing or zero', () => {
    expect(deviationLevel('100', undefined)).toBeNull()
    expect(deviationLevel('100', 0)).toBeNull()
    expect(deviationLevel(undefined, '100')).toBeNull()
  })

  it('returns green for offers within ±5% of reference', () => {
    expect(deviationLevel('100', '100')).toBe('green')
    expect(deviationLevel('105', '100')).toBe('green')
    expect(deviationLevel('95', '100')).toBe('green')
  })

  it('returns yellow for offers between 5% and 20% deviation', () => {
    expect(deviationLevel('106', '100')).toBe('yellow')
    expect(deviationLevel('120', '100')).toBe('yellow')
    expect(deviationLevel('80', '100')).toBe('yellow')
  })

  it('returns red for offers more than 20% off', () => {
    expect(deviationLevel('121', '100')).toBe('red')
    expect(deviationLevel('50', '100')).toBe('red')
    expect(deviationLevel('200', '100')).toBe('red')
  })

  it('accepts numeric inputs', () => {
    expect(deviationLevel(110, 100)).toBe('yellow')
  })
})
