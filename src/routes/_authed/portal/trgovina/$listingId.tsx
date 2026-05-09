import { createFileRoute } from '@tanstack/react-router'
import { ListingDetail } from '@/components/trading/ListingDetail'

export const Route = createFileRoute('/_authed/portal/trgovina/$listingId')({
  component: PortalListingDetail,
})

function PortalListingDetail() {
  const { listingId } = Route.useParams()
  return <ListingDetail listingId={listingId} basePath="/portal/trgovina" />
}
