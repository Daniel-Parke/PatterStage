#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# ps-health-check.sh — probe PatterStage + Hermes gateway health
# ═══════════════════════════════════════════════════════════════
# Curls the PatterStage status endpoint and the Hermes gateway health
# endpoint and prints a compact OK/FAIL summary. Read-only. Exits non-zero
# if the PatterStage itself is unreachable (useful as a cron heartbeat).
#
# Environment (defaults in parentheses):
#   PS_URL        (http://127.0.0.1:${PORT:-3000})
#   GATEWAY_URL   (http://127.0.0.1:8642)

set -uo pipefail

PS_URL="${PS_URL:-http://127.0.0.1:${PORT:-3000}}"
GATEWAY_URL="${GATEWAY_URL:-http://127.0.0.1:8642}"

log() { echo "[$(date -Iseconds 2>/dev/null || date)] [ps-health] $*"; }

probe() {
  local name="$1" url="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    log "OK   $name ($url) → $code"
    return 0
  fi
  log "FAIL $name ($url) → $code"
  return 1
}

rc=0
probe "PatterStage" "$PS_URL/api/health" || rc=1
probe "Gateway" "$GATEWAY_URL/health" || true   # gateway being down is informational

log "health check complete (rc=$rc)"
exit "$rc"
