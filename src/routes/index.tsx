import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Landing,
})

function Landing() {
  return (
    <main className="container py-12">
      <h1 className="text-3xl font-semibold">Banka 3</h1>
      <p className="mt-2 text-muted-foreground">
        Rewrite scaffolding. Login lands here once celina 1 is wired.
      </p>
    </main>
  )
}
