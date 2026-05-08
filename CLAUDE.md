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
- **Axios** — HTTP transport, configured via the generated client
- **Vitest** — unit tests for hooks/utils
- **Cypress** — e2e against the running stack
- **OpenAPI codegen** — typed client generated from the backend's
  `gen/openapi/banka.swagger.json` into `src/lib/api/`

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
│   │   ├── api/                  # generated OpenAPI client (gitignored)
│   │   ├── auth/                 # JWT helpers, refresh flow
│   │   ├── permissions.ts        # permission constants + helpers
│   │   └── query-keys.ts         # query key factory
│   ├── components/
│   │   ├── ui/                   # shadcn copies (button, dialog, …)
│   │   └── <domain>/             # feature components
│   ├── hooks/                    # cross-feature hooks
│   ├── stores/                   # Zustand stores
│   ├── styles/                   # globals.css with Tailwind directives
│   └── i18n/                     # SR strings (UI is in Serbian)
├── cypress/
│   ├── e2e/celina<n>/            # acceptance tests per celina
│   └── support/                  # commands, intercepts
└── README.md
```

## Conventions

- **TypeScript strict** is non-negotiable. No `any`. Use `unknown` and
  narrow at the boundary.
- **API calls** go through the generated client in `src/lib/api`. Never
  write `axios` calls in components — wrap in a TanStack Query hook in
  `hooks/use<Resource>.ts`.
- **Query keys** are produced by the factory in `src/lib/query-keys.ts`,
  not hand-written strings. Cache invalidation uses key prefixes.
- **Forms** use React Hook Form with a Zod resolver. Define the schema
  next to the form. Don't reach into the DOM.
- **Routing**: TanStack Router file-based. Auth + permission gates live
  in `__root.tsx` (and per-folder `_layout.tsx` for sub-areas). A route
  that needs `client.trading.read` declares it via `beforeLoad`.
- **State boundaries**: TanStack Query owns *server* state (anything
  the API returns). Zustand owns *UI* state (modal open, draft input,
  theme). Never duplicate server state into Zustand.
- **Strings** are in Serbian (the spec is in Serbian). Keep them in
  `src/i18n/` keyed by feature. No string literals in JSX once a key
  exists. Code identifiers stay English.
- **shadcn components** are copied (not imported), so customizing means
  editing `src/components/ui/<component>.tsx` directly.
- **Cypress specs** live under `cypress/e2e/celina<n>/` mirroring the
  spec files in `/home/user/si/spec/TestoviCelina<n>.md`. One spec per
  feature, scenarios match the markdown line for line where reasonable.
- **Idempotency**: any mutating call against `/api/v1/...` includes an
  `Idempotency-Key` header (UUID v4). Wrapping is in
  `src/lib/api/client.ts`.

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

## What's not done yet

This branch is a scaffold. Next steps:

1. Stand up the login page and wire the auth flow against a real `user`
   gRPC service (depends on backend celina 1 progress).
2. Set up TanStack Router file structure with auth gate.
3. Get one Cypress spec green end-to-end (login + redirect).

Then build out per celina, one feature at a time, writing Cypress
acceptance tests as we go.

## Spec edge cases that bite

The frontend is the only place users see Serbian copy. Watch for:

- **Date format** is DD.MM.YYYY in displays, ISO in API.
- **Money formatting** uses `,` thousands and `.00` decimal — but the
  spec shows `180,00.00` in places (data entry quirk; render as
  `180.000,00 RSD`).
- **Currency display order**: amount first, then currency code.
- **Verification flow** shows a fake QR + 6-digit code in dev (mobile
  app deferred until c5). Spec calls for 5min code window + 3 retry
  attempts.
- **Limit info popover** on payment forms must show "remaining" against
  daily/monthly limits — read from account detail, not recompute.
