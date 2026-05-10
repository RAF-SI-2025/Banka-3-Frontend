import { v1OptionType } from '@/lib/api/generated/models/v1OptionType'

// itmStatus is the spec p.61.d in-the-money check used to gate the
// "Iskoristi" action. Equality is treated as out-of-money (no edge in
// exercising a flat strike — backend rejects too).
export type ITMStatus = 'itm' | 'oom' | 'unknown'

export function itmStatus(
  optionType: v1OptionType | undefined,
  underlyingPrice: string | number | undefined,
  strikePrice: string | undefined,
): ITMStatus {
  if (!optionType || underlyingPrice === undefined || underlyingPrice === '' || !strikePrice) {
    return 'unknown'
  }
  const u = typeof underlyingPrice === 'number' ? underlyingPrice : Number(underlyingPrice)
  const s = Number(strikePrice)
  if (!Number.isFinite(u) || !Number.isFinite(s)) return 'unknown'
  switch (optionType) {
    case v1OptionType.OPTION_TYPE_CALL:
      return u > s ? 'itm' : 'oom'
    case v1OptionType.OPTION_TYPE_PUT:
      return u < s ? 'itm' : 'oom'
    default:
      return 'unknown'
  }
}
