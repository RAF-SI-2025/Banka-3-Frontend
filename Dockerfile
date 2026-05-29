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
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
