import { createFileRoute } from '@tanstack/react-router'
import { ListingDetail } from '@/components/trading/ListingDetail'

export const Route = createFileRoute('/_authed/banking/trgovina/$listingId')({
  component: BankingListingDetail,
})

function BankingListingDetail() {
  const { listingId } = Route.useParams()
  return <ListingDetail listingId={listingId} basePath="/banking/trgovina" />
}
