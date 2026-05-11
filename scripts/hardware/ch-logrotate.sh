#!/usr/bin/env bash
# ch-logrotate.sh — Control Hub log rotation
# Run by hardware cron: rotate old log files.

LOG_DIR="${LOG_DIR:-$HOME/.hermes/logs}"
LOG_FILE="${LOG_DIR}/ch-logrotate.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] INFO [ch-logrotate] $*" >> "$LOG_FILE"
}

log "Log rotation triggered"
exit 0
