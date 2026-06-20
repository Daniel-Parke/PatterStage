#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# ps-log-rotate.sh — gzip + prune PatterStage hardware-script logs
# ═══════════════════════════════════════════════════════════════
# Compresses *.log files older than 1 day in the hardware log dir and
# deletes compressed logs older than the retention window. Safe: only
# touches *.log / *.log.gz under the configured log directory.
#
# Environment (defaults in parentheses):
#   PS_DATA_DIR             ($HOME/control-hub/data)
#   PS_HARDWARE_LOG_DIR     ($PS_DATA_DIR/logs)
#   PS_LOG_RETENTION_DAYS   (30)

set -euo pipefail

PS_DATA_DIR="${PS_DATA_DIR:-${CH_DATA_DIR:-${CONTROL_HUB_DATA_DIR:-$( [ ! -d "$HOME/patterstage/data" ] && [ -d "$HOME/control-hub/data" ] && echo "$HOME/control-hub/data" || echo "$HOME/patterstage/data" )}}}"
LOG_DIR="${PS_HARDWARE_LOG_DIR:-$PS_DATA_DIR/logs}"
RETENTION="${PS_LOG_RETENTION_DAYS:-30}"

log() { echo "[$(date -Iseconds 2>/dev/null || date)] [ps-log-rotate] $*"; }

if [ ! -d "$LOG_DIR" ]; then
  log "(skip) log dir does not exist: $LOG_DIR"
  exit 0
fi

gz=0
# Compress logs not modified in the last day.
while IFS= read -r f; do
  [ -f "$f" ] || continue
  gzip -f "$f" && gz=$((gz + 1)) && log "compressed $(basename "$f")"
done < <(find "$LOG_DIR" -maxdepth 1 -type f -name '*.log' -mtime +1 2>/dev/null)

pruned=0
# Delete compressed logs older than the retention window.
while IFS= read -r f; do
  [ -f "$f" ] || continue
  rm -f "$f" && pruned=$((pruned + 1)) && log "pruned $(basename "$f")"
done < <(find "$LOG_DIR" -maxdepth 1 -type f -name '*.log.gz' -mtime +"$RETENTION" 2>/dev/null)

log "rotate complete (compressed=$gz pruned=$pruned, retention=${RETENTION}d)"
