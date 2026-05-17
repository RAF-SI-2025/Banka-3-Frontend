// Spec p.57 column "agent" needs the trader's display name, but
// Order rows only carry userId + userKind. Same `useQueries` shape
// as useSecurityTickers — we batch-fetch employees + clients for
// the displayed rows, dedupe by id, and key off the existing
// `keys.employee.detail(id)` / `keys.client.detail(id)` cache so
// any detail-page hit elsewhere already populates them.
//
// Disabled by default; callers pass `enabled` (typically the
// supervisor/admin canSeeAll flag) since lookup endpoints require
// employee.read / client.read.

import { useQueries } from '@tanstack/react-query'
import { getEmployee } from '@/lib/api/employees'
import { getClient } from '@/lib/api/clients'
import { keys } from '@/lib/query-keys'
import { bankaTradingV1UserKind } from '@/lib/api/generated/models/bankaTradingV1UserKind'

export interface UserDisplayLookup {
  /** "First Last" for a given userId, or null while loading / on error. */
  get: (userId: string | undefined) => string | null
  isFetching: boolean
}

interface Pair {
  userId: string
  kind: bankaTradingV1UserKind
}

export function useUserDisplayNames(
  pairs: ReadonlyArray<Pair>,
  enabled = true,
): UserDisplayLookup {
  // Dedupe by id; if two rows disagree on kind for the same id,
  // take whichever lands first (shouldn't happen — userKind is a
  // function of the user row).
  const seen = new Map<string, bankaTradingV1UserKind>()
  for (const p of pairs) {
    if (!p.userId) continue
    if (!seen.has(p.userId)) seen.set(p.userId, p.kind)
  }
  const unique = Array.from(seen.entries())

  const results = useQueries({
    queries: unique.map(([id, kind]) => {
      const isEmployee = kind === bankaTradingV1UserKind.USER_KIND_EMPLOYEE
      return {
        queryKey: isEmployee ? keys.employee.detail(id) : keys.client.detail(id),
        queryFn: () => (isEmployee ? getEmployee(id) : getClient(id)),
        enabled,
        staleTime: 5 * 60_000,
        retry: false,
      }
    }),
  })

  const map = new Map<string, string>()
  results.forEach((r, i) => {
    const data = r.data as { firstName?: string; lastName?: string } | undefined
    if (!data) return
    const name = [data.firstName, data.lastName].filter(Boolean).join(' ').trim()
    if (name) map.set(unique[i][0], name)
  })

  return {
    get: (id) => (id ? (map.get(id) ?? null) : null),
    isFetching: results.some((r) => r.isFetching),
  }
}
