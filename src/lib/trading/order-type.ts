// Spec p.53: order type is *derived* from whether the user supplies a
// limit and/or stop price. Never expose a separate "type" picker — the
// spec literally says it's derived.

import { v1OrderType } from '@/lib/api/generated/models/v1OrderType'

export function deriveOrderType(limit?: string, stop?: string): v1OrderType {
  const hasLimit = Boolean(limit && limit.trim() !== '')
  const hasStop = Boolean(stop && stop.trim() !== '')
  if (hasLimit && hasStop) return v1OrderType.ORDER_TYPE_STOP_LIMIT
  if (hasLimit) return v1OrderType.ORDER_TYPE_LIMIT
  if (hasStop) return v1OrderType.ORDER_TYPE_STOP
  return v1OrderType.ORDER_TYPE_MARKET
}
