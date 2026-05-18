#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Control Hub — deploy implementation (sourced by application/ch-deploy.sh)
#
# Expects exports from ch-deploy.sh:
#   CH_APPLICATION_DIR  scripts/application
#   CH_SCRIPTS_ROOT       scripts/
#   CH_APP_DIR            repository root (Next.js app)
# ═══════════════════════════════════════════════════════════════

ch_deploy_usage() {
  echo "Usage: bash scripts/application/ch-deploy.sh update [--restart-only] [--branch NAME]" >&2
  echo "       bash scripts/application/ch-deploy.sh restart" >&2
  echo "       bash scripts/application/ch-deploy.sh rebuild [--branch NAME]" >&2
}

# shellcheck source=ch-dotenv-local.sh
source "$CH_SCRIPTS_ROOT/lib/ch-dotenv-local.sh"
ch_load_control_hub_env_local "$CH_APP_DIR"

# shellcheck source=ch-port.sh
source "$CH_SCRIPTS_ROOT/lib/ch-port.sh"

# shellcheck source=ch-env.sh
source "$CH_SCRIPTS_ROOT/lib/ch-env.sh"

# Atomic lock using flock (kernel-level, auto-released on process exit).
# No stale locks, no race windows, no cleanup needed — when the process exits,
# the kernel releases the flock and closes the fd automatically.
LOCK_FILE="${TMPDIR:-/tmp}/ch-deploy.lock"
LOG_FILE="$HOME/.hermes/logs/ch-update.log"

mkdir -p "$(dirname "$LOG_FILE")"

ch_deploy_log_update() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Kill every PID ss reports listening on TCP port $1 (multiple socat / fork).
ch_deploy_kill_tcp_listeners_on_port() {
  local port="$1"
  local p
  for p in $(ss -tlnp "sport = :$port" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | sort -u); do
    kill -9 "$p" 2>/dev/null || true
  done
}

ch_deploy_acquire_lock() {
  # Open/create the lock file on fd 200. This fd persists for the lifetime of
  # this shell. When the process exits (normally or via kill -9), the kernel
  # closes all fds and releases the flock. No EXIT trap needed.
  exec 200>"$LOCK_FILE"

  # Try non-blocking exclusive lock. flock -n fails immediately if another
  # process holds the lock. Within the same process, flock on the same fd
  # always succeeds — so re-entrant calls are safe with no special handling.
  if ! flock -n 200; then
    # Another process holds the lock. No PID file to read — flock's holder
    # is tracked by the kernel. fuser can reveal the PID if we need it.
    local LOCK_PID
    LOCK_PID=$(fuser "$LOCK_FILE" 2>/dev/null | head -1 || echo "")
    if [ -n "$LOCK_PID" ]; then
      ch_deploy_log_update "ERROR: Deploy already running (PID $LOCK_PID)"
      exit 1
    fi
    # Process died but fd linger? Kernel should have released. Wait and retry once.
    sleep 1
    if ! flock -n 200; then
      ch_deploy_log_update "ERROR: Could not acquire deploy lock"
      exit 1
    fi
  fi

  # Lock held. No cleanup needed — kernel releases on process exit.
  return 0
}

ch_deploy_cmd_restart() {
  # Guard against concurrent restarts: try a non-blocking flock probe.
  # If the lock is held by another process, a restart is already in progress.
  # Exit cleanly — a second restart would kill the server the first just started.
  exec 201>"$LOCK_FILE"
  if ! flock -n 201; then
    ch_deploy_log_update "Restart already in progress — exiting cleanly"
    exec 201>&-
    exit 0
  fi
  # Release probe — the actual lock is acquired inside ch_deploy_restart_once
  flock -u 201
  exec 201>&-

  # Lock is acquired inside ch_deploy_restart_once so the lock covers the
  # entire restart operation (including the wait-for-ready loop), not just
  # the spawn of the detached subprocess.
  ch_deploy_restart_once
}

# One-shot restart: kill zombies, restart next-server, optional socat relay, exit.
# Lock is held for the entire operation (not just the spawn) so concurrent restarts
# cannot interfere with each other's server lifecycle.
ch_deploy_restart_once() {
  ch_deploy_acquire_lock
  cd "$CH_APP_DIR"

  local LOG_FILE_RESTART="$HOME/.hermes/logs/ch-restart.log"
  local PID_FILE="$HOME/.hermes/logs/ch-server.pid"
  local SOCAT_PID_FILE="$HOME/.hermes/logs/ch-socat.pid"

  mkdir -p "$(dirname "$LOG_FILE_RESTART")"

  log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE_RESTART"
  }

  cd "$CH_APP_DIR"

  local NODE_BIN
  NODE_BIN="$(which node 2>/dev/null || echo "$HOME/.local/bin/node")"
  local NPM_BIN
  NPM_BIN="$(which npm 2>/dev/null || echo "$HOME/.local/bin/npm")"
  export PATH="$(dirname "$NODE_BIN"):$(dirname "$NPM_BIN"):$PATH"

  # ── 1. Kill zombie on port 3000 ───────────────────────────────────────────
  local ZOMBIE_PIDS
  ZOMBIE_PIDS=$(ss -tlnp sport = :3000 2>/dev/null | grep -oP 'pid=\K[0-9]+' || true)
  if [ -n "$ZOMBIE_PIDS" ]; then
    for zp in $ZOMBIE_PIDS; do
      if kill -0 "$zp" 2>/dev/null; then
        log "Killing stale next-server on port 3000 (PID $zp)..."
        kill -9 "$zp" 2>/dev/null || true
      fi
    done
    sleep 1
  fi

  # ── 2. Stop any existing socat relay ───────────────────────────────────────
  local OLD_SOCAT_PID
  OLD_SOCAT_PID=$(cat "$SOCAT_PID_FILE" 2>/dev/null || true)
  if [ -n "$OLD_SOCAT_PID" ] && kill -0 "$OLD_SOCAT_PID" 2>/dev/null; then
    log "Stopping old socat relay (PID $OLD_SOCAT_PID)..."
    kill -9 "$OLD_SOCAT_PID" 2>/dev/null || true
    sleep 1
  fi
  local RELAY_PORT="${CH_SOCAT_RELAY_PORT:-42069}"
  log "Stopping all listeners on relay port ${RELAY_PORT}..."
  ch_deploy_kill_tcp_listeners_on_port "$RELAY_PORT"
  sleep 1

  # ── 3. Find available port ─────────────────────────────────────────────────
  # Always prefer 42069 — kill whatever is on it first (stale socat orphans from
  # failed restarts must not block us, and we must not trust a stale PORT= in
  # .env.local that was written by a previous failed attempt).
  local PORT="42069"
  while ch_tcp_port_in_use "$PORT" 2>/dev/null; do
    local BLOCKER_PIDS
    BLOCKER_PIDS=$(ss -tlnp "sport = :$PORT" 2>/dev/null | grep -oP 'pid=\K[0-9]+' || true)
    if [ -n "$BLOCKER_PIDS" ]; then
      for p in $BLOCKER_PIDS; do
        if kill -0 "$p" 2>/dev/null; then
          log "Port $PORT held by PID $p — killing..."
          kill -9 "$p" 2>/dev/null || true
        fi
      done
      sleep 2
    fi
    # After killing, re-check — if still in use, walk forward
    if ch_tcp_port_in_use "$PORT" 2>/dev/null; then
      log "Port $PORT still in use — trying next port..."
      PORT=$((PORT + 1))
      if [ "$PORT" -gt 42100 ]; then
        log "ERROR: No free port in 42069–42100"
        exit 1
      fi
    fi
  done
  [ "$PORT" != "42069" ] && log "Port 42069 unavailable — using $PORT"

  # ── 4. Write port to .env.local ───────────────────────────────────────────
  if [ -f "$CH_APP_DIR/.env.local" ]; then
    if grep -q '^PORT=' "$CH_APP_DIR/.env.local" 2>/dev/null; then
      sed -i "s/^PORT=.*/PORT=$PORT/" "$CH_APP_DIR/.env.local"
    else
      echo "PORT=$PORT" >>"$CH_APP_DIR/.env.local"
    fi
  fi

  # ── 5. Kill any existing next-server on this port ──────────────────────────
  # (socat is stopped above — next-server and socat share the port so we kill
  # next-server first, then the port is free for the new server to bind)
  if [ -f "$PID_FILE" ]; then
    local OLD_SERVER_PID
    OLD_SERVER_PID=$(cat "$PID_FILE" 2>/dev/null || true)
    if [ -n "$OLD_SERVER_PID" ] && kill -0 "$OLD_SERVER_PID" 2>/dev/null; then
      log "Stopping old next-server (PID $OLD_SERVER_PID)..."
      kill -9 "$OLD_SERVER_PID" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
    sleep 1
  fi

  # ── 6. Start next-server ─────────────────────────────────────────────────────
  # Match `npm run start:network` (0.0.0.0) when no relay. With relay, Next stays on
  # loopback so socat owns CH_SOCAT_RELAY_PORT (default 42069) on all interfaces (0.0.0.0)
  # unless CH_SOCAT_BIND overrides the listen address.
  local use_relay=0
  local relay_listen
  case "${CH_SOCAT_RELAY:-}" in 1 | yes | YES | true | True) use_relay=1 ;; esac
  if [ -n "${CH_SOCAT_BIND:-}" ]; then
    use_relay=1
  fi
  local HOST
  if [ "$use_relay" -eq 1 ]; then
    HOST="${CH_NEXT_BIND_HOST:-127.0.0.1}"
    relay_listen="${CH_SOCAT_BIND:-0.0.0.0}"
  else
    HOST="${CH_NEXT_BIND_HOST:-0.0.0.0}"
  fi
  export CH_ENABLE_DEPLOY_API="${CH_ENABLE_DEPLOY_API:-true}"

  log "Starting next-server on $HOST:$PORT..."
  rm -f "$PID_FILE"
  # Release the deploy lock BEFORE spawning nohup child — otherwise the child
  # inherits fd 200 (the flock file) and the kernel never releases the lock.
  exec 200>&-
  # nohup + detached stdin: survive dashboard-spawned systemd-run/nohup transient shells exiting.
  nohup "$NODE_BIN" node_modules/next/dist/bin/next start -p "$PORT" -H "$HOST" \
    >>"$LOG_FILE_RESTART" 2>&1 </dev/null &
  local SERVER_PID=$!
  echo "$SERVER_PID" >"$PID_FILE"
  log "Server started (PID $SERVER_PID)"

  local i
  for i in $(seq 1 20); do
    if curl -s -o /dev/null -w '' "http://127.0.0.1:${PORT}" 2>/dev/null; then
      log "Server is ready on http://127.0.0.1:${PORT}"
      break
    fi
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
      log "ERROR: next-server died during startup"
      exit 1
    fi
    sleep 1
  done

  # ── 7. Optional socat relay (CH_SOCAT_RELAY_PORT → loopback:$PORT) ──────────
  if [ "$use_relay" -eq 1 ]; then
    log "Starting socat relay on ${relay_listen}:${RELAY_PORT} → 127.0.0.1:$PORT..."
    nohup /usr/bin/socat TCP-LISTEN:"$RELAY_PORT",fork,reuseaddr,bind="${relay_listen}" TCP:127.0.0.1:"$PORT" \
      >>"$LOG_FILE_RESTART" 2>&1 </dev/null &
    local SOCAT_PID=$!
    echo "$SOCAT_PID" >"$SOCAT_PID_FILE"
    log "socat relay started (PID $SOCAT_PID)"

    sleep 1
    if ss -tlnp "sport = :$RELAY_PORT" 2>/dev/null | grep -q LISTEN; then
      log "Relay active: ${relay_listen}:${RELAY_PORT} → 127.0.0.1:$PORT"
    else
      log "WARNING: socat relay may not have started correctly"
    fi
  else
    rm -f "$SOCAT_PID_FILE"
    log "Skipping socat (set CH_SOCAT_RELAY=yes for relay on CH_SOCAT_RELAY_PORT, or CH_SOCAT_BIND=ip for legacy)"
  fi

  log "Restart complete."

  # Wait for children to fully daemonize before we exit.
  # This prevents systemd transient units from seeing exit-code 1 when the
  # shell exits while backgrounded children are still forking.
  sleep 2

  # Signal success explicitly — we don't want any trailing subshell result
  # (e.g. from `|| true` or the log function) leaking into the exit code.
  exit 0
}

ch_deploy_cmd_rebuild() {
  # Guard against concurrent rebuilds: try a non-blocking flock probe.
  # If the lock is held by another process, a rebuild is already in progress.
  exec 201>"$LOCK_FILE"
  if ! flock -n 201; then
    ch_deploy_log_update "Rebuild already in progress — exiting cleanly"
    exec 201>&-
    exit 0
  fi
  # Release probe — the actual lock is acquired inside ch_deploy_restart_once
  # at the end of the rebuild flow.
  flock -u 201
  exec 201>&-

  ch_deploy_cmd_rebuild_impl
}

ch_deploy_cmd_rebuild_impl() {
  local CH_BRANCH="${CH_DEPLOY_BRANCH:-${CH_UPDATE_GIT_BRANCH:-dev}}"
  local APP_DIR="$CH_APP_DIR"
  local LOG_FILE_RESTART="$HOME/.hermes/logs/ch-restart.log"
  local BUILD_LOG="$HOME/.hermes/logs/ch-build.log"

  mkdir -p "$(dirname "$LOG_FILE_RESTART")"

  log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE_RESTART"
  }

  cd "$APP_DIR"

  if [ -n "$CH_BRANCH" ]; then
    log "Checking out branch: $CH_BRANCH"
    git checkout "$CH_BRANCH" --quiet 2>>"$LOG_FILE_RESTART" || {
      log "ERROR: Branch '$CH_BRANCH' not found locally"
      exit 1
    }
  fi

  local NODE_BIN
  NODE_BIN="$(which node 2>/dev/null || echo "$HOME/.local/bin/node")"
  local NPM_BIN
  NPM_BIN="$(which npm 2>/dev/null || echo "$HOME/.local/bin/npm")"

  if [ ! -x "$NPM_BIN" ]; then
    log "ERROR: npm not found at $NPM_BIN — cannot build"
    exit 1
  fi

  export PATH="$(dirname "$NODE_BIN"):$(dirname "$NPM_BIN"):$PATH"

  log "Build started (npm=$(which npm), node=$(which node))..."
  "$NPM_BIN" run build >>"$BUILD_LOG" 2>&1
  if [ $? -ne 0 ]; then
    log "ERROR: Build failed — check $BUILD_LOG"
    exit 1
  fi
  log "Build complete."
  log "Restarting server..."
  ch_deploy_restart_once
  # ch_deploy_restart_once exits; if we reach here something went wrong
  log "ERROR: restart returned unexpectedly"
  exit 1
}

ch_deploy_run_update() {
  local RESTART_ONLY="${CH_DEPLOY_RESTART_ONLY:-false}"
  local CH_BRANCH="${CH_DEPLOY_BRANCH:-${CH_UPDATE_GIT_BRANCH:-dev}}"
  local APP_DIR="$CH_APP_DIR"
  local SCRIPT_DIR="$CH_SCRIPTS_ROOT"

  ch_deploy_acquire_lock

  cd "$APP_DIR"

  local NODE_BIN
  NODE_BIN="$(which node 2>/dev/null || echo "$HOME/.local/bin/node")"
  local NPM_BIN
  NPM_BIN="$(which npm 2>/dev/null || echo "$HOME/.local/bin/npm")"

  if [ ! -x "$NPM_BIN" ]; then
    ch_deploy_log_update "ERROR: npm not found at $NPM_BIN — cannot build"
    exit 1
  fi

  export PATH="$(dirname "$NODE_BIN"):$(dirname "$NPM_BIN"):$PATH"

  if ! git rev-parse --is-inside-work-tree &>/dev/null; then
    ch_deploy_log_update "ERROR: $APP_DIR is not a git repository — cannot update"
    exit 1
  fi

  if [ "$RESTART_ONLY" = false ]; then
    ch_deploy_log_update "Fetching latest from origin/${CH_BRANCH}..."
    git fetch origin "$CH_BRANCH" --quiet 2>>"$LOG_FILE"

    ch_deploy_log_update "Checking out ${CH_BRANCH} branch..."
    git checkout "$CH_BRANCH" --quiet 2>>"$LOG_FILE"

    ch_deploy_log_update "Resetting to origin/${CH_BRANCH}..."
    git reset --hard "origin/${CH_BRANCH}" --quiet 2>>"$LOG_FILE"

    ch_deploy_log_update "Code updated to $(git rev-parse --short HEAD)"

    if git diff --name-only HEAD@{1} HEAD 2>/dev/null | grep -q "package-lock.json\|package.json"; then
      ch_deploy_log_update "package.json changed — running npm install..."
      "$NPM_BIN" install --prefer-offline 2>>"$LOG_FILE"
      ch_deploy_log_update "Dependencies installed"
    else
      ch_deploy_log_update "No dependency changes — skipping npm install"
    fi

    ch_deploy_log_update "Building production bundle..."
    if ! "$NPM_BIN" run build >>"$LOG_FILE" 2>&1; then
      ch_deploy_log_update "ERROR: Build failed — aborting deploy"
      exit 1
    fi
    ch_deploy_log_update "Build successful"

    # shellcheck source=ch-hermes-profile-templates.sh
    source "$SCRIPT_DIR/lib/ch-hermes-profile-templates.sh"

    local sync_profiles=false
    case "${CH_UPDATE_SYNC_HERMES_PROFILE_TEMPLATES:-}" in
      no | NO | 0 | false | False)
        ch_deploy_log_update "Skipping Hermes bundled profile sync (CH_UPDATE_SYNC_HERMES_PROFILE_TEMPLATES=no)"
        ;;
      yes | YES | 1 | true | True)
        sync_profiles=true
        ;;
      *)
        if [ -t 0 ]; then
          echo ""
          echo "Control Hub update: refresh bundled Hermes profiles?" >&2
          echo "" >&2
          echo "  This replaces SOUL.md and AGENTS.md only for Control Hub's bundled profiles" >&2
          echo "  (e.g. qa-engineer, devops-engineer, swe-engineer, and related defaults)." >&2
          echo "  Any other profiles you created yourself are not touched." >&2
          echo "" >&2
          echo "  If you edited those bundled files, save or commit your changes first — they will be overwritten." >&2
          echo "" >&2
          read -r -p "Sync bundled profile templates now? [y/N]: " REPLY_SYNC_PROFILES
          echo ""
          if [[ "$REPLY_SYNC_PROFILES" =~ ^[Yy]$ ]]; then
            sync_profiles=true
          else
            ch_deploy_log_update "Skipping Hermes bundled profile sync (declined at prompt)"
          fi
        else
          sync_profiles=true
        fi
        ;;
    esac

    if [ "$sync_profiles" = true ]; then
      ch_profiles_log() { ch_deploy_log_update "$*"; }
      ch_deploy_log_update "Updating bundled Hermes agent profiles from templates..."
      ch_bundled_profiles_sync "$APP_DIR"
      ch_deploy_log_update "Bundled Hermes agent profiles updated"
    fi
  fi

  local HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
  if command -v hermes &>/dev/null && [ -f "$HERMES_HOME/.env" ]; then
    if ! grep -q "API_SERVER_ENABLED=true" "$HERMES_HOME/.env" 2>/dev/null; then
      ch_deploy_log_update "Enabling API_SERVER_ENABLED=true in ~/.hermes/.env for Story Weaver..."
      echo "" >>"$HERMES_HOME/.env"
      echo "# Enable API server for Control Hub Rec Room (added by ch-deploy)" >>"$HERMES_HOME/.env"
      echo "API_SERVER_ENABLED=true" >>"$HERMES_HOME/.env"
    fi
    ch_deploy_log_update "Restarting Hermes gateway..."
    if hermes gateway stop 2>/dev/null; then
      hermes gateway start 2>/dev/null || ch_deploy_log_update "WARNING: Gateway start failed — restart manually"
    else
      ch_deploy_log_update "WARNING: Could not stop gateway — restart manually if needed"
    fi
  fi

  local CH_DATA_ROOT="${CH_DATA_DIR:-$HOME/control-hub/data}"
  mkdir -p "$CH_DATA_ROOT/scripts" "$CH_DATA_ROOT/logs"
  if command -v node &>/dev/null; then
    CH_DATA_DIR="$CH_DATA_ROOT" node "$CH_SCRIPTS_ROOT/tooling/discover-agents.mjs" >>"$LOG_FILE" 2>&1 ||
      ch_deploy_log_update "WARNING: discover-agents.mjs failed"
  fi

  ch_deploy_log_update "Restarting server..."
  ch_deploy_restart_once
  ch_deploy_log_update "Update complete"
}

ch_deploy_dispatch_update() {
  CH_DEPLOY_RESTART_ONLY=false
  CH_DEPLOY_BRANCH="${CH_UPDATE_GIT_BRANCH:-dev}"
  while [ "${1:-}" ]; do
    case "${1}" in
      --restart-only) CH_DEPLOY_RESTART_ONLY=true ; shift ;;
      --branch)
        CH_DEPLOY_BRANCH="${2:-}"
        shift 2
        ;;
      *) shift ;;
    esac
  done
  ch_deploy_run_update
}

ch_deploy_dispatch_rebuild() {
  CH_DEPLOY_BRANCH="${CH_UPDATE_GIT_BRANCH:-dev}"
  while [ "${1:-}" ]; do
    case "${1}" in
      --branch)
        CH_DEPLOY_BRANCH="${2:-}"
        shift 2
        ;;
      *) shift ;;
    esac
  done
  ch_deploy_cmd_rebuild
}

ch_deploy_main() {
  local sub="${1:-}"
  shift || true
  case "$sub" in
    update) ch_deploy_dispatch_update "$@" ;;
    restart) ch_deploy_cmd_restart ;;
    rebuild) ch_deploy_dispatch_rebuild "$@" ;;
    "" | -h | --help)
      ch_deploy_usage
      exit 1
      ;;
    *)
      echo "Unknown subcommand: $sub" >&2
      ch_deploy_usage
      exit 1
      ;;
  esac
}
