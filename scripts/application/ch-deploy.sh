#!/usr/bin/env bash
# Deprecated shim: this script was renamed to ps-deploy.sh. Kept for back-compat
# with existing cron entries and habits; forwards to the new name. Removed after v1.0.
echo "WARNING: scripts/application/ch-deploy.sh is deprecated and will be removed after v1.0. Use scripts/application/ps-deploy.sh instead." >&2
exec "$(dirname "$0")/ps-deploy.sh" "$@"
