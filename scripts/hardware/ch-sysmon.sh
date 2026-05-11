#!/usr/bin/env bash
# ch-sysmon.sh — Control Hub system monitor
# Run by hardware cron: system resource monitoring.

LOG_DIR="${LOG_DIR:-$HOME/.hermes/logs}"
LOG_FILE="${LOG_DIR}/ch-sysmon.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] INFO [ch-sysmon] $*" >> "$LOG_FILE"
}

log "System monitor triggered"
exit 0
