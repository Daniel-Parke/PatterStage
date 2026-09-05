#!/usr/bin/env bash
# Stop the PatterStage Next.js server (and optional socat relay).
# PORT comes from env, .env.local, or the default 42069.
#
# Usage: bash scripts/bootstrap/stop.sh [--help]
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
PS_SCRIPTS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

case "${1:-}" in
  -h | --help)
    echo "Usage: bash scripts/bootstrap/stop.sh"
    echo "Stops PatterStage listeners on PORT (env / .env.local / 42069)."
    exit 0
    ;;
esac

# shellcheck source=../lib/ps-log.sh
source "$PS_SCRIPTS_ROOT/lib/ps-log.sh"
# shellcheck source=../lib/ps-env.sh
source "$PS_SCRIPTS_ROOT/lib/ps-env.sh"
# shellcheck source=../lib/ps-dotenv-local.sh
source "$PS_SCRIPTS_ROOT/lib/ps-dotenv-local.sh"

ps_load_patterstage_env_local "$APP_DIR"

PORT="${PORT:-}"
if [ -z "$PORT" ] && [ -f "$APP_DIR/.env.local" ]; then
  PORT="$(ps_env_read_port "$APP_DIR/.env.local" 2>/dev/null || true)"
fi
PORT="${PORT:-42069}"

ps_step "Stopping PatterStage listeners on port $PORT…"
ps_stop_patterstage "$APP_DIR"
ps_ok "Stopped PatterStage listeners on port $PORT"
