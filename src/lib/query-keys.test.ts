import { describe, expect, it } from 'vitest'
import { keys } from './query-keys'

describe('keys.order.mine', () => {
  it('serialises filter object as the third element', () => {
    expect(keys.order.mine({ status: 'pending', direction: 'DIRECTION_BUY' })).toEqual([
      'order',
      'mine',
      { status: 'pending', direction: 'DIRECTION_BUY' },
    ])
  })

  it('produces a different key when filters differ', () => {
    const a = keys.order.mine({ status: 'pending', direction: '' })
    const b = keys.order.mine({ status: 'approved', direction: '' })
    expect(a).not.toEqual(b)
  })

  it('shares an "order" prefix with detail keys for blanket invalidation', () => {
    const list = keys.order.mine({ status: '' })
    const detail = keys.order.detail('id-1')
    expect(list[0]).toBe('order')
    expect(detail[0]).toBe('order')
  })
})
