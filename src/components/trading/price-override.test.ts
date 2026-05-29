import { describe, expect, it } from 'vitest'
import { priceOverrideSchema } from './price-override-schema'

describe('priceOverrideSchema', () => {
  it('accepts integer + decimal values', () => {
    expect(priceOverrideSchema.safeParse({ price: '180', ask: '180.10', bid: '179.90' }).success).toBe(true)
  })

  it('rejects empty fields', () => {
    expect(priceOverrideSchema.safeParse({ price: '', ask: '', bid: '' }).success).toBe(false)
  })

  it('rejects letters', () => {
    expect(priceOverrideSchema.safeParse({ price: '1a0', ask: '180', bid: '180' }).success).toBe(false)
  })

  it('rejects negatives', () => {
    expect(priceOverrideSchema.safeParse({ price: '-1', ask: '180', bid: '180' }).success).toBe(false)
  })

  it('rejects trailing decimal point', () => {
    expect(priceOverrideSchema.safeParse({ price: '180.', ask: '180', bid: '180' }).success).toBe(false)
  })
})
