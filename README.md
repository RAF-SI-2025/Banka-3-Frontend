# Banka-3-Frontend

Vite + React 19 + TypeScript SPA for Banka 3. Targets two surfaces
(client app + employee portal) over a single bundle, gated by JWT
permissions.

See `CLAUDE.md` for architecture, conventions, and roadmap.

**The backend must be running first.** This SPA is just a client — bring
up the gateway from the sibling repo before `make dev`, or you'll get a
blank app (every `/api/*` call 502s):

```bash
# in ../Banka-3-Backend (separate terminal):
cp .env.example .env && make up && make seed   # gateway on :8080

# back here:
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
through the same image. `api-gen` reads the backend's generated
OpenAPI doc at `../Banka-3-Backend/gen/openapi/banka.swagger.json`, so
the sibling repo must be checked out alongside this one and `make
proto` must have been run there first.

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

## Cluster deployment

The prod `Dockerfile` (multi-stage node-build → nginx-unprivileged
serving `dist/`) is built by `.github/workflows/build.yml` and pushed
to `registry.urosevicvuk.dev/raf-banka3/frontend:<tag>` on `main` /
`rewrite` / `v*` tags.

The Kubernetes manifests that pin and expose this image live in
[Banka-3-Infrastructure] — the SPA is served at
`https://banka.raf-project.com` with `/api/*` reverse-proxied to the
gateway in the same namespace. `VITE_API_BASE` defaults to `/api`, so
production builds need no env override.

For local development this repo is unchanged — `make dev` still spins
the vite dev server against a docker-compose backend.

[Banka-3-Infrastructure]: https://github.com/RAF-SI-2025/Banka-3-Infrastructure
