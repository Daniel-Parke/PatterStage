#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# PatterStage — database migration entrypoint
#
# Backs up your PatterStage database, applies ALL schema migrations (the same
# applier chain the app runs at boot), and migrates legacy data (recurring cron
# jobs → PatterStage schedules). Safe to run repeatedly (idempotent). Your data
# is never lost — a pre-migration backup is always written first.
#
# Usage:
#   bash scripts/maintenance/ps-migrate.sh          # interactive (shows a plan, confirms)
#   bash scripts/maintenance/ps-migrate.sh --yes    # no prompts (programmatic / dashboard / CI)
#
# Honours PS_DATA_DIR (from .env.local or env; default ~/control-hub/data).
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

for arg in "$@"; do
  case "$arg" in
    --yes | -y | --non-interactive) export PS_ASSUME_YES=1 ;;
    -h | --help)
      sed -n '2,18p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
  esac
done

# shellcheck source=../lib/ps-log.sh
source "$REPO_ROOT/scripts/lib/ps-log.sh"
# shellcheck source=../lib/ps-dotenv-local.sh
source "$REPO_ROOT/scripts/lib/ps-dotenv-local.sh"
# shellcheck source=../lib/ps-migrate.sh
source "$REPO_ROOT/scripts/lib/ps-migrate.sh"

ps_load_patterstage_env_local "$REPO_ROOT"
DATA_DIR="${PS_DATA_DIR:-${CH_DATA_DIR:-${CONTROL_HUB_DATA_DIR:-$( [ ! -d "$HOME/patterstage/data" ] && [ -d "$HOME/control-hub/data" ] && echo "$HOME/control-hub/data" || echo "$HOME/patterstage/data" )}}}"

echo ""
ps_info "PatterStage database migration"
ps_dim   "  Data directory : $DATA_DIR"
ps_dim   "  Plan           : backup → schema migrations → legacy data migration"
ps_dim   "  Your existing database is backed up before anything changes."
echo ""

if ! ps_confirm "Proceed with migration?" "Y"; then
  ps_info "Cancelled — no changes made."
  exit 0
fi

echo ""
ps_migrate_run "$REPO_ROOT" "$DATA_DIR"
