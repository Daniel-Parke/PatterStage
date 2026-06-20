#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# PatterStage — unified deploy entrypoint (CLI + dashboard spawn)
#
# Usage:
#   bash scripts/application/ps-deploy.sh update [--restart-only] [--branch NAME]
#   bash scripts/application/ps-deploy.sh restart
#   bash scripts/application/ps-deploy.sh rebuild [--branch NAME]
#
# Loads PS_* / HERMES_HOME from .env.local via scripts/lib/ps-dotenv-local.sh.
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

export PS_APPLICATION_DIR
PS_APPLICATION_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PS_SCRIPTS_ROOT
PS_SCRIPTS_ROOT="$(cd "$PS_APPLICATION_DIR/.." && pwd)"
export PS_APP_DIR
PS_APP_DIR="$(cd "$PS_SCRIPTS_ROOT/.." && pwd)"

# shellcheck source=../lib/ps-deploy-impl.sh
source "$PS_SCRIPTS_ROOT/lib/ps-deploy-impl.sh"

ps_deploy_main "$@"
