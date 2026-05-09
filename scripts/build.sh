#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Control Hub — Build Script
# ═══════════════════════════════════════════════════════════════
# Runs npm build in the background then calls restart.sh.
# This separates the build's memory pressure from the server
# process that spawned it (avoids OOM kills).
#
# Usage:
#   bash scripts/build.sh
#
# Called by:
#   - POST /api/update { action: "rebuild" }
#
# NOTE: Uses plain & NOT nohup — nohup causes agent terminal freeze.
# ═══════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$HOME/.hermes/logs/ch-restart.log"
BUILD_LOG="$HOME/.hermes/logs/ch-build.log"

mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# ── Parse Arguments ──────────────────────────────────────────
CH_BRANCH="${CH_UPDATE_GIT_BRANCH:-dev}"
while [ "${1:-}" ]; do
    case "${1}" in
        --branch) CH_BRANCH="${2:-}"; shift 2 ;;
        *)        shift ;;
    esac
done

cd "$APP_DIR"

# Checkout the target branch if specified
if [ -n "$CH_BRANCH" ]; then
    log "Checking out branch: $CH_BRANCH"
    git fetch origin "$CH_BRANCH" --quiet 2>>"$LOG_FILE" || true
    git checkout "$CH_BRANCH" --quiet 2>>"$LOG_FILE" || true
fi

# Resolve full paths using which (more reliable than command -v)
NODE_BIN="$(which node 2>/dev/null || echo "$HOME/.local/bin/node")"
NPM_BIN="$(which npm 2>/dev/null || echo "$HOME/.local/bin/npm")"

# Verify binaries exist before proceeding
if [ ! -x "$NPM_BIN" ]; then
    log "ERROR: npm not found at $NPM_BIN — cannot build"
    exit 1
fi

# Add node/npm bin directories to PATH
export PATH="$(dirname "$NODE_BIN"):$(dirname "$NPM_BIN"):$PATH"

log "Build started (npm=$(which npm), node=$(which node))..."
"$NPM_BIN" run build >> "$BUILD_LOG" 2>&1
log "Build complete."
log "Restarting server..."
bash "$SCRIPT_DIR/restart.sh"
