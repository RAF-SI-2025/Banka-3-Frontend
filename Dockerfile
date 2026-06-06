# syntax=docker/dockerfile:1.7
#
# Production image for Banka-3-Frontend. Multi-stage:
#   1. node:24-alpine — install deps + vite build
#   2. nginxinc/nginx-unprivileged — serve dist/ with SPA fallback
#
# Pin exact versions (newest stable at time of bump) rather than floating
# tags, so builds are reproducible and we control when we move. Refresh
# both pins deliberately when newer stable releases land.
#
# Dev image (vite dev server, vitest, eslint) lives in Dockerfile.dev.

FROM node:24.16.0-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Default VITE_API_BASE is /api (same-origin via HTTPRoute), so no
# build-arg needed. Override by passing --build-arg VITE_API_BASE=...
# The default has to live here (not just in the TS client's `??`
# fallback) because vite materializes ARG into import.meta.env as the
# empty string when ARG has no default — and `??` only catches
# null/undefined, not "", so an empty build-arg silently produces a
# bundle that POSTs to /v1/... instead of /api/v1/... → 405 from
# the frontend nginx.
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=${VITE_API_BASE}
# Faro OTLP endpoint — Grafana Faro pushes browser traces + Web events
# to this URL. Defaulted to the in-cluster external HTTPRoute on
# alloy; override per environment if you stand up a separate Faro
# instance. Same "empty ARG → empty string in import.meta.env"
# materialization gotcha as VITE_API_BASE — the default has to live in
# the Dockerfile, not just the TS fallback.
ARG VITE_FARO_URL=https://otel.urosevicvuk.dev/v1/traces
ENV VITE_FARO_URL=${VITE_FARO_URL}
# Build version stamped into spans / Faro events so we can correlate
# regressions with releases. CI sets this to the git short-sha;
# locally it falls through to the in-TS '0.0.0-dev' fallback.
ARG VITE_APP_VERSION
ENV VITE_APP_VERSION=${VITE_APP_VERSION}
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.30.2-alpine3.23
# nginx 1.30.2 (current stable) on Alpine 3.23. Moved off 3.21 because
# Alpine flagged CVE-2026-6732 (libxml2) won't-fix on 3.21 — the backport
# only exists on 3.22+, where libxml2 is 2.13.9-r1. 3.23 carries the fix.
#
# Patch OS packages on top: the upstream nginx image lags the latest apk
# security backports, so a fresh `apk upgrade` keeps every OS package
# (openssl, libpng, libxml2, curl, musl, zlib, ...) at the newest 3.23
# build — best chance of holding at zero CVEs between base bumps. Needs
# root; the base runs as UID 101, so drop back afterwards.
USER root
# Cache-bust the apk layer. The GHA build cache keys this RUN on the
# command string + parent layer, NOT the live apk repo contents, so a
# rebuild after Alpine publishes a new security backport can otherwise
# reuse a stale layer and ship outdated packages. Bump APK_REFRESH (or
# pass --build-arg APK_REFRESH=<anything-new>) to force a fresh pull.
ARG APK_REFRESH=2026-05-31
RUN echo "apk-refresh:${APK_REFRESH}" && apk upgrade --no-cache
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
USER 101
EXPOSE 8080
