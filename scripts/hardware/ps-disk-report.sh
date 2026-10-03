#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# ps-disk-report.sh — disk usage snapshot (read-only)
# ═══════════════════════════════════════════════════════════════
# Reports filesystem usage + the size of the PatterStage + Hermes data
# directories. Safe: reads only, writes nothing.
#
# Environment (defaults in parentheses):
#   PS_DATA_DIR   ($HOME/control-hub/data)
#   HERMES_HOME   ($HOME/.hermes)

set -euo pipefail

PS_DATA_DIR="${PS_DATA_DIR:-${CH_DATA_DIR:-${CONTROL_HUB_DATA_DIR:-$( [ ! -d "$HOME/patterstage/data" ] && [ -d "$HOME/control-hub/data" ] && echo "$HOME/control-hub/data" || echo "$HOME/patterstage/data" )}}}"
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"

log() { echo "[$(date -Iseconds 2>/dev/null || date)] $*"; }

log "── Disk usage ──"
df -h 2>/dev/null | grep -vE '^(tmpfs|devtmpfs|map |overlay)' || df -h

log "── Largest top-level dirs in \$HOME ──"
du -sh "$HOME"/* 2>/dev/null | sort -rh | head -10 || true

for d in "$PS_DATA_DIR" "$HERMES_HOME"; do
  if [ -d "$d" ]; then
    log "── $d ──"
    du -sh "$d" 2>/dev/null || true
    du -sh "$d"/* 2>/dev/null | sort -rh | head -10 || true
  else
    log "(skip) $d does not exist"
  fi
done

log "disk report complete"
