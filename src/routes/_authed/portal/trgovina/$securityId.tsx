import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ListingDetail } from '@/components/trading/ListingDetail'
import { v1Direction } from '@/lib/api/generated/models/v1Direction'

// Search params power the portal portfolio Prodaj deep-link
// (`HoldingsSection` row → `?direction=sell&qty=N`). Mirror the
// banking variant.
const searchSchema = z.object({
  direction: z.enum(['buy', 'sell']).optional(),
  qty: z.coerce.number().int().positive().optional(),
})

export const Route = createFileRoute('/_authed/portal/trgovina/$securityId')({
  validateSearch: (s) => searchSchema.parse(s),
  component: PortalListingDetail,
})

function PortalListingDetail() {
  // The param carries a *security* id (the catalog row builds it from
  // `sec.id`); ListingDetail's prop is named `listingId` for legacy
  // reasons but `getSecurity` accepts both.
  const { securityId } = Route.useParams()
  const search = Route.useSearch()
  const initialDirection =
    search.direction === 'sell' ? v1Direction.DIRECTION_SELL
    : search.direction === 'buy' ? v1Direction.DIRECTION_BUY
    : undefined
  return (
    <ListingDetail
      listingId={securityId}
      basePath="/portal/trgovina"
      initialDirection={initialDirection}
      initialQuantity={search.qty}
    />
  )
}
