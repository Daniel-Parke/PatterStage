#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# PatterStage — unified deploy entrypoint (CLI + dashboard spawn)
#
# Usage:
#   bash scripts/application/ch-deploy.sh update [--restart-only] [--branch NAME]
#   bash scripts/application/ch-deploy.sh restart
#   bash scripts/application/ch-deploy.sh rebuild [--branch NAME]
#
# Loads CH_* / HERMES_HOME from .env.local via scripts/lib/ch-dotenv-local.sh.
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

export CH_APPLICATION_DIR
CH_APPLICATION_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export CH_SCRIPTS_ROOT
CH_SCRIPTS_ROOT="$(cd "$CH_APPLICATION_DIR/.." && pwd)"
export CH_APP_DIR
CH_APP_DIR="$(cd "$CH_SCRIPTS_ROOT/.." && pwd)"

# shellcheck source=../lib/ch-deploy-impl.sh
source "$CH_SCRIPTS_ROOT/lib/ch-deploy-impl.sh"

ch_deploy_main "$@"
