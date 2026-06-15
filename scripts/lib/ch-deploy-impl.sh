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

# shellcheck source=ch-deploy-status.sh
source "$CH_SCRIPTS_ROOT/lib/ch-deploy-status.sh"

# shellcheck source=ch-log.sh
source "$CH_SCRIPTS_ROOT/lib/ch-log.sh"

# shellcheck source=ch-migrate.sh
source "$CH_SCRIPTS_ROOT/lib/ch-migrate.sh"

LOCK_FILE="${TMPDIR:-/tmp}/ch-deploy.lock"
LOG_FILE="$HOME/.hermes/logs/ch-update.log"
CH_RESTART_LOG="$HOME/.hermes/logs/ch-restart.log"
CH_BUILD_LOG="$HOME/.hermes/logs/ch-build.log"
# Dedicated server stdout log — separate from ch-restart.log so the
# runtime output of next-server is preserved across deploys. The
# /api/logs UI should also include this file once the Logs page is
# updated to discover it.
CH_RUNTIME_LOG="${CH_RUNTIME_LOG:-$HOME/.hermes/logs/ch-runtime.log}"

mkdir -p "$(dirname "$LOG_FILE")"

ch_deploy_log_update() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

ch_deploy_log_restart() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$CH_RESTART_LOG"
}

ch_deploy_log_both() {
  ch_deploy_log_update "$@"
  ch_deploy_log_restart "$@"
}

ch_deploy_acquire_lock() {
  if command -v flock &>/dev/null; then
    exec 200>"$LOCK_FILE"
    if ! flock -n 200; then
      ch_deploy_log_both "ERROR: Deploy already running (lock held)"
      return 1
    fi
    CH_DEPLOY_LOCK_MODE=flock
    return 0
  fi
  local lock_dir="${LOCK_FILE}.d"
  if ! mkdir "$lock_dir" 2>/dev/null; then
    ch_deploy_log_both "ERROR: Deploy already running (lock held)"
    return 1
  fi
  CH_DEPLOY_LOCK_MODE=mkdir
  CH_DEPLOY_LOCK_DIR="$lock_dir"
  return 0
}

ch_deploy_release_lock() {
  if [ "${CH_DEPLOY_LOCK_MODE:-}" = "flock" ]; then
    flock -u 200 2>/dev/null || true
    exec 200>&- 2>/dev/null || true
  elif [ -n "${CH_DEPLOY_LOCK_DIR:-}" ]; then
    rmdir "${CH_DEPLOY_LOCK_DIR}" 2>/dev/null || true
    unset CH_DEPLOY_LOCK_DIR
  fi
  unset CH_DEPLOY_LOCK_MODE
}

ch_deploy_fail() {
  local action="$1"
  local phase="$2"
  local message="$3"
  local exit_code="${4:-1}"
  local log_hint="${5:-ch-restart.log}"
  ch_deploy_status_write "failed" "$action" "$phase" "$message" "$exit_code" "$log_hint"
  ch_deploy_log_both "ERROR: $message"
  ch_deploy_release_lock
  exit "$exit_code"
}

ch_deploy_resolve_tooling() {
  NODE_BIN="$(which node 2>/dev/null || echo "$HOME/.local/bin/node")"
  NPM_BIN="$(which npm 2>/dev/null || echo "$HOME/.local/bin/npm")"
  if [ ! -x "$NPM_BIN" ]; then
    return 1
  fi
  export PATH="$(dirname "$NODE_BIN"):$(dirname "$NPM_BIN"):$PATH"
  return 0
}

ch_deploy_npm_install_if_needed() {
  local action="$1"
  local lock="$CH_APP_DIR/package-lock.json"
  local marker="$CH_APP_DIR/.next/BUILD_ID"
  local need=0

  if [ -f "$lock" ]; then
    if [ ! -f "$marker" ] || [ "$lock" -nt "$marker" ]; then
      need=1
    fi
  fi

  if [ "$need" -eq 0 ]; then
    return 0
  fi

  ch_deploy_status_write "running" "$action" "install" "Installing dependencies…" "" ""
  ch_deploy_log_restart "package-lock.json newer than build — running npm install…"
  if ! "$NPM_BIN" install --prefer-offline >>"$CH_BUILD_LOG" 2>&1; then
    ch_deploy_fail "$action" "install" "npm install failed — see ch-build.log" 1 "ch-build.log"
  fi
  ch_deploy_log_restart "Dependencies installed"
}

ch_deploy_run_build() {
  local action="$1"
  ch_deploy_status_write "running" "$action" "build" "Building production bundle…" "" "ch-build.log"
  ch_deploy_log_restart "Build started (npm=$(which npm), node=$(which node))…"
  if ! "$NPM_BIN" run build >>"$CH_BUILD_LOG" 2>&1; then
    ch_deploy_fail "$action" "build" "Build failed — see ch-build.log" 1 "ch-build.log"
  fi
  ch_deploy_log_restart "Build complete."
}

# Restart next-server. Caller must hold deploy lock; lock is released before server spawn.
ch_deploy_do_restart_body() {
  cd "$CH_APP_DIR"

  local PID_FILE="$HOME/.hermes/logs/ch-server.pid"
  local SOCAT_PID_FILE="$HOME/.hermes/logs/ch-socat.pid"
  local ENV_FILE="$CH_APP_DIR/.env.local"

  ch_deploy_log_restart "Restarting server…"

  local use_relay=0
  local relay_listen
  case "${CH_SOCAT_RELAY:-}" in 1 | yes | YES | true | True) use_relay=1 ;; esac
  if [ -n "${CH_SOCAT_BIND:-}" ]; then
    use_relay=1
  fi

  local deploy_port="${PORT:-}"
  if [ -z "$deploy_port" ] && [ -f "$ENV_FILE" ]; then
    deploy_port="$(ch_env_read_port "$ENV_FILE" 2>/dev/null || true)"
  fi
  if [ -z "$deploy_port" ]; then
    deploy_port="$(ch_auto_pick_port 2>/dev/null || true)"
  fi
  if [ -z "$deploy_port" ]; then
    deploy_port="42069"
  fi
  if ! ch_validate_port_number "$deploy_port"; then
    ch_deploy_log_restart "ERROR: Invalid PORT in .env.local: $deploy_port"
    return 1
  fi

  ch_deploy_log_restart "Stopping listeners on configured port $deploy_port…"
  ch_kill_tcp_listeners_on_port "$deploy_port"

  if [ -f "$PID_FILE" ]; then
    local OLD_SERVER_PID
    OLD_SERVER_PID=$(cat "$PID_FILE" 2>/dev/null || true)
    if [ -n "$OLD_SERVER_PID" ] && kill -0 "$OLD_SERVER_PID" 2>/dev/null; then
      ch_deploy_log_restart "Stopping old next-server (PID $OLD_SERVER_PID)…"
      kill -9 "$OLD_SERVER_PID" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
    sleep 1
  fi

  if [ "$use_relay" -eq 1 ]; then
    local RELAY_PORT="${CH_SOCAT_RELAY_PORT:-42069}"
    local OLD_SOCAT_PID
    OLD_SOCAT_PID=$(cat "$SOCAT_PID_FILE" 2>/dev/null || true)
    if [ -n "$OLD_SOCAT_PID" ] && kill -0 "$OLD_SOCAT_PID" 2>/dev/null; then
      ch_deploy_log_restart "Stopping old socat relay (PID $OLD_SOCAT_PID)…"
      kill -9 "$OLD_SOCAT_PID" 2>/dev/null || true
      sleep 1
    fi
    ch_deploy_log_restart "Stopping listeners on relay port ${RELAY_PORT}…"
    ch_kill_tcp_listeners_on_port "$RELAY_PORT"
    sleep 1
  else
    rm -f "$SOCAT_PID_FILE"
  fi

  if ch_tcp_port_in_use "$deploy_port" 2>/dev/null; then
    ch_deploy_log_restart "Port $deploy_port still in use after stop — killing blockers…"
    ch_kill_tcp_listeners_on_port "$deploy_port"
    sleep 2
    if ch_tcp_port_in_use "$deploy_port" 2>/dev/null; then
      local fallback
      fallback="$(ch_auto_pick_port 2>/dev/null || true)"
      if [ -n "$fallback" ] && [ "$fallback" != "$deploy_port" ]; then
        ch_deploy_log_restart "Port $deploy_port unavailable — using $fallback (updating .env.local)"
        deploy_port="$fallback"
        ch_env_set "$ENV_FILE" "PORT" "$deploy_port"
      else
        ch_deploy_log_restart "ERROR: Port $deploy_port still in use and no free port in 42069–42100"
        return 1
      fi
    fi
  fi
  local HOST
  if [ "$use_relay" -eq 1 ]; then
    HOST="${CH_NEXT_BIND_HOST:-127.0.0.1}"
    relay_listen="${CH_SOCAT_BIND:-0.0.0.0}"
  else
    HOST="${CH_NEXT_BIND_HOST:-0.0.0.0}"
  fi
  export CH_ENABLE_DEPLOY_API="${CH_ENABLE_DEPLOY_API:-true}"

  if [ ! -f "node_modules/next/dist/bin/next" ]; then
    ch_deploy_log_restart "next binary not found at node_modules/next/dist/bin/next — running install to restore dependencies…"
    if ! "$NPM_BIN" install --prefer-offline >>"$CH_RESTART_LOG" 2>&1; then
      ch_deploy_log_restart "ERROR: npm install failed — cannot start server"
      return 1
    fi
    ch_deploy_log_restart "Dependencies restored via npm install"
  fi

  ch_deploy_log_restart "Starting next-server on $HOST:$deploy_port…"
  rm -f "$PID_FILE"
  ch_deploy_release_lock
  # CRITICAL: close fd 200 (deploy lock) BEFORE backgrounding next-server.
  # `nohup ... &` inherits all open file descriptors into the child. If fd 200
  # stays open in the backgrounded next-server, the kernel refuses to release
  # the flock when the deploy script exits, permanently wedging the deploy
  # lock and locking out all future deploy attempts. See "CRITICAL PITFALL:
  # nohup inherits the lock fd" in skills/devops/control-hub-scripts (2026-05-18).
  exec 200>&- 2>/dev/null || true
  # Truncate the runtime log on each fresh start so old output doesn't
  # bleed into a new run. The previous run's log is preserved if the
  # user wants it (rotated by the watchdog or backup tooling).
  : > "$CH_RUNTIME_LOG"
  nohup "$NODE_BIN" node_modules/next/dist/bin/next start -p "$deploy_port" -H "$HOST" \
    >>"$CH_RUNTIME_LOG" 2>&1 </dev/null &
  local SERVER_PID=$!
  echo "$SERVER_PID" >"$PID_FILE"
  ch_deploy_log_restart "Server started (PID $SERVER_PID) — stdout -> $CH_RUNTIME_LOG"

  # Readiness check: probe /api/status with a real HTTP GET, not just
  # TCP connect. The previous curl `/` check passed even when the
  # event loop was blocked (TCP accept succeeds in the kernel). See
  # 2026-06-01 outage for the diagnostic.
  local i ready=0 status_code
  for i in $(seq 1 20); do
    status_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 --max-time 5 "http://127.0.0.1:${deploy_port}/api/status" 2>/dev/null || echo "000")
    if [ "$status_code" = "200" ]; then
      ch_deploy_log_restart "Server is ready on http://127.0.0.1:${deploy_port} (HTTP $status_code)"
      ready=1
      break
    fi
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
      ch_deploy_log_restart "ERROR: next-server died during startup — see $CH_RUNTIME_LOG"
      return 1
    fi
    sleep 1
  done

  if [ "$ready" -ne 1 ]; then
    ch_deploy_log_restart "ERROR: Server did not respond at /api/status within 20s — see $CH_RUNTIME_LOG"
    return 1
  fi

  if [ "$use_relay" -eq 1 ]; then
    ch_deploy_log_restart "Starting socat relay on ${relay_listen}:${RELAY_PORT} → 127.0.0.1:$deploy_port…"
    # Close any remaining deploy lock fd in the backgrounded socat child too.
    # (The ch_deploy_release_lock above already released the flock; this just
    # ensures socat doesn't keep fd 200 open either, in case the order ever
    # changes.)
    exec 200>&- 2>/dev/null || true
    nohup /usr/bin/socat TCP-LISTEN:"$RELAY_PORT",fork,reuseaddr,bind="${relay_listen}" TCP:127.0.0.1:"$deploy_port" \
      >>"$CH_RESTART_LOG" 2>&1 </dev/null &
    local SOCAT_PID=$!
    echo "$SOCAT_PID" >"$SOCAT_PID_FILE"
    ch_deploy_log_restart "socat relay started (PID $SOCAT_PID)"
    sleep 1
    if ss -tlnp "sport = :$RELAY_PORT" 2>/dev/null | grep -q LISTEN; then
      ch_deploy_log_restart "Relay active: ${relay_listen}:${RELAY_PORT} → 127.0.0.1:$deploy_port"
    else
      ch_deploy_log_restart "WARNING: socat relay may not have started correctly"
    fi
  else
    rm -f "$SOCAT_PID_FILE"
  fi

  ch_deploy_log_restart "Restart complete."
  sleep 2
  return 0
}

ch_deploy_cmd_restart() {
  if ! ch_deploy_acquire_lock; then
    ch_deploy_fail "restart" "lock" "Deploy already in progress" 1 "ch-restart.log"
  fi
  ch_deploy_status_write "running" "restart" "restart" "Restarting server…" "" "ch-restart.log"
  if ! ch_deploy_resolve_tooling; then
    ch_deploy_fail "restart" "restart" "npm not found — cannot restart" 1 "ch-restart.log"
  fi
  if ! ch_deploy_do_restart_body; then
    ch_deploy_fail "restart" "restart" "Restart failed — see ch-restart.log" 1 "ch-restart.log"
  fi
  ch_deploy_status_write "success" "restart" "done" "Restart complete" 0 "ch-restart.log"
  exit 0
}

ch_deploy_cmd_rebuild() {
  local CH_BRANCH="${CH_DEPLOY_BRANCH:-}"

  if ! ch_deploy_acquire_lock; then
    ch_deploy_fail "rebuild" "lock" "Deploy already in progress" 1 "ch-restart.log"
  fi

  ch_deploy_status_write "running" "rebuild" "build" "Rebuild started…" "" "ch-build.log"
  cd "$CH_APP_DIR"

  if ! ch_deploy_resolve_tooling; then
    ch_deploy_fail "rebuild" "build" "npm not found — cannot build" 1 "ch-build.log"
  fi

  if [ -n "$CH_BRANCH" ]; then
    local current_branch
    current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"
    if [ -n "$current_branch" ] && [ "$current_branch" != "$CH_BRANCH" ]; then
      ch_deploy_status_write "running" "rebuild" "git" "Checking out $CH_BRANCH…" "" ""
      ch_deploy_log_restart "Checking out branch: $CH_BRANCH"
      if ! git checkout "$CH_BRANCH" --quiet 2>>"$CH_RESTART_LOG"; then
        ch_deploy_fail "rebuild" "git" "Branch '$CH_BRANCH' not found locally" 1 "ch-restart.log"
      fi
    fi
  fi

  ch_deploy_npm_install_if_needed "rebuild"
  ch_deploy_run_build "rebuild"

  ch_deploy_log_restart "Backing up + migrating database (schema + legacy data)…"
  CH_NPM_BIN="$NPM_BIN" CH_ASSUME_YES=1 ch_migrate_run "$CH_APP_DIR" "${CH_DATA_DIR:-$HOME/control-hub/data}" >>"$CH_BUILD_LOG" 2>&1 ||
    ch_deploy_log_restart "WARNING: database migration reported issues (backup retained) — see ch-build.log"
  if command -v npx &>/dev/null; then
    local HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
    if [ -f "$HERMES_HOME/config.yaml" ]; then
      npx tsx "$CH_SCRIPTS_ROOT/tooling/import-hermes-state.ts" >>"$CH_BUILD_LOG" 2>&1 ||
        ch_deploy_log_restart "WARNING: import-hermes-state failed"
    fi
    npx tsx "$CH_SCRIPTS_ROOT/tooling/seed-catalog.ts" --merge >>"$CH_BUILD_LOG" 2>&1 ||
      ch_deploy_log_restart "WARNING: seed-catalog failed"
    npx tsx "$CH_SCRIPTS_ROOT/tooling/ensure-hermes-model-sync.ts" >>"$CH_BUILD_LOG" 2>&1 ||
      ch_deploy_log_restart "WARNING: ensure-hermes-model-sync failed"
  fi

  ch_deploy_status_write "running" "rebuild" "restart" "Restarting server…" "" "ch-restart.log"
  if ! ch_deploy_do_restart_body; then
    ch_deploy_fail "rebuild" "restart" "Restart failed after build — see ch-restart.log" 1 "ch-restart.log"
  fi

  ch_deploy_status_write "success" "rebuild" "done" "Rebuild complete" 0 "ch-restart.log"
  exit 0
}

ch_deploy_run_update() {
  local RESTART_ONLY="${CH_DEPLOY_RESTART_ONLY:-false}"
  local CH_BRANCH="${CH_DEPLOY_BRANCH:-${CH_UPDATE_GIT_BRANCH:-dev}}"
  local APP_DIR="$CH_APP_DIR"
  local SCRIPT_DIR="$CH_SCRIPTS_ROOT"

  if ! ch_deploy_acquire_lock; then
    ch_deploy_fail "update" "lock" "Deploy already in progress" 1 "ch-update.log"
  fi

  ch_deploy_status_write "running" "update" "git" "Update started…" "" "ch-update.log"
  cd "$APP_DIR"

  if ! ch_deploy_resolve_tooling; then
    ch_deploy_fail "update" "git" "npm not found — cannot update" 1 "ch-update.log"
  fi

  if ! git rev-parse --is-inside-work-tree &>/dev/null; then
    ch_deploy_fail "update" "git" "$APP_DIR is not a git repository" 1 "ch-update.log"
  fi

  if [ "$RESTART_ONLY" = false ]; then
    ch_deploy_log_update "Fetching latest from origin/${CH_BRANCH}…"
    git fetch origin "$CH_BRANCH" --quiet 2>>"$LOG_FILE"

    ch_deploy_log_update "Checking out ${CH_BRANCH} branch…"
    git checkout "$CH_BRANCH" --quiet 2>>"$LOG_FILE"

    ch_deploy_log_update "Resetting to origin/${CH_BRANCH}…"
    git reset --hard "origin/${CH_BRANCH}" --quiet 2>>"$LOG_FILE"

    ch_deploy_log_update "Code updated to $(git rev-parse --short HEAD)"

    if git diff --name-only HEAD@{1} HEAD 2>/dev/null | grep -q "package-lock.json\|package.json"; then
      ch_deploy_status_write "running" "update" "install" "Installing dependencies…" "" "ch-update.log"
      ch_deploy_log_update "package.json changed — running npm install…"
      if ! "$NPM_BIN" install --prefer-offline 2>>"$LOG_FILE"; then
        ch_deploy_fail "update" "install" "npm install failed — see ch-update.log" 1 "ch-update.log"
      fi
      ch_deploy_log_update "Dependencies installed"
    else
      ch_deploy_log_update "No dependency changes — skipping npm install"
    fi

    ch_deploy_status_write "running" "update" "build" "Building production bundle…" "" "ch-update.log"
    ch_deploy_log_update "Building production bundle…"
    if ! "$NPM_BIN" run build >>"$LOG_FILE" 2>&1; then
      ch_deploy_fail "update" "build" "Build failed — see ch-update.log" 1 "ch-update.log"
    fi
    ch_deploy_log_update "Build successful"

    ch_deploy_log_update "Backing up + migrating database (schema + legacy data)…"
    if ! CH_NPM_BIN="$NPM_BIN" CH_ASSUME_YES=1 ch_migrate_run "$APP_DIR" "${CH_DATA_DIR:-$HOME/control-hub/data}" >>"$LOG_FILE" 2>&1; then
      ch_deploy_log_update "WARNING: database migration reported issues (backup retained) — see ch-update.log"
    fi

    local HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
    if command -v npx &>/dev/null && [ -f "$HERMES_HOME/config.yaml" ]; then
      ch_deploy_log_update "Importing Hermes state before seed…"
      if ! npx tsx "$SCRIPT_DIR/tooling/import-hermes-state.ts" >>"$LOG_FILE" 2>&1; then
        ch_deploy_log_update "WARNING: import-hermes-state failed — see ch-update.log"
      fi
    fi

    ch_deploy_log_update "Seeding professional catalog (merge)…"
    if command -v npx &>/dev/null; then
      if ! npx tsx "$SCRIPT_DIR/tooling/seed-catalog.ts" --merge >>"$LOG_FILE" 2>&1; then
        ch_deploy_log_update "WARNING: seed-catalog failed — see ch-update.log"
      else
        ch_deploy_log_update "Catalog seed complete"
      fi
      if ! npx tsx "$SCRIPT_DIR/tooling/ensure-hermes-model-sync.ts" >>"$LOG_FILE" 2>&1; then
        ch_deploy_log_update "WARNING: ensure-hermes-model-sync failed — see ch-update.log"
      else
        ch_deploy_log_update "Model defaults synced to config.yaml"
      fi
    fi
  fi

  local HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
  if command -v hermes &>/dev/null && [ -f "$HERMES_HOME/.env" ]; then
    if ! grep -q "API_SERVER_ENABLED=true" "$HERMES_HOME/.env" 2>/dev/null; then
      ch_deploy_log_update "Enabling API_SERVER_ENABLED=true in ~/.hermes/.env for Story Weaver…"
      echo "" >>"$HERMES_HOME/.env"
      echo "# Enable API server for Control Hub Rec Room (added by ch-deploy)" >>"$HERMES_HOME/.env"
      echo "API_SERVER_ENABLED=true" >>"$HERMES_HOME/.env"
    fi
    ch_deploy_log_update "Restarting Hermes gateway…"
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

  ch_deploy_status_write "running" "update" "restart" "Restarting server…" "" "ch-restart.log"
  ch_deploy_log_update "Restarting server…"
  if ! ch_deploy_do_restart_body; then
    ch_deploy_fail "update" "restart" "Restart failed — see ch-restart.log" 1 "ch-restart.log"
  fi

  ch_deploy_status_write "success" "update" "done" "Update complete" 0 "ch-update.log"
  ch_deploy_log_update "Update complete"
  exit 0
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
  CH_DEPLOY_BRANCH=""
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
