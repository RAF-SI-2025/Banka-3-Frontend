# Banka-3-Frontend

Vite + React 19 + TypeScript app. Two surfaces: an employee portal (admin
+ supervisor + agent + basic-employee views) and a client-facing banking
app. Same SPA, route guards key off the JWT permissions claim.

The top-level memory at `/home/user/si/CLAUDE.md` has the architecture
overview; this file is the frontend-specific working memory.

## Stack (locked)

- **Vite + React 19 + TypeScript** (strict mode)
- **TanStack Router** — file-based, type-safe routes with route-level
  loaders
- **TanStack Query** — server state (queries, mutations, cache)
- **Zustand** — UI/client state (modals, drafts, persisted preferences)
- **React Hook Form + Zod** — forms with schema validation
- **shadcn/ui + Tailwind CSS** — components copied into `src/components/ui`
- **Axios** — HTTP transport, configured directly. The OpenAPI codegen
  generates typed models into `src/lib/api/generated/`; the actual axios
  calls live in hand-written wrappers in `src/lib/api/*.ts` (the
  generated `request.ts` doesn't fit our auth/refresh / Idempotency-Key
  / X-Verification-* header flow without a wrapper anyway).
- **Vitest** — unit tests for hooks/utils
- **Cypress** — e2e against the running stack

## Layout

```
.
├── package.json
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── vite.config.ts
├── tailwind.config.ts / postcss.config.js
├── eslint.config.js
├── cypress.config.ts
├── index.html
├── public/
├── src/
│   ├── main.tsx                  # Vite entry; wires QueryClient + Router
│   ├── routes/                   # TanStack Router file-based routes
│   │   ├── __root.tsx            # layout + auth gate
│   │   ├── index.tsx             # / (landing or redirect)
│   │   ├── login.tsx
│   │   ├── (client)/             # client-area routes
│   │   └── (employee)/           # employee-area routes
│   ├── lib/
│   │   ├── api/                  # hand-written axios wrappers + helpers
│   │   │   ├── error.ts          # apiError(): typed message extractor
│   │   │   ├── verification.ts   # spec p.11 verifikacioni-kod client
│   │   │   └── generated/        # OpenAPI types (gitignored; types-only)
│   │   ├── auth/                 # JWT helpers, refresh flow, password Zod
│   │   ├── permissions.ts        # permission constants + helpers
│   │   └── query-keys.ts         # query key factory
│   ├── components/
│   │   ├── ui/                   # shadcn copies (button, dialog, …)
│   │   ├── verification/         # VerificationDialog (spec p.11)
│   │   └── <domain>/             # feature components
├── cypress/
│   ├── e2e/celina<n>/            # acceptance tests per celina
│   └── support/                  # commands, intercepts
└── README.md
```

## Conventions

- **TypeScript strict** is non-negotiable. No `any` outside generated
  files. Use `unknown` and narrow at the boundary; for axios errors
  use `apiError(err, fallback)` from `src/lib/api/error.ts`.
- **API calls** are hand-written axios wrappers in `src/lib/api/*.ts`
  that take typed `v1*Request` models from `generated/`. Components
  never call `axios` directly — they go through these wrappers,
  usually inside a TanStack Query mutation/query.
- **Query keys** are produced by the factory in `src/lib/query-keys.ts`,
  not hand-written strings. Cache invalidation uses key prefixes.
- **Forms** use React Hook Form with a Zod resolver. Define the schema
  next to the form. Don't reach into the DOM. The spec p.10 password
  rule lives in `src/lib/auth/password.ts` so login / activate /
  password-reset / set-password share one schema.
- **Routing**: TanStack Router file-based. Auth gate is `_authed.tsx`
  (checks accessToken). User-kind routing lives at the next layer:
  `_authed/portal.tsx` redirects clients to `/banking`,
  `_authed/banking.tsx` redirects employees to `/portal`. Permission-
  gated UI inside each surface uses `Permissions.has()`.
- **State boundaries**: TanStack Query owns *server* state (anything
  the API returns). Zustand owns *UI* state (modal open, draft input,
  theme). Never duplicate server state into Zustand.
- **Strings** are in Serbian (the spec is in Serbian) — written inline
  at call sites; only the enum-label maps live in `src/lib/labels.ts`.
- **shadcn components** are copied (not imported), so customizing means
  editing `src/components/ui/<component>.tsx` directly.
- **Cypress specs** live under `cypress/e2e/celina<n>/` mirroring
  scenarios in `spec/Banka2025-E2E.pdf`. One spec per feature.
- **Idempotency**: any mutating call against `/api/v1/...` includes an
  `Idempotency-Key` header (UUID v4). Wrapping is in
  `src/lib/api/client.ts`.
- **Verification (spec p.11)**: payments / transfers / FX / limit
  changes / card-issue mutations are gated by `VerificationDialog`.
  The dialog requests a 6-digit code via
  `POST /api/v1/verification/request` (returned in the response in
  dev mode), shows it to the user behind a fake QR, and on confirm
  attaches `X-Verification-Id` + `X-Verification-Code` headers to the
  downstream request. Backend gateway middleware consumes the headers.

## Auth flow

1. `POST /api/v1/auth/login` returns `{ accessToken }`. Refresh token is
   set as an `httpOnly` cookie by the gateway — JS never sees it.
2. Access token lives in memory (Zustand store, **not** localStorage).
3. Axios interceptor attaches `Authorization: Bearer <token>` to every
   request.
4. On 401, the interceptor calls `POST /api/v1/auth/refresh`
   (cookie-only), retries the original request once, and pushes the
   new token to the store.
5. Permissions are decoded from the access token and exposed via
   `useAuth()`. Route guards call `usePermission('client.trading.read')`.
6. Logout clears the store and calls `POST /api/v1/auth/logout` to
   revoke the refresh token.

## Commands

```
npm run dev              # vite dev server
npm run build            # type-check + vite build
npm run preview          # preview production build
npm run lint             # eslint
npm run typecheck        # tsc --noEmit
npm run test             # vitest run
npm run test:watch       # vitest watch
npm run cypress:open     # cypress GUI
npm run cypress:run      # headless
npm run api:gen          # regenerate src/lib/api from gen/openapi/banka.swagger.json
```

`api:gen` expects the swagger doc to exist locally at
`../Banka-3-Backend/gen/openapi/banka.swagger.json`. Run `make proto` in
the backend first.

## C1 + C2 + C3 status

c1 + c2 + c3 frontend is feature-complete on the `rewrite` branch as
of 2026-05-10. `tsc -b` clean, `npm run lint` clean, vitest 121 green,
cypress c3 canned suite green plus all 5 c3 live specs (tax-run,
exchange-halt, client-trading, agent-pending-approval,
supervisor-cancel — each green individually).

**Routes**:
- `/login`, `/activate`, `/password-reset[/confirm]` — c1 auth surface
  (all RHF + Zod, password rule shared via `lib/auth/password.ts`)
- `_authed/portal/*` — employee portal (clients redirected to
  `/banking`): employees, clients, companies, accounts, cards,
  loan-requests, loans, exchange (rates editor), trgovina (catalog +
  detail + nalozi), portfolio, aktuari, porez, berze
- `_authed/banking/*` — client portal (employees redirected to
  `/portal`): home, racuni (list filtered to active + sorted by
  raspoloživo desc; detail page covers spec p.20 — Vlasnik, Rezervisana
  sredstva, Promena naziva, Promena limita, transaction filters),
  kartice, placanja, transferi, menjacnica, primaoci, krediti,
  trgovina (catalog + detail + nalozi), portfolio

**Conventions in place**:
- Idempotency-Key on every mutation (axios request interceptor)
- VerificationDialog wraps payment / transfer / fx / limit / card-create
  submits with the spec p.11 6-digit-code round-trip
- shared `CardCreateDialog` for client + portal card-creation flows
  (client kartice page can issue cards; spec-mandated email/code
  confirmation runs through the same VerificationDialog primitive)
- generated OpenAPI types under `src/lib/api/generated/` (gitignored;
  `npm run api:gen` after `task proto` in backend) — types only;
  hand-written axios wrappers do the calls
- typed axios error helper `apiError()` in `src/lib/api/error.ts` —
  no `(err as any)` anywhere in app code
- Serbian labels for every backend enum in `src/lib/labels.ts` —
  vitest test in `labels.test.ts` walks each enum and fails if a
  value is missing a Serbian string

**Open carryovers**:
- *Live cypress flake on first spec of multi-spec run.* Vite-dev's
  lazy dep bundling means the cold-start first cy.visit can hang
  the SPA paint. `cy.resetBackend()` warms vite via a /login
  pre-visit, which is enough to get each spec stable individually.
  `cypress.config.ts` enables `retries: { runMode: 1 }` so a
  back-to-back run absorbs the cold-start hit on the first slot
  rather than failing the whole batch. Interactive (`cypress open`)
  keeps zero retries so failures stay visible while iterating.

**Resolved 2026-05-10:**
- *Actuary account picker* — `OrderForm` now branches the account
  query on `isActuary`: clients pass `ownerClientId=userId` (their
  own accounts), employees pass `ownerClientId=ForexBookOwnerID`
  (sentinel `00000000-0000-0000-0000-000000000020`, the bank's
  per-currency forex_book accounts). The bank's `trade_settle`
  rejects non-bank accounts when `IsActuary`, so this is the only
  path that produces a working actuary order. Constant lives in
  `src/lib/trading/sentinels.ts`. Unblocks the
  `agent-pending-approval` + `supervisor-cancel` live cypress
  specs.
- *Order list ticker denormalization* — added
  `src/lib/trading/useSecurityTickers.ts`, a TanStack `useQueries`
  hook that batch-fetches security tickers for displayed order
  rows (5-min staleTime, deduped against the existing
  `keys.security.detail(id)` cache so the /trgovina detail page's
  fetch hydrates the list). Both order-list routes (portal,
  banking) plus both order-detail routes render `ticker ?? id`
  instead of the raw UUID.

## Spec edge cases that bite

The frontend is the only place users see Serbian copy. Watch for:

- **Date format** is DD.MM.YYYY in displays, ISO in API.
- **Money formatting** uses `,` thousands and `.00` decimal — but the
  spec shows `180,00.00` in places (data entry quirk; render as
  `180.000,00 RSD`).
- **Currency display order**: amount first, then currency code.
- **Verification flow** issues a real 6-digit code via the gateway
  (not just decorative). The dialog displays the code inline (mobile
  app is c5); the user types it back to confirm. 5-min TTL, 3 retry
  attempts enforced server-side.
- **Limit info popover** on payment forms must show "remaining" against
  daily/monthly limits — read from account detail, not recompute.
- **Account list (client) sort**: spec p.19 mandates descending by
  raspoloživo. Handled client-side in `routes/_authed/banking/racuni/
  index.tsx`.
