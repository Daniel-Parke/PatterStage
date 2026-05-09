#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Control Hub — Deploy Script
# ═══════════════════════════════════════════════════════════════
# Safely pulls latest code from main, rebuilds, and restarts.
#
# Usage:
#   bash scripts/update.sh [--restart-only]
#
# This script is designed to be called by the update API endpoint.
# It handles: git pull, npm install, build, and restart.
#
# Safety:
#   - Lock file prevents concurrent deploys
#   - Build failure aborts without restart
#   - Atomic git operations (reset --hard origin/main)
# ═══════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
LOCK_FILE="${TMPDIR:-/tmp}/ch-deploy.lock"
LOG_FILE="$HOME/.hermes/logs/ch-update.log"
CH_BRANCH="${CH_UPDATE_GIT_BRANCH:-dev}"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# ── Lock Guard ────────────────────────────────────────────────
cleanup() {
    rm -f "$LOCK_FILE"
}
trap cleanup EXIT

if [ -f "$LOCK_FILE" ]; then
    LOCK_PID=$(cat "$LOCK_FILE" 2>/dev/null)
    if [ -n "$LOCK_PID" ] && kill -0 "$LOCK_PID" 2>/dev/null; then
        log "ERROR: Deploy already running (PID $LOCK_PID)"
        exit 1
    fi
    log "WARNING: Stale lock file found, removing"
    rm -f "$LOCK_FILE"
fi
echo $$ > "$LOCK_FILE"

# ── Parse Arguments ──────────────────────────────────────────
RESTART_ONLY=false
CH_BRANCH="${CH_UPDATE_GIT_BRANCH:-dev}"
while [ "${1:-}" ]; do
    case "${1}" in
        --restart-only) RESTART_ONLY=true; shift ;;
        --branch)       CH_BRANCH="${2:-}"; shift 2 ;;
        *)              shift ;;
    esac
done

cd "$APP_DIR"

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

if ! git rev-parse --is-inside-work-tree &>/dev/null; then
    log "ERROR: $APP_DIR is not a git repository — cannot update"
    exit 1
fi

# ── Git Update ───────────────────────────────────────────────
if [ "$RESTART_ONLY" = false ]; then
    log "Fetching latest from origin/${CH_BRANCH}..."
    git fetch origin "$CH_BRANCH" --quiet 2>>"$LOG_FILE"

    log "Checking out ${CH_BRANCH} branch..."
    git checkout "$CH_BRANCH" --quiet 2>>"$LOG_FILE"

    log "Resetting to origin/${CH_BRANCH}..."
    git reset --hard "origin/${CH_BRANCH}" --quiet 2>>"$LOG_FILE"

    log "Code updated to $(git rev-parse --short HEAD)"

    # ── Dependencies ───────────────────────────────────────────
    if git diff --name-only HEAD@{1} HEAD 2>/dev/null | grep -q "package-lock.json\|package.json"; then
        log "package.json changed — running npm install..."
        "$NPM_BIN" install --prefer-offline 2>>"$LOG_FILE"
        log "Dependencies installed"
    else
        log "No dependency changes — skipping npm install"
    fi

    # ── Build ──────────────────────────────────────────────────
    log "Building production bundle..."
    if ! "$NPM_BIN" run build >>"$LOG_FILE" 2>&1; then
        log "ERROR: Build failed — aborting deploy"
        exit 1
    fi
    log "Build successful"

    # ── Update Agent Profiles ─────────────────────────────────────
    log "Updating agent profiles..."
    HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
    PROFILE_TEMPLATES="$APP_DIR/scripts/profiles"
    PROFILES=("qa-engineer" "devops-engineer" "swe-engineer" "data-engineer" "data-scientist" "ops-director" "creative-lead" "support-agent")

    for profile in "${PROFILES[@]}"; do
        PROFILE_DIR="$HERMES_HOME/profiles/$profile"
        if [ ! -d "$PROFILE_DIR" ]; then
            log "Creating missing profile: $profile"
            if command -v hermes &>/dev/null; then
                hermes profile create "$profile" --clone --no-alias 2>/dev/null || true
            else
                mkdir -p "$PROFILE_DIR"/{memories,sessions,skills,skins,logs,plans,workspace,cron}
                [ -f "$HERMES_HOME/config.yaml" ] && cp "$HERMES_HOME/config.yaml" "$PROFILE_DIR/config.yaml"
                [ -f "$HERMES_HOME/.env" ] && cp "$HERMES_HOME/.env" "$PROFILE_DIR/.env"
            fi
        fi
        # Update SOUL.md and AGENTS.md from templates (overwrite specialist versions)
        if [ -f "$PROFILE_TEMPLATES/$profile/SOUL.md" ]; then
            cp "$PROFILE_TEMPLATES/$profile/SOUL.md" "$PROFILE_DIR/SOUL.md"
        fi
        if [ -f "$PROFILE_TEMPLATES/$profile/AGENTS.md" ]; then
            cp "$PROFILE_TEMPLATES/$profile/AGENTS.md" "$PROFILE_DIR/AGENTS.md"
        fi
        # Sync auth.json if missing
        if [ ! -f "$PROFILE_DIR/auth.json" ] && [ -f "$HERMES_HOME/auth.json" ]; then
            cp "$HERMES_HOME/auth.json" "$PROFILE_DIR/auth.json"
            chmod 600 "$PROFILE_DIR/auth.json"
        fi
    done
    log "Agent profiles updated"
fi

# ── Ensure Hermes Gateway API Server is enabled ─────────────────
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
if command -v hermes &>/dev/null && [ -f "$HERMES_HOME/.env" ]; then
    if ! grep -q "API_SERVER_ENABLED=true" "$HERMES_HOME/.env" 2>/dev/null; then
        log "Enabling API_SERVER_ENABLED=true in ~/.hermes/.env for Story Weaver..."
        echo "" >> "$HERMES_HOME/.env"
        echo "# Enable API server for Control Hub Rec Room (added by update.sh)" >> "$HERMES_HOME/.env"
        echo "API_SERVER_ENABLED=true" >> "$HERMES_HOME/.env"
    fi
    # Restart gateway so the setting takes effect
    log "Restarting Hermes gateway..."
    if hermes gateway stop 2>/dev/null; then
        hermes gateway start 2>/dev/null || log "WARNING: Gateway start failed — restart manually"
    else
        log "WARNING: Could not stop gateway — restart manually if needed"
    fi
fi

# ── Restart Server ────────────────────────────────────────────
log "Restarting server..."
bash "$SCRIPT_DIR/restart.sh"
log "Update complete"
