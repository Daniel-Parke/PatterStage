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
#   bash scripts/maintenance/ch-migrate.sh          # interactive (shows a plan, confirms)
#   bash scripts/maintenance/ch-migrate.sh --yes    # no prompts (programmatic / dashboard / CI)
#
# Honours CH_DATA_DIR (from .env.local or env; default ~/control-hub/data).
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

for arg in "$@"; do
  case "$arg" in
    --yes | -y | --non-interactive) export CH_ASSUME_YES=1 ;;
    -h | --help)
      sed -n '2,18p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
  esac
done

# shellcheck source=../lib/ch-log.sh
source "$REPO_ROOT/scripts/lib/ch-log.sh"
# shellcheck source=../lib/ch-dotenv-local.sh
source "$REPO_ROOT/scripts/lib/ch-dotenv-local.sh"
# shellcheck source=../lib/ch-migrate.sh
source "$REPO_ROOT/scripts/lib/ch-migrate.sh"

ch_load_control_hub_env_local "$REPO_ROOT"
DATA_DIR="${CH_DATA_DIR:-$HOME/control-hub/data}"

echo ""
ch_info "PatterStage database migration"
ch_dim   "  Data directory : $DATA_DIR"
ch_dim   "  Plan           : backup → schema migrations → legacy data migration"
ch_dim   "  Your existing database is backed up before anything changes."
echo ""

if ! ch_confirm "Proceed with migration?" "Y"; then
  ch_info "Cancelled — no changes made."
  exit 0
fi

echo ""
ch_migrate_run "$REPO_ROOT" "$DATA_DIR"
