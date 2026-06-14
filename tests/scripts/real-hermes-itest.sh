#!/usr/bin/env bash
# Real-Hermes integration gate: bring up Control Hub + the REAL Hermes Agent +
# a mock LLM, run the contract-conformance + full-stack smoke tests against the
# stack, then tear down. This is the merge gate for runtime changes.
set -euo pipefail
cd "$(dirname "$0")/../.."

PROJECT="${COMPOSE_PROJECT:-hermes-realtest}"
COMPOSE="docker compose -f docker-compose.real-hermes.yml -p ${PROJECT}"
CH_PORT="${PORT:-42069}"
H_PORT="${HERMES_PORT:-8642}"
KEY="hermes-real-itest-key"

cleanup() { [ "${KEEP_STACK:-0}" = "1" ] || ${COMPOSE} down -v >/dev/null 2>&1 || true; }
trap cleanup EXIT

# Start from a clean slate so prior runs don't count against Hermes' concurrency
# limit (max 10 concurrent runs) and session-title uniqueness.
${COMPOSE} down -v >/dev/null 2>&1 || true

echo "[itest] building + starting real-Hermes stack (first run pulls a ~5GB image)…"
${COMPOSE} up -d --build

echo "[itest] waiting for Control Hub (depends on real Hermes being healthy)…"
up=0
for i in $(seq 1 150); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${CH_PORT}/api/status" 2>/dev/null || echo 000)
  if [ "$code" = "200" ]; then up=1; echo "[itest] control-hub up after ~$((i*2))s"; break; fi
  sleep 2
done
if [ "$up" != "1" ]; then
  echo "[itest] control-hub did not come up"; ${COMPOSE} ps; ${COMPOSE} logs --tail 50 hermes control-hub; exit 1
fi

echo "[itest] ── contract conformance (raw real Hermes API server) ──"
HERMES_URL="http://localhost:${H_PORT}" API_SERVER_KEY="${KEY}" \
  node tests/integration/runtime/hermes-contract.mjs

echo "[itest] ── full-stack smoke (Control Hub → real Hermes) ──"
CH_URL="http://localhost:${CH_PORT}" HERMES_URL="http://localhost:${H_PORT}" API_SERVER_KEY="${KEY}" \
  node tests/integration/runtime/full-stack-smoke.mjs

echo "[itest] PASSED ✅"
