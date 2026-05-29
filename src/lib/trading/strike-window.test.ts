import { describe, expect, it } from 'vitest'
import { applyStrikeWindow } from './strike-window'

const rows = (strikes: number[]) => strikes.map((s) => ({ strikePrice: String(s) }))

describe('applyStrikeWindow', () => {
  it('returns all rows when window is null/0/negative', () => {
    const r = rows([90, 95, 100, 105, 110])
    expect(applyStrikeWindow(r, 100, null).length).toBe(5)
    expect(applyStrikeWindow(r, 100, 0).length).toBe(5)
    expect(applyStrikeWindow(r, 100, -1).length).toBe(5)
  })

  it('returns all rows when sharedPrice is null', () => {
    const r = rows([90, 95, 100, 105, 110])
    expect(applyStrikeWindow(r, null, 1).length).toBe(5)
  })

  it('slices N above + N below + at-the-money for an exact ATM hit', () => {
    const r = rows([80, 85, 90, 95, 100, 105, 110, 115, 120])
    const sliced = applyStrikeWindow(r, 100, 2)
    expect(sliced.map((s) => s.strikePrice)).toEqual(['90', '95', '100', '105', '110'])
  })

  it('anchors on the closest strike when the shared price is between strikes', () => {
    const r = rows([90, 95, 100, 105, 110])
    // 102 is closer to 100 than to 105; anchor is the 100 row.
    const sliced = applyStrikeWindow(r, 102, 1)
    expect(sliced.map((s) => s.strikePrice)).toEqual(['95', '100', '105'])
  })

  it('clamps at the bottom of the chain', () => {
    const r = rows([90, 95, 100, 105, 110])
    const sliced = applyStrikeWindow(r, 90, 2)
    expect(sliced.map((s) => s.strikePrice)).toEqual(['90', '95', '100'])
  })

  it('clamps at the top of the chain', () => {
    const r = rows([90, 95, 100, 105, 110])
    const sliced = applyStrikeWindow(r, 110, 2)
    expect(sliced.map((s) => s.strikePrice)).toEqual(['100', '105', '110'])
  })

  it('sorts unsorted source rows ascending by strike in the output', () => {
    const r = rows([110, 90, 100, 95, 105])
    const sliced = applyStrikeWindow(r, 100, 1)
    expect(sliced.map((s) => s.strikePrice)).toEqual(['95', '100', '105'])
  })

  it('ignores rows with non-numeric strike', () => {
    const r = [{ strikePrice: '95' }, { strikePrice: 'n/a' }, { strikePrice: '100' }, { strikePrice: '105' }]
    const sliced = applyStrikeWindow(r, 100, 1)
    expect(sliced.map((s) => s.strikePrice)).toEqual(['95', '100', '105'])
  })

  it('falls back to identity when no rows carry numeric strikes', () => {
    const r = [{ strikePrice: 'a' }, { strikePrice: 'b' }]
    expect(applyStrikeWindow(r, 100, 1).length).toBe(2)
  })
})
