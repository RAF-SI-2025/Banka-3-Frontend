# syntax=docker/dockerfile:1.7
#
# Production image for Banka-3-Frontend. Multi-stage:
#   1. node:20-alpine — install deps + vite build
#   2. nginxinc/nginx-unprivileged — serve dist/ with SPA fallback
#
# Dev image (vite dev server, vitest, eslint) lives in Dockerfile.dev.

FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Default VITE_API_BASE is /api (same-origin via HTTPRoute), so no
# build-arg needed. Override by passing --build-arg VITE_API_BASE=...
ARG VITE_API_BASE
ENV VITE_API_BASE=${VITE_API_BASE}
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine
# Patch OS packages against the current Alpine 3.21 branch. The upstream
# nginx image lags the latest apk security backports, so a fresh `apk
# upgrade` clears the Harbor/Trivy OS-package findings (openssl, libpng,
# libxml2, curl, musl, zlib, ...) without a base-image major bump. Needs
# root; the base runs as UID 101, so drop back afterwards.
USER root
RUN apk upgrade --no-cache
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
USER 101
EXPOSE 8080
