import { describe, it, expect } from 'vitest'
import { filtersToQuery, type CatalogFilters } from './listings-filters'
import { v1SecurityType } from '@/lib/api/generated/models/v1SecurityType'

const base: CatalogFilters = {
  type: v1SecurityType.SECURITY_TYPE_STOCK,
  search: '',
  exchangeMic: '',
  minPrice: '',
  maxPrice: '',
  minAsk: '',
  maxAsk: '',
  minBid: '',
  maxBid: '',
  minVolume: '',
  maxVolume: '',
  minSettlement: '',
  maxSettlement: '',
  sortBy: 'volume',
  sortDesc: true,
  page: 1,
  pageSize: 25,
}

describe('filtersToQuery', () => {
  it('omits empty optional fields', () => {
    expect(filtersToQuery(base)).toEqual({
      type: v1SecurityType.SECURITY_TYPE_STOCK,
      sortBy: 'volume',
      sortDesc: true,
      page: 1,
      pageSize: 25,
    })
  })

  it('trims search and forwards exchange + ranges', () => {
    expect(
      filtersToQuery({
        ...base,
        search: '  AAPL  ',
        exchangeMic: 'XNAS',
        minPrice: '10',
        maxPrice: '500',
      }),
    ).toEqual({
      type: v1SecurityType.SECURITY_TYPE_STOCK,
      sortBy: 'volume',
      sortDesc: true,
      page: 1,
      pageSize: 25,
      search: 'AAPL',
      exchangeMic: 'XNAS',
      minPrice: '10',
      maxPrice: '500',
    })
  })

  it('forwards settlement only when set', () => {
    const out = filtersToQuery({
      ...base,
      type: v1SecurityType.SECURITY_TYPE_FUTURE,
      minSettlement: '2026-06-01',
      maxSettlement: '2026-12-31',
    })
    expect(out.minSettlement).toBe('2026-06-01')
    expect(out.maxSettlement).toBe('2026-12-31')
  })

  it('flips sort direction without dropping the field', () => {
    expect(filtersToQuery({ ...base, sortDesc: false }).sortDesc).toBe(false)
  })

  it('forwards ask/bid ranges only when set', () => {
    const out = filtersToQuery({
      ...base,
      minAsk: '10',
      maxAsk: '20',
      minBid: '8',
      maxBid: '18',
    })
    expect(out).toMatchObject({
      minAsk: '10',
      maxAsk: '20',
      minBid: '8',
      maxBid: '18',
    })
    expect(filtersToQuery(base)).not.toHaveProperty('minAsk')
    expect(filtersToQuery(base)).not.toHaveProperty('maxBid')
  })
})
