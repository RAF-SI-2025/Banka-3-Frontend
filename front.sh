#!/usr/bin/env bash
# Run each Celina3 cypress spec in isolation against a fresh DB.
# Per-spec invocation is required: services hold in-process state
# (executor queues, exchange-hours overrides) that survives db:reset
# but not a container restart.
set -u

BACKEND=/home/user/si/Banka-3-Backend
FRONTEND=/home/user/si/Banka-3-Frontend
LOG_DIR=$FRONTEND/cypress-run
mkdir -p "$LOG_DIR"
SUMMARY="$LOG_DIR/SUMMARY.txt"
: > "$SUMMARY"

SPECS=(
  agents-management.cy.js
  exchanges.cy.js
  margin-aon.cy.js
  orders-approval.cy.js
  orders-creation.cy.js
  orders-execution.cy.js
  portfolio.cy.js
  tax-tracking.cy.js
  trading-day-e2e.cy.js
)

reset_db() {
  echo "  >> nuke/schema/seed + restart bank,gateway,exchange"
  ( cd "$BACKEND" && \
    make nuke   >/dev/null 2>&1 && \
    make schema >/dev/null 2>&1 && \
    make seed   >/dev/null 2>&1 )
  docker restart bank gateway exchange >/dev/null 2>&1
  for i in $(seq 1 30); do
    code=$(curl -sS -m 2 -o /dev/null -w "%{http_code}" http://localhost:8080/api/exchanges 2>/dev/null || echo 000)
    if [ "$code" = "401" ]; then return 0; fi
    sleep 1
  done
  echo "  !! gateway didn't come back to 401 in 30s (last=$code)"
}

cd "$FRONTEND"

for spec in "${SPECS[@]}"; do
  echo "===== $spec ====="
  reset_db

  log="$LOG_DIR/${spec}.log"
  CYPRESS_SCHEMA_SQL=$BACKEND/scripts/db/schema.sql \
  CYPRESS_SEED_SQL=$BACKEND/scripts/db/seed.sql \
  CYPRESS_RESTART_CONTAINERS=bank,gateway,exchange \
  npx cypress run --spec "cypress/e2e/celina3/$spec" >"$log" 2>&1
  rc=$?

  # Cypress wraps the summary table in box-art (│), so we strip non-key chars
  # before matching. Also trims runs of whitespace for compactness.
  summary_line=$(grep -E "(Tests|Passing|Failing|Pending|Skipped):" "$log" | sed 's/[^A-Za-z0-9: ]//g; s/  */ /g; s/^ //' | tr '\n' ' ')
  echo "$spec  rc=$rc  $summary_line" | tee -a "$SUMMARY"
done

echo
echo "===== ALL DONE ====="
cat "$SUMMARY"
