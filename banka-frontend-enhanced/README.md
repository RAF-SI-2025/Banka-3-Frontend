# Banka-3-Frontend

Vite + React 19 + TypeScript SPA for Banka 3. Targets two surfaces
(client app + employee portal) over a single bundle, gated by JWT
permissions.

See `CLAUDE.md` for architecture, conventions, and roadmap. Quick start:

```bash
cp .env.example .env.local
make dev          # vite dev server at http://localhost:5173
```

`make dev` runs vite inside the `banka-frontend` container
(`Dockerfile.dev`), so the only host requirement is Docker (with the
Compose plugin) and GNU Make. Dependencies are pre-installed (`npm ci`)
into the image at build time and shared with one-shot containers via
a named volume. After a `package.json` change run `make install` to
rebuild the image and reset the volume. `make help` lists every
target — `lint`, `typecheck`, `test`, `build`, `api-gen` all run
through the same image.

Inside the container, `/api/*` proxies to
`http://host.docker.internal:8080` (the host's backend gateway). On
Linux Docker 20.10+ and Docker Desktop this resolves automatically.

`make HOST=1 <target>` bypasses the container for devs with node + npm
installed locally.

Cypress remains host-driven (`make cypress-run`, `make cypress-open`,
`make cypress-soak` — all shell to host `npm`). Its configs
`docker exec` directly into the backend containers and shell out to
the backend `seed.sh`, which doesn't translate cleanly into a
container.
