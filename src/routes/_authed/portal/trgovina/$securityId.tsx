import { createFileRoute } from '@tanstack/react-router'
import { ListingDetail } from '@/components/trading/ListingDetail'

export const Route = createFileRoute('/_authed/portal/trgovina/$securityId')({
  component: PortalListingDetail,
})

function PortalListingDetail() {
  // The param carries a *security* id (the catalog row builds it from
  // `sec.id`); ListingDetail's prop is named `listingId` for legacy
  // reasons but `getSecurity` accepts both.
  const { securityId } = Route.useParams()
  return <ListingDetail listingId={securityId} basePath="/portal/trgovina" />
}
