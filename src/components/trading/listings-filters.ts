// Filter state for the shared trading catalog (ListingsTable). Lives
// in its own file so fast-refresh can keep its component-only rule
// happy and so vitest can import without dragging the component tree.

import type { v1SecurityType } from '@/lib/api/generated/models/v1SecurityType'

export interface CatalogFilters {
  type: v1SecurityType
  search: string
  exchangeMic: string
  minPrice: string
  maxPrice: string
  minVolume: string
  maxVolume: string
  minSettlement: string
  maxSettlement: string
  sortBy: 'price' | 'volume' | 'maintenance_margin'
  sortDesc: boolean
  page: number
  pageSize: number
}

export const DEFAULT_FILTERS: Omit<CatalogFilters, 'type'> = {
  search: '',
  exchangeMic: '',
  minPrice: '',
  maxPrice: '',
  minVolume: '',
  maxVolume: '',
  minSettlement: '',
  maxSettlement: '',
  sortBy: 'volume',
  sortDesc: true,
  page: 1,
  pageSize: 25,
}

// filtersToQuery strips empty strings and produces the args object the
// listSecurities wrapper sends as URL params.
export function filtersToQuery(f: CatalogFilters): Record<string, unknown> {
  const out: Record<string, unknown> = {
    type: f.type,
    sortBy: f.sortBy,
    sortDesc: f.sortDesc,
    page: f.page,
    pageSize: f.pageSize,
  }
  if (f.search.trim()) out.search = f.search.trim()
  if (f.exchangeMic) out.exchangeMic = f.exchangeMic
  if (f.minPrice) out.minPrice = f.minPrice
  if (f.maxPrice) out.maxPrice = f.maxPrice
  if (f.minVolume) out.minVolume = f.minVolume
  if (f.maxVolume) out.maxVolume = f.maxVolume
  if (f.minSettlement) out.minSettlement = f.minSettlement
  if (f.maxSettlement) out.maxSettlement = f.maxSettlement
  return out
}
