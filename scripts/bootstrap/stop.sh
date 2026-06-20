#!/usr/bin/env bash
# Stop the PatterStage Next.js server (and optional socat relay).
# PORT comes from env, .env.local, or the default 42069.
#
# Usage: bash scripts/bootstrap/stop.sh [--help]
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
CH_SCRIPTS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

case "${1:-}" in
  -h | --help)
    echo "Usage: bash scripts/bootstrap/stop.sh"
    echo "Stops PatterStage listeners on PORT (env / .env.local / 42069)."
    exit 0
    ;;
esac

# shellcheck source=../lib/ch-log.sh
source "$CH_SCRIPTS_ROOT/lib/ch-log.sh"
# shellcheck source=../lib/ch-env.sh
source "$CH_SCRIPTS_ROOT/lib/ch-env.sh"
# shellcheck source=../lib/ch-dotenv-local.sh
source "$CH_SCRIPTS_ROOT/lib/ch-dotenv-local.sh"

ch_load_control_hub_env_local "$APP_DIR"

PORT="${PORT:-}"
if [ -z "$PORT" ] && [ -f "$APP_DIR/.env.local" ]; then
  PORT="$(ch_env_read_port "$APP_DIR/.env.local" 2>/dev/null || true)"
fi
PORT="${PORT:-42069}"

ch_step "Stopping PatterStage listeners on port $PORT…"
ch_stop_control_hub "$APP_DIR"
ch_ok "Stopped PatterStage listeners on port $PORT"
