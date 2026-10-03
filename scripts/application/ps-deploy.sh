#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# PatterStage — deploy entrypoint (thin wrapper, Unix CLI)
#
#   bash scripts/application/ps-deploy.sh update [--restart-only] [--branch NAME]
#   bash scripts/application/ps-deploy.sh restart
#   bash scripts/application/ps-deploy.sh rebuild [--branch NAME]
#
# The deploy logic is now cross-platform Node (scripts/tooling/ps-deploy.mjs),
# which the in-app Update/Rebuild/Restart buttons spawn directly on every OS.
# This wrapper just forwards, so the CLI, the ch-deploy.sh shim, and
# ps-relocate.sh keep working on Unix.
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/../tooling/ps-deploy.mjs" "$@"
