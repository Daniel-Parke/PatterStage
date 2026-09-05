#!/usr/bin/env bash
# Deprecated shim — this script was renamed to ps-system-report.sh. Kept for back-compat
# with existing cron entries and habits; forwards to the new name. Remove later.
exec "$(dirname "$0")/ps-system-report.sh" "$@"
