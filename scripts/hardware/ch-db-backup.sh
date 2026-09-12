#!/usr/bin/env bash
# Deprecated shim — this script was renamed to ps-db-backup.sh. Kept for back-compat
# with existing cron entries and habits; forwards to the new name. Remove later.
exec "$(dirname "$0")/ps-db-backup.sh" "$@"
