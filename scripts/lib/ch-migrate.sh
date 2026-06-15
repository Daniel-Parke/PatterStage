#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Control Hub — DB backup + full migration library
#
# Sourced by scripts/maintenance/ch-migrate.sh (interactive) and the deploy
# implementation (scripts/lib/ch-deploy-impl.sh, unattended). Provides the one
# migration path so the UI update/rebuild and a human run do the same thing:
#   backup → full schema migration (runMigrations) → legacy data migration.
# Requires ch-log.sh to be sourced first (ch_info/ch_ok/ch_warn/ch_err/ch_step/ch_dim).
# ═══════════════════════════════════════════════════════════════

# ch_backup_db <data_dir> → prints the backup path on stdout (empty if no DB).
ch_backup_db() {
  local data_dir="$1"
  local db="$data_dir/control-hub.db"
  [ -f "$db" ] || return 0
  local ts bak
  ts="$(date +%Y%m%dT%H%M%S 2>/dev/null || date +%s)"
  bak="$data_dir/control-hub.db.pre-migrate-$ts.bak"
  cp "$db" "$bak" || return 1
  [ -f "$db-wal" ] && cp "$db-wal" "$bak-wal" 2>/dev/null || true
  [ -f "$db-shm" ] && cp "$db-shm" "$bak-shm" 2>/dev/null || true
  printf '%s' "$bak"
}

# ch_migrate_run <repo_root> <data_dir>
# Backup → full schema migration (single source of truth: runMigrations via the
# db:migrate script) → runtime data migration (legacy cron_jobs → schedules,
# stuck "dispatched" missions → failed). The data step is non-fatal. If the
# schema step had to rebuild from baseline (incompatible DB), warns loudly that
# anything not carried over remains in the pre-baseline backup.
ch_migrate_run() {
  local repo="$1" data_dir="$2"
  local db="$data_dir/control-hub.db"
  local npm_bin="${CH_NPM_BIN:-npm}"
  local bak="" before_baseline after_baseline

  before_baseline="$(find "$data_dir" -maxdepth 1 -name 'control-hub.db.pre-baseline-*' 2>/dev/null | wc -l | tr -d ' ' || true)"
  before_baseline="${before_baseline:-0}"

  if [ -f "$db" ]; then
    bak="$(ch_backup_db "$data_dir" || true)"
    if [ -n "$bak" ]; then ch_ok "Backed up database → $bak"; else ch_warn "DB backup failed (continuing)"; fi
  else
    ch_info "No existing database to back up (fresh install)."
  fi

  ch_step "Applying schema migrations (single source of truth: runMigrations)…"
  if ! CH_DATA_DIR="$data_dir" "$npm_bin" --prefix "$repo" run db:migrate; then
    ch_err "Schema migration failed."
    [ -n "$bak" ] && ch_warn "Your data is safe in the backup: $bak"
    return 1
  fi

  ch_step "Migrating legacy data to the runtime model (cron jobs → schedules)…"
  if ! CH_DATA_DIR="$data_dir" node "$repo/scripts/tooling/migrate-to-runtime.mjs" --apply; then
    ch_warn "Runtime data migration reported issues (non-fatal — schema is migrated; backup retained)."
  fi

  after_baseline="$(find "$data_dir" -maxdepth 1 -name 'control-hub.db.pre-baseline-*' 2>/dev/null | wc -l | tr -d ' ' || true)"
  after_baseline="${after_baseline:-0}"
  if [ "${after_baseline:-0}" -gt "${before_baseline:-0}" ]; then
    ch_warn "A baseline REBUILD occurred — the previous DB was incompatible and was rebuilt."
    ch_warn "Preserved tables were re-imported; anything not carried over remains in a"
    ch_warn "control-hub.db.pre-baseline-* backup under $data_dir. Review it before deleting."
  fi

  ch_ok "Migration complete."
  [ -n "$bak" ] && ch_dim "Pre-migration backup retained: $bak"
  return 0
}
