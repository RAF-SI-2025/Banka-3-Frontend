import { createFileRoute } from '@tanstack/react-router'

// Stub for FE-3 row-click navigation; full detail page lands in FE-4.
export const Route = createFileRoute('/_authed/portal/trgovina/$listingId')({
  component: PortalListingDetail,
})

function PortalListingDetail() {
  const { listingId } = Route.useParams()
  return (
    <main className="container py-8">
      <h1 className="text-2xl font-semibold">Detalji hartije</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Listing <code className="font-mono">{listingId}</code> — detaljan prikaz dolazi u FE-4.
      </p>
    </main>
  )
}
