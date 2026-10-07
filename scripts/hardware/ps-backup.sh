#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# ps-backup.sh — Hindsight snapshot via hindsight_bridge.py (Hermes agent)
# ═══════════════════════════════════════════════════════════════
# Calls list, directives, and mental-models; merges JSON; rotates old files.
# Requires: bash, jq, and a working Hindsight HTTP server (see bridge api_url).
#
# Environment (defaults in parentheses):
#   HERMES_HOME                     ($HOME/.hermes)
#   HINDSIGHT_BACKUP_DIR            ($HERMES_HOME/backups/hindsight)
#   HINDSIGHT_BACKUP_BANK           (hermes)
#   HINDSIGHT_BACKUP_RETENTION_DAYS (30)
#   HINDSIGHT_BACKUP_LIMIT          (999999)
#   HINDSIGHT_API_KEY               (optional; else llm_api_key from hindsight/config.json)

set -euo pipefail

HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
HINDSIGHT_BACKUP_DIR="${HINDSIGHT_BACKUP_DIR:-$HERMES_HOME/backups/hindsight}"
HINDSIGHT_BACKUP_BANK="${HINDSIGHT_BACKUP_BANK:-hermes}"
HINDSIGHT_BACKUP_RETENTION_DAYS="${HINDSIGHT_BACKUP_RETENTION_DAYS:-30}"
HINDSIGHT_BACKUP_LIMIT="${HINDSIGHT_BACKUP_LIMIT:-999999}"

if ! command -v jq >/dev/null 2>&1; then
  echo "[$(date -Iseconds 2>/dev/null || date)] [ps-backup] ERROR: jq is required but not in PATH" >&2
  exit 1
fi

BRIDGE="$HERMES_HOME/scripts/hindsight_bridge.py"
if [[ ! -f "$BRIDGE" ]]; then
  echo "[$(date -Iseconds 2>/dev/null || date)] [ps-backup] ERROR: bridge not found: $BRIDGE" >&2
  exit 1
fi

hermes_default_root() {
  local h="${1:-$HERMES_HOME}"
  if [[ "$(basename "$(dirname "$h")")" == "profiles" ]]; then
    dirname "$(dirname "$h")"
  elif [[ "$h" == "$HOME/.hermes" || "$h" == "$HOME/.hermes/"* ]]; then
    echo "$HOME/.hermes"
  else
    echo "$h"
  fi
}

# Print the Hermes venv interpreter on stdout, or return 1.
#
# It RETURNS on failure, it does not exit. This function is only ever run inside
# $( ), and an `exit 1` there kills the subshell, not the script: the status is
# handed back to the assignment and, in any context where `set -e` is not in
# force (a caller that sources this file, an `if`, a `&&` chain), the script
# carries on with an empty interpreter path. A return status the caller checks
# works in every one of those contexts.
resolve_python() {
  local default_root
  default_root="$(hermes_default_root "$1")"
  local p
  for p in \
    "$default_root/hermes-agent/venv/bin/python3" \
    "$default_root/hermes-agent/.venv/bin/python3"; do
    if [[ -x "$p" ]]; then
      echo "$p"
      return 0
    fi
  done
  echo "[$(date -Iseconds 2>/dev/null || date)] [ps-backup] ERROR: Hermes venv not found under $default_root/hermes-agent" >&2
  return 1
}

if ! PYTHON="$(resolve_python "$HERMES_HOME")"; then
  exit 1
fi
CFG="$HERMES_HOME/hindsight/config.json"
API_KEY="${HINDSIGHT_API_KEY:-}"
if [[ -z "$API_KEY" && -f "$CFG" ]]; then
  API_KEY="$(jq -r '.llm_api_key // empty' "$CFG" 2>/dev/null || true)"
fi

export PYTHONPATH="${HERMES_HOME}/hermes-agent${PYTHONPATH:+:$PYTHONPATH}"
if [[ -n "$API_KEY" ]]; then
  export HINDSIGHT_API_KEY="$API_KEY"
fi

run_bridge() {
  "$PYTHON" "$BRIDGE" "$@"
}

WORKDIR="$(mktemp -d)"
cleanup() {
  rm -rf "${WORKDIR:-}"
}
trap cleanup EXIT

LIST_JSON="$(run_bridge list --bank "$HINDSIGHT_BACKUP_BANK" --limit "$HINDSIGHT_BACKUP_LIMIT")"
DIR_JSON="$(run_bridge directives --bank "$HINDSIGHT_BACKUP_BANK")"
MM_JSON="$(run_bridge mental-models --bank "$HINDSIGHT_BACKUP_BANK")"

bridge_fail() {
  echo "[$(date -Iseconds 2>/dev/null || date)] [ps-backup] ERROR: bridge $1: $2" >&2
  exit 1
}

check_bridge_json() {
  local name="$1"
  local json="$2"
  if ! echo "$json" | jq -e . >/dev/null 2>&1; then
    bridge_fail "$name" "invalid JSON (first 200 chars): ${json:0:200}"
  fi
  if echo "$json" | jq -e 'type == "object" and (.error != null)' >/dev/null 2>&1; then
    bridge_fail "$name" "$(echo "$json" | jq -c .)"
  fi
}

check_bridge_json "list" "$LIST_JSON"
check_bridge_json "directives" "$DIR_JSON"
check_bridge_json "mental-models" "$MM_JSON"

EXPORTED_AT="$(date -Iseconds 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ")"

MERGED="$(jq -n \
  --argjson list "$LIST_JSON" \
  --argjson dir "$DIR_JSON" \
  --argjson mm "$MM_JSON" \
  --arg exported_at "$EXPORTED_AT" \
  --arg bank "$HINDSIGHT_BACKUP_BANK" \
  '{
    exported_at: $exported_at,
    bank: $bank,
    memories: ($list.memories // []),
    list_count: ($list.count // null),
    list_total: ($list.total // null),
    directives: ($dir.directives // []),
    mental_models: ($mm.models // [])
  }')"

mkdir -p "$HINDSIGHT_BACKUP_DIR"
STEM="${HINDSIGHT_BACKUP_BANK}-$(date +%Y%m%dT%H%M%S 2>/dev/null || date +%Y%m%d%H%M%S)"
OUT="$HINDSIGHT_BACKUP_DIR/${STEM}.json"
TMP="$WORKDIR/final.json"
echo "$MERGED" >"$TMP"
mv "$TMP" "$OUT"

# Remove backups older than retention (days)
if [[ "${HINDSIGHT_BACKUP_RETENTION_DAYS}" =~ ^[0-9]+$ ]] && [[ "$HINDSIGHT_BACKUP_RETENTION_DAYS" -gt 0 ]]; then
  find "$HINDSIGHT_BACKUP_DIR" -maxdepth 1 -type f -name "${HINDSIGHT_BACKUP_BANK}-*.json" -mtime "+${HINDSIGHT_BACKUP_RETENTION_DAYS}" -delete 2>/dev/null || true
fi

SIZE="$(wc -c <"$OUT" | tr -d ' ')"
echo "[${EXPORTED_AT}] [ps-backup] OK: $OUT (${SIZE} bytes)"
