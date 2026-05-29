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
│   │   │   └── generated/        # OpenAPI types (checked in; types-only)
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

`make help` lists every target. Each one runs inside the
`banka-frontend` container (`Dockerfile.dev`); `make HOST=1 <target>`
bypasses the container for devs with node installed locally.

```
make dev                 # vite dev server (container, port 5173)
make build               # type-check + vite build
make lint                # eslint
make typecheck           # tsc -b --noEmit
make test                # vitest run
make api-gen             # regenerate src/lib/api from gen/openapi/banka.swagger.json
make cypress-run         # headless cypress (HOST-only — see below)
make cypress-open        # cypress GUI (HOST-only)
make cypress-soak        # persistent-backend soak suite (HOST-only)
```

Cypress targets always shell to host `npm` regardless of `HOST=`,
because `cypress.config.ts` and `cypress.soak.config.ts` `docker exec`
directly into the backend containers and shell out to the backend
`seed.sh`. Pulling those into a container needs the docker socket +
backend-repo bind-mount and is intentionally out of scope for now.

`api-gen` expects the swagger doc to exist locally at
`../Banka-3-Backend/gen/openapi/banka.swagger.json`. Run `make proto`
in the backend first.

## C4 status

c4 frontend feature-complete + E2E gates green on `rewrite`. PR8
landed three new live cypress specs:

- `cypress/e2e/celina4/otc-day.cy.ts` — spec p.79 worked example
  (Marija ↔ Luka), seller publishes 10 AAPL → buyer offers → seller
  counters → buyer accepts (verification-gated) → admin price bump
  → buyer exercises (verification-gated) → tax cron. Pins premium
  ($10) + strike ($1000) numeric invariants; asserts
  `reserved_count` returns to 0 on exercise + the seller realized_gain
  row + state_tax credit == reported totalRsd.

- `cypress/e2e/celina4/funds-day.cy.ts` — supervisor creates fund +
  invests "u ime banke" 30k RSD → client invests 30k → supervisor
  places fund-actor MARKET BUY for 400 NIS via gateway (FE has no
  fund-actor BUY UI; only SELL via `FundSellHoldingDialog`) → NIS
  price bump → liquid 5k withdraw → 18k withdraw exceeds liquid →
  illiquid path triggers auto-liquidation → both withdraws flip to
  completed → client realized_gain rows (RSD, gain > 0) → tax cron.

- `cypress/soak/c4-multi-round.cy.ts` (`npm run cypress:soak`) —
  3 OTC + fund cycles back-to-back. Cross-round invariants:
  `holdings.reserved_count=0`, no `bank.reservations` in 'held',
  no `saga_executions` in {running,compensating} past 60s,
  `state_tax` monotonic + continuity across rounds, tax idempotency
  at the end. Pairs with c3-multi-round; both are persistent-backend
  gates after touching SAGA / settlement / tax paths.

**Routes added**: `_authed/{portal,banking}/otc/{index,ponude,ugovori}`,
`_authed/{portal,banking}/fondovi/{index,$fundId}`,
`_authed/portal/profit-banke/{aktuari,fondovi}`. The portal+banking
OTC + funds pages share the same components — only the route URL
differs.

**Resolved on 2026-05-12 (c4-PR8):**

- *OTC offer/counter date conversion* — `CreateOTCOfferDialog` +
  `OTCThreadModal` now pin `settlementDate` to midnight UTC
  (`${value}T00:00:00Z`) before calling the backend. The bare
  `YYYY-MM-DD` string from `<input type="date">` rejected through
  grpc-gateway as "invalid google.protobuf.Timestamp"; the canned
  unit spec mocked the endpoint so it didn't surface this. Pattern
  applies to every new endpoint with a Timestamp field — see
  `[[yyyymmdd-proto-timestamp]]`.

- *Fund dialog source/dest pickers when acting on behalf of bank* —
  `InvestFundDialog` + `WithdrawFundDialog` now pass
  `kind=ACCOUNT_KIND_FOREX_BOOK` when the supervisor toggles
  "u ime banke". `bank.ListAccounts` silently excludes
  system/state_tax/forex_book/fund unless `kind=` is set, so the
  picker came back empty under the FOREX_BOOK_OWNER_ID sentinel.
  See `[[listaccounts-exclude-kinds]]`.

- *Fund dialogs leaked the verification overlay on success* — both
  `InvestFundDialog` and `WithdrawFundDialog`'s mutation `onSuccess`
  now reset `showVerify=false` before closing the outer dialog.
  Without it, the outer closed but the verification overlay stayed
  in the DOM with a fixed-inset modal scrim that covered the next
  click target.

- *Cypress resetBackend missed c4 schema tables* — `cypress.config.ts`
  TRUNCATE list now includes `investment_funds`,
  `client_fund_positions`, `client_fund_transactions`,
  `fund_performance_snapshots`, `otc_offers`, `otc_contracts`, and
  `bank.reservations`. A re-run of any OTC or funds spec after a
  prior run rejected the second `CreateFund` with "fond sa istim
  imenom već postoji".

## C1 + C2 + C3 status

c1 + c2 + c3 frontend is feature-complete on the `rewrite` branch as
of 2026-05-10. `tsc -b` clean, `npm run lint` clean (0 errors / 0
warnings), vitest 192 green, cypress c3 canned suite green plus the
c3 live specs (tax-run, exchange-halt, client-trading, agent-pending-
approval, supervisor-cancel, **e2e-trading-day**). The
`e2e-trading-day` spec walks the C3-E2E.pdf "kompletan radni dan"
scenario end-to-end (12 DEO blocks) and gates on numeric invariants:
bank's USD trading-book delta after BUY (= notional + $7 commission),
again after the round-trip, realized_gains row values
(cost/proceeds/profit_native to ±$0.01), and `state-tax` RSD account
delta == agent's unpaid before the run. The soak suite at
`cypress/soak/c3-multi-round.cy.ts` (`npm run cypress:soak`) is the
cross-round gate — runs four BUY/SELL/tax/reset rounds (round 4 uses
ORDER_TYPE_LIMIT to exercise the spec p.51 min(limit,ask)/
max(limit,bid) fill-price path) back-to-back without resetBackend
and asserts state_tax monotonicity + continuity, zero pending exec
/ saga / duplicate-op-leg rows, usedLimit accumulation+reset, the
bank's USD forex_book strict-decrease per round, per-round
sum(new realized_gains.quantity) == sellQty (defends against the
partial-fill chunker dropping or duplicating a row), positive
gain_native/gain_rsd per round, and a final tax-idempotency invariant
(extra runTax after all rounds returns 0/0 and doesn't move
state_tax). The `psql` task in `cypress.soak.config.ts` uses `--csv`
without `--no-align`; combining the two silently reverts the
delimiter to `|` and breaks multi-column row parsing.

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
- generated OpenAPI types under `src/lib/api/generated/` (checked in;
  regenerate with `npm run api:gen` after `make proto` in backend
  when the swagger doc changes) — types only; hand-written axios
  wrappers do the calls
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
