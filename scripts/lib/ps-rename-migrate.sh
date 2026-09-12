#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# PatterStage — one-time in-place rename migration (PatterStage → PatterStage)
#
# Sourced by the deploy implementation and run once before ps_migrate_run on
# `update`. Idempotent and safe: it renames the DB file in place and rewrites
# .env.local keys, but does NOT move the data directory or the repo checkout
# (a running deploy can't relocate its own checkout — that is the separate,
# guided scripts/maintenance/ps-relocate.sh). The path resolver already reads
# either name, so this is an optimisation, not a correctness requirement.
# ═══════════════════════════════════════════════════════════════

# ps_rename_migrate <data_dir> [repo_root]
ps_rename_migrate() {
  local data_dir="$1" repo="${2:-}"
  [ -n "$data_dir" ] || return 0

  # 1. DB file: control-hub.db → patterstage.db (+ WAL/SHM), only when the
  #    legacy file exists and the new one does not yet.
  if [ -f "$data_dir/control-hub.db" ] && [ ! -f "$data_dir/patterstage.db" ]; then
    mv "$data_dir/control-hub.db" "$data_dir/patterstage.db" 2>/dev/null || true
    [ -f "$data_dir/control-hub.db-wal" ] && mv "$data_dir/control-hub.db-wal" "$data_dir/patterstage.db-wal" 2>/dev/null || true
    [ -f "$data_dir/control-hub.db-shm" ] && mv "$data_dir/control-hub.db-shm" "$data_dir/patterstage.db-shm" 2>/dev/null || true
  fi

  [ -n "$repo" ] || return 0
  local env_file="$repo/.env.local"
  [ -f "$env_file" ] || return 0

  # Already migrated? leave it alone.
  grep -q '^PS_RENAMED=' "$env_file" 2>/dev/null && return 0

  # 2. Rewrite legacy CH_* keys to PS_* (only if any are present). PS_ keys that
  #    already exist are left as-is; this just renames the leading prefix.
  if grep -q '^CH_' "$env_file" 2>/dev/null; then
    local tmp
    tmp="$(mktemp)"
    sed -E 's/^CH_/PS_/' "$env_file" >"$tmp" && mv "$tmp" "$env_file"
  fi

  # 3. Idempotency marker.
  echo "PS_RENAMED=1" >>"$env_file"
}
