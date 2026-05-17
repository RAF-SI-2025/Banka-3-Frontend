// Pure helpers driving the OrderForm + supervisor view branches off
// the JWT permission set. Kept separate from the React component so
// the four-actor matrix (client / agent / supervisor / admin) is unit
// testable without rendering anything.

import { Permissions, has } from '@/lib/permissions'

export interface OrderActor {
  // True if the current principal is admin (admin gets bank-wide view
  // + cancel-any + approve/decline regardless of actuary role).
  isAdmin: boolean
  // True if the principal carries the agent perm and is *not* an
  // admin or supervisor masquerading. Drives the limit panel.
  isAgent: boolean
  // True if the principal carries the supervisor perm.
  isSupervisor: boolean
  // True if the principal trades on behalf of the bank (zeros FX
  // commission server-side; FE only uses it for help-copy branching).
  isActuary: boolean
  // True if the principal can flip the margin checkbox.
  canMargin: boolean
  // True if the principal is a client trading from /banking.
  isClient: boolean
  // True if the principal sees the limit-utilization panel — agents
  // only, never admins or supervisors.
  showLimitPanel: boolean
  // True if the principal can act on other users' orders
  // (approve/decline/cancel-any).
  canActOnOthers: boolean
}

export function deriveActor(perms: string[]): OrderActor {
  const isAdmin = perms.includes(Permissions.Admin)
  const isAgent = perms.includes(Permissions.ActuaryAgent)
  const isSupervisor = perms.includes(Permissions.ActuarySupervisor)
  const isActuary = perms.includes(Permissions.Actuary)
  const isClient = perms.includes(Permissions.TradingClient)
  return {
    isAdmin,
    isAgent,
    isSupervisor,
    isActuary,
    isClient,
    canMargin: has(perms, Permissions.TradingMargin),
    showLimitPanel: isAgent && !isSupervisor && !isAdmin,
    canActOnOthers: isAdmin || isSupervisor,
  }
}

export interface LimitProjection {
  // Current usedLimit (RSD).
  used: number
  // Daily limit (RSD); 0 means unlimited / not applicable.
  daily: number
  // Listing-currency approximate value of the order being placed.
  approxCcy: number | null
  // RSD-equivalent of the order (no commission per spec p.38).
  rsdEquivalent: number | null
  // used + rsdEquivalent.
  projectedUsed: number
  // True if projectedUsed > daily and a daily cap is set.
  willExceed: boolean
  // True if backend will pin status=pending: needApproval flag, OR
  // projection exceeds daily cap.
  willNeedApproval: boolean
}

export function projectLimit({
  dailyLimit,
  usedLimit,
  needApproval,
  approxCcy,
  rsdPerCcy,
}: {
  dailyLimit: number
  usedLimit: number
  needApproval: boolean
  approxCcy: number | null
  rsdPerCcy: number | null
}): LimitProjection {
  const rsdEquivalent =
    rsdPerCcy !== null && approxCcy !== null && approxCcy >= 0
      ? rsdPerCcy * approxCcy
      : null
  const projectedUsed = rsdEquivalent !== null ? usedLimit + rsdEquivalent : usedLimit
  const willExceed = dailyLimit > 0 && rsdEquivalent !== null && projectedUsed > dailyLimit
  return {
    used: usedLimit,
    daily: dailyLimit,
    approxCcy,
    rsdEquivalent,
    projectedUsed,
    willExceed,
    willNeedApproval: needApproval || willExceed,
  }
}
