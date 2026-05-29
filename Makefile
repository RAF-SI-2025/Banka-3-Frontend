# Banka-3-Frontend dev/build/test targets.
#
# Run `make help` for the list. Default behaviour shells every npm
# script through the `frontend` container in docker-compose.yml so
# the only host requirement is Docker + GNU Make. `make HOST=1
# <target>` bypasses the container and invokes npm directly — for
# devs who already have node + npm installed and want lower
# per-command latency. Cypress remains host-only either way (its
# configs `docker exec` into backend containers + shell out to the
# backend `seed.sh`); see README.

SHELL          := /bin/bash
.SHELLFLAGS    := -eu -o pipefail -c
.DEFAULT_GOAL  := help

COMPOSE        := docker compose

export HOST_UID := $(shell id -u)
export HOST_GID := $(shell id -g)

ifdef HOST
NPM := npm
else
NPM := $(COMPOSE) run --rm frontend npm
endif

.PHONY: help
help: ## List available targets
	@awk 'BEGIN {FS = ":.*##"; printf "Available targets:\n"} \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2 }' \
		$(MAKEFILE_LIST)

.PHONY: image
image: ## Build the frontend dev image
	$(COMPOSE) build frontend

.PHONY: install
install: ## Rebuild the image (the canonical way to refresh node_modules)
	$(COMPOSE) build frontend
	$(COMPOSE) down -v   # drop the named node_modules volume so it re-bootstraps

.PHONY: dev
dev: ## Run vite dev server (foregrounded; Ctrl-C to stop)
	$(COMPOSE) up

.PHONY: dev-bg
dev-bg: ## Run vite dev server detached
	$(COMPOSE) up -d

.PHONY: preview-bg
preview-bg: ## Build + run vite preview (production bundle on :5173 for cypress)
	$(COMPOSE) -f docker-compose.yml -f docker-compose.preview.yml up -d --force-recreate

.PHONY: down
down: ## Stop the dev server
	$(COMPOSE) down

.PHONY: logs
logs: ## Tail dev server logs
	$(COMPOSE) logs -f

.PHONY: build
build: ## Type-check + production build (dist/)
	$(NPM) run build

.PHONY: preview
preview: ## Serve the production build
	$(NPM) run preview

.PHONY: lint
lint: ## eslint
	$(NPM) run lint

.PHONY: typecheck
typecheck: ## tsc -b --noEmit
	$(NPM) run typecheck

.PHONY: test
test: ## vitest run (unit tests, no backend needed)
	$(NPM) run test

.PHONY: api-gen
api-gen: ## Regenerate src/lib/api/generated/ from the backend swagger
	$(NPM) run api:gen

# Cypress targets stay host-driven — see the file header. Provided
# here so the Makefile is self-documenting; they error out helpfully
# if npm isn't on PATH.
.PHONY: cypress-run
cypress-run: ## Headless cypress run (host-only; needs backend up)
	npm run cypress:run

.PHONY: cypress-open
cypress-open: ## Cypress GUI (host-only)
	npm run cypress:open

.PHONY: cypress-soak
cypress-soak: ## Persistent-backend soak suite (host-only)
	npm run cypress:soak

.PHONY: cypress-interbank
cypress-interbank: ## Celina 5 cross-bank suite — needs both Banka 3 stacks up (`make interbank-up` in backend)
	npm run cypress:interbank

.PHONY: cypress-interbank-open
cypress-interbank-open: ## Celina 5 cross-bank suite in cypress GUI
	npm run cypress:interbank:open
