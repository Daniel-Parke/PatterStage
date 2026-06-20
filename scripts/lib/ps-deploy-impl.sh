#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# PatterStage — deploy implementation (sourced by application/ps-deploy.sh)
#
# Expects exports from ps-deploy.sh:
#   PS_APPLICATION_DIR  scripts/application
#   PS_SCRIPTS_ROOT       scripts/
#   PS_APP_DIR            repository root (Next.js app)
# ═══════════════════════════════════════════════════════════════

ps_deploy_usage() {
  echo "Usage: bash scripts/application/ps-deploy.sh update [--restart-only] [--branch NAME]" >&2
  echo "       bash scripts/application/ps-deploy.sh restart" >&2
  echo "       bash scripts/application/ps-deploy.sh rebuild [--branch NAME]" >&2
}

# shellcheck source=ps-dotenv-local.sh
source "$PS_SCRIPTS_ROOT/lib/ps-dotenv-local.sh"
ps_load_patterstage_env_local "$PS_APP_DIR"

# shellcheck source=ps-port.sh
source "$PS_SCRIPTS_ROOT/lib/ps-port.sh"

# shellcheck source=ps-env.sh
source "$PS_SCRIPTS_ROOT/lib/ps-env.sh"

# shellcheck source=ps-deploy-status.sh
source "$PS_SCRIPTS_ROOT/lib/ps-deploy-status.sh"

# shellcheck source=ps-log.sh
source "$PS_SCRIPTS_ROOT/lib/ps-log.sh"

# shellcheck source=ps-migrate.sh
source "$PS_SCRIPTS_ROOT/lib/ps-migrate.sh"

LOCK_FILE="${TMPDIR:-/tmp}/ps-deploy.lock"
LOG_FILE="$HOME/.hermes/logs/ps-update.log"
PS_RESTART_LOG="$HOME/.hermes/logs/ps-restart.log"
PS_BUILD_LOG="$HOME/.hermes/logs/ps-build.log"
# Dedicated server stdout log — separate from ps-restart.log so the
# runtime output of next-server is preserved across deploys. The
# /api/logs UI should also include this file once the Logs page is
# updated to discover it.
PS_RUNTIME_LOG="${PS_RUNTIME_LOG:-$HOME/.hermes/logs/ps-runtime.log}"

mkdir -p "$(dirname "$LOG_FILE")"

ps_deploy_log_update() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

ps_deploy_log_restart() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$PS_RESTART_LOG"
}

ps_deploy_log_both() {
  ps_deploy_log_update "$@"
  ps_deploy_log_restart "$@"
}

ps_deploy_acquire_lock() {
  if command -v flock &>/dev/null; then
    exec 200>"$LOCK_FILE"
    if ! flock -n 200; then
      ps_deploy_log_both "ERROR: Deploy already running (lock held)"
      return 1
    fi
    PS_DEPLOY_LOCK_MODE=flock
    return 0
  fi
  local lock_dir="${LOCK_FILE}.d"
  if ! mkdir "$lock_dir" 2>/dev/null; then
    ps_deploy_log_both "ERROR: Deploy already running (lock held)"
    return 1
  fi
  PS_DEPLOY_LOCK_MODE=mkdir
  PS_DEPLOY_LOCK_DIR="$lock_dir"
  return 0
}

ps_deploy_release_lock() {
  if [ "${PS_DEPLOY_LOCK_MODE:-}" = "flock" ]; then
    flock -u 200 2>/dev/null || true
    exec 200>&- 2>/dev/null || true
  elif [ -n "${PS_DEPLOY_LOCK_DIR:-}" ]; then
    rmdir "${PS_DEPLOY_LOCK_DIR}" 2>/dev/null || true
    unset PS_DEPLOY_LOCK_DIR
  fi
  unset PS_DEPLOY_LOCK_MODE
}

ps_deploy_fail() {
  local action="$1"
  local phase="$2"
  local message="$3"
  local exit_code="${4:-1}"
  local log_hint="${5:-ps-restart.log}"
  ps_deploy_status_write "failed" "$action" "$phase" "$message" "$exit_code" "$log_hint"
  ps_deploy_log_both "ERROR: $message"
  ps_deploy_release_lock
  exit "$exit_code"
}

ps_deploy_resolve_tooling() {
  NODE_BIN="$(which node 2>/dev/null || echo "$HOME/.local/bin/node")"
  NPM_BIN="$(which npm 2>/dev/null || echo "$HOME/.local/bin/npm")"
  if [ ! -x "$NPM_BIN" ]; then
    return 1
  fi
  export PATH="$(dirname "$NODE_BIN"):$(dirname "$NPM_BIN"):$PATH"
  return 0
}

ps_deploy_npm_install_if_needed() {
  local action="$1"
  local lock="$PS_APP_DIR/package-lock.json"
  local marker="$PS_APP_DIR/.next/BUILD_ID"
  local need=0

  if [ -f "$lock" ]; then
    if [ ! -f "$marker" ] || [ "$lock" -nt "$marker" ]; then
      need=1
    fi
  fi

  if [ "$need" -eq 0 ]; then
    return 0
  fi

  ps_deploy_status_write "running" "$action" "install" "Installing dependencies…" "" ""
  ps_deploy_log_restart "package-lock.json newer than build — running npm install…"
  if ! "$NPM_BIN" install --prefer-offline >>"$PS_BUILD_LOG" 2>&1; then
    ps_deploy_fail "$action" "install" "npm install failed — see ps-build.log" 1 "ps-build.log"
  fi
  ps_deploy_log_restart "Dependencies installed"
}

ps_deploy_run_build() {
  local action="$1"
  ps_deploy_status_write "running" "$action" "build" "Building production bundle…" "" "ps-build.log"
  ps_deploy_log_restart "Build started (npm=$(which npm), node=$(which node))…"
  if ! "$NPM_BIN" run build >>"$PS_BUILD_LOG" 2>&1; then
    ps_deploy_fail "$action" "build" "Build failed — see ps-build.log" 1 "ps-build.log"
  fi
  ps_deploy_log_restart "Build complete."
}

# Restart next-server. Caller must hold deploy lock; lock is released before server spawn.
ps_deploy_do_restart_body() {
  cd "$PS_APP_DIR"

  local PID_FILE="$HOME/.hermes/logs/ps-server.pid"
  local SOCAT_PID_FILE="$HOME/.hermes/logs/ps-socat.pid"
  local ENV_FILE="$PS_APP_DIR/.env.local"

  ps_deploy_log_restart "Restarting server…"

  local use_relay=0
  local relay_listen
  case "${PS_SOCAT_RELAY:-}" in 1 | yes | YES | true | True) use_relay=1 ;; esac
  if [ -n "${PS_SOCAT_BIND:-}" ]; then
    use_relay=1
  fi

  local deploy_port="${PORT:-}"
  if [ -z "$deploy_port" ] && [ -f "$ENV_FILE" ]; then
    deploy_port="$(ps_env_read_port "$ENV_FILE" 2>/dev/null || true)"
  fi
  if [ -z "$deploy_port" ]; then
    deploy_port="$(ps_auto_pick_port 2>/dev/null || true)"
  fi
  if [ -z "$deploy_port" ]; then
    deploy_port="42069"
  fi
  if ! ps_validate_port_number "$deploy_port"; then
    ps_deploy_log_restart "ERROR: Invalid PORT in .env.local: $deploy_port"
    return 1
  fi

  ps_deploy_log_restart "Stopping listeners on configured port $deploy_port…"
  ps_kill_tcp_listeners_on_port "$deploy_port"

  if [ -f "$PID_FILE" ]; then
    local OLD_SERVER_PID
    OLD_SERVER_PID=$(cat "$PID_FILE" 2>/dev/null || true)
    if [ -n "$OLD_SERVER_PID" ] && kill -0 "$OLD_SERVER_PID" 2>/dev/null; then
      ps_deploy_log_restart "Stopping old next-server (PID $OLD_SERVER_PID)…"
      kill -9 "$OLD_SERVER_PID" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
    sleep 1
  fi

  if [ "$use_relay" -eq 1 ]; then
    local RELAY_PORT="${PS_SOCAT_RELAY_PORT:-42069}"
    local OLD_SOCAT_PID
    OLD_SOCAT_PID=$(cat "$SOCAT_PID_FILE" 2>/dev/null || true)
    if [ -n "$OLD_SOCAT_PID" ] && kill -0 "$OLD_SOCAT_PID" 2>/dev/null; then
      ps_deploy_log_restart "Stopping old socat relay (PID $OLD_SOCAT_PID)…"
      kill -9 "$OLD_SOCAT_PID" 2>/dev/null || true
      sleep 1
    fi
    ps_deploy_log_restart "Stopping listeners on relay port ${RELAY_PORT}…"
    ps_kill_tcp_listeners_on_port "$RELAY_PORT"
    sleep 1
  else
    rm -f "$SOCAT_PID_FILE"
  fi

  if ps_tcp_port_in_use "$deploy_port" 2>/dev/null; then
    ps_deploy_log_restart "Port $deploy_port still in use after stop — killing blockers…"
    ps_kill_tcp_listeners_on_port "$deploy_port"
    sleep 2
    if ps_tcp_port_in_use "$deploy_port" 2>/dev/null; then
      local fallback
      fallback="$(ps_auto_pick_port 2>/dev/null || true)"
      if [ -n "$fallback" ] && [ "$fallback" != "$deploy_port" ]; then
        ps_deploy_log_restart "Port $deploy_port unavailable — using $fallback (updating .env.local)"
        deploy_port="$fallback"
        ps_env_set "$ENV_FILE" "PORT" "$deploy_port"
      else
        ps_deploy_log_restart "ERROR: Port $deploy_port still in use and no free port in 42069–42100"
        return 1
      fi
    fi
  fi
  local HOST
  if [ "$use_relay" -eq 1 ]; then
    HOST="${PS_NEXT_BIND_HOST:-127.0.0.1}"
    relay_listen="${PS_SOCAT_BIND:-0.0.0.0}"
  else
    HOST="${PS_NEXT_BIND_HOST:-0.0.0.0}"
  fi
  export PS_ENABLE_DEPLOY_API="${PS_ENABLE_DEPLOY_API:-true}"

  if [ ! -f "node_modules/next/dist/bin/next" ]; then
    ps_deploy_log_restart "next binary not found at node_modules/next/dist/bin/next — running install to restore dependencies…"
    if ! "$NPM_BIN" install --prefer-offline >>"$PS_RESTART_LOG" 2>&1; then
      ps_deploy_log_restart "ERROR: npm install failed — cannot start server"
      return 1
    fi
    ps_deploy_log_restart "Dependencies restored via npm install"
  fi

  ps_deploy_log_restart "Starting next-server on $HOST:$deploy_port…"
  rm -f "$PID_FILE"
  ps_deploy_release_lock
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
  : > "$PS_RUNTIME_LOG"
  nohup "$NODE_BIN" node_modules/next/dist/bin/next start -p "$deploy_port" -H "$HOST" \
    >>"$PS_RUNTIME_LOG" 2>&1 </dev/null &
  local SERVER_PID=$!
  echo "$SERVER_PID" >"$PID_FILE"
  ps_deploy_log_restart "Server started (PID $SERVER_PID) — stdout -> $PS_RUNTIME_LOG"

  # Readiness check: probe /api/status with a real HTTP GET, not just
  # TCP connect. The previous curl `/` check passed even when the
  # event loop was blocked (TCP accept succeeds in the kernel). See
  # 2026-06-01 outage for the diagnostic.
  local i ready=0 status_code
  for i in $(seq 1 20); do
    status_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 --max-time 5 "http://127.0.0.1:${deploy_port}/api/status" 2>/dev/null || echo "000")
    if [ "$status_code" = "200" ]; then
      ps_deploy_log_restart "Server is ready on http://127.0.0.1:${deploy_port} (HTTP $status_code)"
      ready=1
      break
    fi
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
      ps_deploy_log_restart "ERROR: next-server died during startup — see $PS_RUNTIME_LOG"
      return 1
    fi
    sleep 1
  done

  if [ "$ready" -ne 1 ]; then
    ps_deploy_log_restart "ERROR: Server did not respond at /api/status within 20s — see $PS_RUNTIME_LOG"
    return 1
  fi

  if [ "$use_relay" -eq 1 ]; then
    ps_deploy_log_restart "Starting socat relay on ${relay_listen}:${RELAY_PORT} → 127.0.0.1:$deploy_port…"
    # Close any remaining deploy lock fd in the backgrounded socat child too.
    # (The ps_deploy_release_lock above already released the flock; this just
    # ensures socat doesn't keep fd 200 open either, in case the order ever
    # changes.)
    exec 200>&- 2>/dev/null || true
    nohup /usr/bin/socat TCP-LISTEN:"$RELAY_PORT",fork,reuseaddr,bind="${relay_listen}" TCP:127.0.0.1:"$deploy_port" \
      >>"$PS_RESTART_LOG" 2>&1 </dev/null &
    local SOCAT_PID=$!
    echo "$SOCAT_PID" >"$SOCAT_PID_FILE"
    ps_deploy_log_restart "socat relay started (PID $SOCAT_PID)"
    sleep 1
    if ss -tlnp "sport = :$RELAY_PORT" 2>/dev/null | grep -q LISTEN; then
      ps_deploy_log_restart "Relay active: ${relay_listen}:${RELAY_PORT} → 127.0.0.1:$deploy_port"
    else
      ps_deploy_log_restart "WARNING: socat relay may not have started correctly"
    fi
  else
    rm -f "$SOCAT_PID_FILE"
  fi

  ps_deploy_log_restart "Restart complete."
  sleep 2
  return 0
}

ps_deploy_cmd_restart() {
  if ! ps_deploy_acquire_lock; then
    ps_deploy_fail "restart" "lock" "Deploy already in progress" 1 "ps-restart.log"
  fi
  ps_deploy_status_write "running" "restart" "restart" "Restarting server…" "" "ps-restart.log"
  if ! ps_deploy_resolve_tooling; then
    ps_deploy_fail "restart" "restart" "npm not found — cannot restart" 1 "ps-restart.log"
  fi
  if ! ps_deploy_do_restart_body; then
    ps_deploy_fail "restart" "restart" "Restart failed — see ps-restart.log" 1 "ps-restart.log"
  fi
  ps_deploy_status_write "success" "restart" "done" "Restart complete" 0 "ps-restart.log"
  exit 0
}

ps_deploy_cmd_rebuild() {
  local PS_BRANCH="${PS_DEPLOY_BRANCH:-}"

  if ! ps_deploy_acquire_lock; then
    ps_deploy_fail "rebuild" "lock" "Deploy already in progress" 1 "ps-restart.log"
  fi

  ps_deploy_status_write "running" "rebuild" "build" "Rebuild started…" "" "ps-build.log"
  cd "$PS_APP_DIR"

  if ! ps_deploy_resolve_tooling; then
    ps_deploy_fail "rebuild" "build" "npm not found — cannot build" 1 "ps-build.log"
  fi

  if [ -n "$PS_BRANCH" ]; then
    local current_branch
    current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"
    if [ -n "$current_branch" ] && [ "$current_branch" != "$PS_BRANCH" ]; then
      ps_deploy_status_write "running" "rebuild" "git" "Checking out $PS_BRANCH…" "" ""
      ps_deploy_log_restart "Checking out branch: $PS_BRANCH"
      if ! git checkout "$PS_BRANCH" --quiet 2>>"$PS_RESTART_LOG"; then
        ps_deploy_fail "rebuild" "git" "Branch '$PS_BRANCH' not found locally" 1 "ps-restart.log"
      fi
    fi
  fi

  ps_deploy_npm_install_if_needed "rebuild"
  ps_deploy_run_build "rebuild"

  ps_deploy_log_restart "Backing up + migrating database (schema + legacy data)…"
  PS_NPM_BIN="$NPM_BIN" PS_ASSUME_YES=1 ps_migrate_run "$PS_APP_DIR" "${PS_DATA_DIR:-$HOME/control-hub/data}" >>"$PS_BUILD_LOG" 2>&1 ||
    ps_deploy_log_restart "WARNING: database migration reported issues (backup retained) — see ps-build.log"
  if command -v npx &>/dev/null; then
    local HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
    if [ -f "$HERMES_HOME/config.yaml" ]; then
      npx tsx "$PS_SCRIPTS_ROOT/tooling/import-hermes-state.ts" >>"$PS_BUILD_LOG" 2>&1 ||
        ps_deploy_log_restart "WARNING: import-hermes-state failed"
    fi
    npx tsx "$PS_SCRIPTS_ROOT/tooling/seed-catalog.ts" --merge >>"$PS_BUILD_LOG" 2>&1 ||
      ps_deploy_log_restart "WARNING: seed-catalog failed"
    npx tsx "$PS_SCRIPTS_ROOT/tooling/ensure-hermes-model-sync.ts" >>"$PS_BUILD_LOG" 2>&1 ||
      ps_deploy_log_restart "WARNING: ensure-hermes-model-sync failed"
  fi

  ps_deploy_status_write "running" "rebuild" "restart" "Restarting server…" "" "ps-restart.log"
  if ! ps_deploy_do_restart_body; then
    ps_deploy_fail "rebuild" "restart" "Restart failed after build — see ps-restart.log" 1 "ps-restart.log"
  fi

  ps_deploy_status_write "success" "rebuild" "done" "Rebuild complete" 0 "ps-restart.log"
  exit 0
}

ps_deploy_run_update() {
  local RESTART_ONLY="${PS_DEPLOY_RESTART_ONLY:-false}"
  local PS_BRANCH="${PS_DEPLOY_BRANCH:-${PS_UPDATE_GIT_BRANCH:-dev}}"
  local APP_DIR="$PS_APP_DIR"
  local SCRIPT_DIR="$PS_SCRIPTS_ROOT"

  if ! ps_deploy_acquire_lock; then
    ps_deploy_fail "update" "lock" "Deploy already in progress" 1 "ps-update.log"
  fi

  ps_deploy_status_write "running" "update" "git" "Update started…" "" "ps-update.log"
  cd "$APP_DIR"

  if ! ps_deploy_resolve_tooling; then
    ps_deploy_fail "update" "git" "npm not found — cannot update" 1 "ps-update.log"
  fi

  if ! git rev-parse --is-inside-work-tree &>/dev/null; then
    ps_deploy_fail "update" "git" "$APP_DIR is not a git repository" 1 "ps-update.log"
  fi

  if [ "$RESTART_ONLY" = false ]; then
    ps_deploy_log_update "Fetching latest from origin/${PS_BRANCH}…"
    git fetch origin "$PS_BRANCH" --quiet 2>>"$LOG_FILE"

    ps_deploy_log_update "Checking out ${PS_BRANCH} branch…"
    git checkout "$PS_BRANCH" --quiet 2>>"$LOG_FILE"

    ps_deploy_log_update "Resetting to origin/${PS_BRANCH}…"
    git reset --hard "origin/${PS_BRANCH}" --quiet 2>>"$LOG_FILE"

    ps_deploy_log_update "Code updated to $(git rev-parse --short HEAD)"

    if git diff --name-only HEAD@{1} HEAD 2>/dev/null | grep -q "package-lock.json\|package.json"; then
      ps_deploy_status_write "running" "update" "install" "Installing dependencies…" "" "ps-update.log"
      ps_deploy_log_update "package.json changed — running npm install…"
      if ! "$NPM_BIN" install --prefer-offline 2>>"$LOG_FILE"; then
        ps_deploy_fail "update" "install" "npm install failed — see ps-update.log" 1 "ps-update.log"
      fi
      ps_deploy_log_update "Dependencies installed"
    else
      ps_deploy_log_update "No dependency changes — skipping npm install"
    fi

    ps_deploy_status_write "running" "update" "build" "Building production bundle…" "" "ps-update.log"
    ps_deploy_log_update "Building production bundle…"
    if ! "$NPM_BIN" run build >>"$LOG_FILE" 2>&1; then
      ps_deploy_fail "update" "build" "Build failed — see ps-update.log" 1 "ps-update.log"
    fi
    ps_deploy_log_update "Build successful"

    ps_deploy_log_update "Backing up + migrating database (schema + legacy data)…"
    if ! PS_NPM_BIN="$NPM_BIN" PS_ASSUME_YES=1 ps_migrate_run "$APP_DIR" "${PS_DATA_DIR:-$HOME/control-hub/data}" >>"$LOG_FILE" 2>&1; then
      ps_deploy_log_update "WARNING: database migration reported issues (backup retained) — see ps-update.log"
    fi

    local HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
    if command -v npx &>/dev/null && [ -f "$HERMES_HOME/config.yaml" ]; then
      ps_deploy_log_update "Importing Hermes state before seed…"
      if ! npx tsx "$SCRIPT_DIR/tooling/import-hermes-state.ts" >>"$LOG_FILE" 2>&1; then
        ps_deploy_log_update "WARNING: import-hermes-state failed — see ps-update.log"
      fi
    fi

    ps_deploy_log_update "Seeding professional catalog (merge)…"
    if command -v npx &>/dev/null; then
      if ! npx tsx "$SCRIPT_DIR/tooling/seed-catalog.ts" --merge >>"$LOG_FILE" 2>&1; then
        ps_deploy_log_update "WARNING: seed-catalog failed — see ps-update.log"
      else
        ps_deploy_log_update "Catalog seed complete"
      fi
      if ! npx tsx "$SCRIPT_DIR/tooling/ensure-hermes-model-sync.ts" >>"$LOG_FILE" 2>&1; then
        ps_deploy_log_update "WARNING: ensure-hermes-model-sync failed — see ps-update.log"
      else
        ps_deploy_log_update "Model defaults synced to config.yaml"
      fi
    fi
  fi

  local HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
  if command -v hermes &>/dev/null && [ -f "$HERMES_HOME/.env" ]; then
    if ! grep -q "API_SERVER_ENABLED=true" "$HERMES_HOME/.env" 2>/dev/null; then
      ps_deploy_log_update "Enabling API_SERVER_ENABLED=true in ~/.hermes/.env for Story Weaver…"
      echo "" >>"$HERMES_HOME/.env"
      echo "# Enable API server for PatterStage Rec Room (added by ps-deploy)" >>"$HERMES_HOME/.env"
      echo "API_SERVER_ENABLED=true" >>"$HERMES_HOME/.env"
    fi
    ps_deploy_log_update "Restarting Hermes gateway…"
    if hermes gateway stop 2>/dev/null; then
      hermes gateway start 2>/dev/null || ps_deploy_log_update "WARNING: Gateway start failed — restart manually"
    else
      ps_deploy_log_update "WARNING: Could not stop gateway — restart manually if needed"
    fi
  fi

  local PS_DATA_ROOT="${PS_DATA_DIR:-$HOME/control-hub/data}"
  mkdir -p "$PS_DATA_ROOT/scripts" "$PS_DATA_ROOT/logs"
  if command -v node &>/dev/null; then
    PS_DATA_DIR="$PS_DATA_ROOT" node "$PS_SCRIPTS_ROOT/tooling/discover-agents.mjs" >>"$LOG_FILE" 2>&1 ||
      ps_deploy_log_update "WARNING: discover-agents.mjs failed"
  fi

  ps_deploy_status_write "running" "update" "restart" "Restarting server…" "" "ps-restart.log"
  ps_deploy_log_update "Restarting server…"
  if ! ps_deploy_do_restart_body; then
    ps_deploy_fail "update" "restart" "Restart failed — see ps-restart.log" 1 "ps-restart.log"
  fi

  ps_deploy_status_write "success" "update" "done" "Update complete" 0 "ps-update.log"
  ps_deploy_log_update "Update complete"
  exit 0
}

ps_deploy_dispatch_update() {
  PS_DEPLOY_RESTART_ONLY=false
  PS_DEPLOY_BRANCH="${PS_UPDATE_GIT_BRANCH:-dev}"
  while [ "${1:-}" ]; do
    case "${1}" in
      --restart-only) PS_DEPLOY_RESTART_ONLY=true ; shift ;;
      --yes | -y) export PS_ASSUME_YES=1 ; shift ;;
      --branch)
        PS_DEPLOY_BRANCH="${2:-}"
        shift 2
        ;;
      *) shift ;;
    esac
  done
  # A full update does `git reset --hard origin/<branch>` and discards local
  # changes. Warn a human first; the dashboard spawns this non-interactively
  # (no TTY) so ps_confirm auto-proceeds on the safe default. Pass --yes to skip.
  if [ "$PS_DEPLOY_RESTART_ONLY" = false ]; then
    if ! ps_confirm "Update resets this checkout to origin/${PS_DEPLOY_BRANCH} and discards local changes. Continue?" "Y"; then
      ps_info "Update cancelled — no changes made."
      exit 0
    fi
  fi
  ps_deploy_run_update
}

ps_deploy_dispatch_rebuild() {
  PS_DEPLOY_BRANCH=""
  while [ "${1:-}" ]; do
    case "${1}" in
      --branch)
        PS_DEPLOY_BRANCH="${2:-}"
        shift 2
        ;;
      *) shift ;;
    esac
  done
  ps_deploy_cmd_rebuild
}

ps_deploy_main() {
  local sub="${1:-}"
  shift || true
  case "$sub" in
    update) ps_deploy_dispatch_update "$@" ;;
    restart) ps_deploy_cmd_restart ;;
    rebuild) ps_deploy_dispatch_rebuild "$@" ;;
    "" | -h | --help)
      ps_deploy_usage
      exit 1
      ;;
    *)
      echo "Unknown subcommand: $sub" >&2
      ps_deploy_usage
      exit 1
      ;;
  esac
}
