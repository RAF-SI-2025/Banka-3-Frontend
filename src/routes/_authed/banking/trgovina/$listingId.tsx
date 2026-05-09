import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ListingDetail } from '@/components/trading/ListingDetail'
import { v1Direction } from '@/lib/api/generated/models/v1Direction'

// Search params power the portfolio sell deep-link (FE-8). Both
// optional; OrderForm consumes them as initial values.
const searchSchema = z.object({
  direction: z.enum(['buy', 'sell']).optional(),
  qty: z.coerce.number().int().positive().optional(),
})

export const Route = createFileRoute('/_authed/banking/trgovina/$listingId')({
  validateSearch: (s) => searchSchema.parse(s),
  component: BankingListingDetail,
})

function BankingListingDetail() {
  const { listingId } = Route.useParams()
  const search = Route.useSearch()
  const initialDirection = search.direction === 'sell' ? v1Direction.DIRECTION_SELL : search.direction === 'buy' ? v1Direction.DIRECTION_BUY : undefined
  return (
    <ListingDetail
      listingId={listingId}
      basePath="/banking/trgovina"
      initialDirection={initialDirection}
      initialQuantity={search.qty}
    />
  )
}
