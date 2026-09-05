#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# ps-system-report.sh — host health snapshot (read-only)
# ═══════════════════════════════════════════════════════════════
# OS, uptime, load, memory, and the busiest processes. Cross-platform
# (Linux + macOS). Safe: reads only, writes nothing.

set -euo pipefail

log() { echo "[$(date -Iseconds 2>/dev/null || date)] $*"; }

log "── Host ──"
uname -a 2>/dev/null || true
log "uptime:$(uptime 2>/dev/null || true)"

log "── Memory ──"
if command -v free >/dev/null 2>&1; then
  free -h
elif command -v vm_stat >/dev/null 2>&1; then
  vm_stat | head -8
fi

log "── Top processes (by CPU) ──"
if ps aux >/dev/null 2>&1; then
  # shellcheck disable=SC2009
  ps aux 2>/dev/null | sort -rk3 | head -8
fi

log "── Top processes (by memory) ──"
if ps aux >/dev/null 2>&1; then
  ps aux 2>/dev/null | sort -rk4 | head -8
fi

log "system report complete"
