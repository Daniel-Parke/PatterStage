#!/usr/bin/env bash
# BD4 merge gate: build the combined CH+Hermes image, bring the stack up, and
# prove the benchmark gateway manager end-to-end — PatterStage spawns a
# per-profile `hermes gateway`, an agentic run completes through it, and the
# ephemeral profile is torn down. KEEP_STACK=1 leaves the stack running.
set -euo pipefail

COMPOSE="docker compose -f docker-compose.bench-gateway.yml -p hermes-benchgw"
PS_URL="${PS_URL:-http://127.0.0.1:42070}"

cleanup() {
  if [ "${KEEP_STACK:-0}" != "1" ]; then
    echo "[bench-gw] tearing down stack..."
    $COMPOSE down -v >/dev/null 2>&1 || true
  else
    echo "[bench-gw] KEEP_STACK=1 — leaving stack up at ${PS_URL}"
  fi
}
trap cleanup EXIT

echo "[bench-gw] building + starting combined CH+Hermes stack..."
$COMPOSE down -v >/dev/null 2>&1 || true
$COMPOSE up -d --build

echo "[bench-gw] running gateway e2e against ${PS_URL}..."
PS_URL="$PS_URL" node test-harness/bench-gateway-e2e.mjs

echo "[bench-gw] PASSED ✅"
