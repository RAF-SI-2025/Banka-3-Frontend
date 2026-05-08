# Banka-3-Frontend

Vite + React 19 + TypeScript SPA for Banka 3. Targets two surfaces
(client app + employee portal) over a single bundle, gated by JWT
permissions.

See `CLAUDE.md` for architecture, conventions, and roadmap. Quick start:

```bash
cp .env.example .env.local
npm install
npm run dev
```

The dev server proxies `/api` to the backend gateway at
`http://localhost:8080` (override via `VITE_API_BASE` in `.env.local`).
