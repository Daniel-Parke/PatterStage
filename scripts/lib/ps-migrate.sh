#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# PatterStage — DB backup + full migration library
#
# Sourced by scripts/maintenance/ps-migrate.sh (interactive) and the deploy
# implementation (scripts/lib/ps-deploy-impl.sh, unattended). Provides the one
# migration path so the UI update/rebuild and a human run do the same thing:
#   backup → full schema migration (runMigrations) → legacy data migration.
# Requires ps-log.sh to be sourced first (ps_info/ps_ok/ps_warn/ps_err/ps_step/ps_dim).
# ═══════════════════════════════════════════════════════════════

# ps_resolve_db <data_dir> → the DB path: patterstage.db, else an existing
# legacy control-hub.db, else patterstage.db (fresh). Mirrors getDbPath() in
# src/lib/paths.ts so the shell and the app agree on the file.
ps_resolve_db() {
  local d="$1"
  if [ ! -f "$d/patterstage.db" ] && [ -f "$d/control-hub.db" ]; then
    printf '%s' "$d/control-hub.db"
  else
    printf '%s' "$d/patterstage.db"
  fi
}

# ps_backup_db <data_dir> → prints the backup path on stdout (empty if no DB).
ps_backup_db() {
  local data_dir="$1"
  local db; db="$(ps_resolve_db "$data_dir")"
  [ -f "$db" ] || return 0
  local ts bak
  ts="$(date +%Y%m%dT%H%M%S 2>/dev/null || date +%s)"
  bak="${db}.pre-migrate-$ts.bak"
  cp "$db" "$bak" || return 1
  [ -f "$db-wal" ] && cp "$db-wal" "$bak-wal" 2>/dev/null || true
  [ -f "$db-shm" ] && cp "$db-shm" "$bak-shm" 2>/dev/null || true
  printf '%s' "$bak"
}

# ps_migrate_run <repo_root> <data_dir>
# Backup → full schema migration (single source of truth: runMigrations via the
# db:migrate script) → runtime data migration (legacy cron_jobs → schedules,
# stuck "dispatched" missions → failed). The data step is non-fatal. If the
# schema step had to rebuild from baseline (incompatible DB), warns loudly that
# anything not carried over remains in the pre-baseline backup.
ps_migrate_run() {
  local repo="$1" data_dir="$2"
  local db; db="$(ps_resolve_db "$data_dir")"
  local db_base; db_base="$(basename "$db")"
  local npm_bin="${PS_NPM_BIN:-npm}"
  local bak="" before_baseline after_baseline

  before_baseline="$(find "$data_dir" -maxdepth 1 -name "${db_base}.pre-baseline-*" 2>/dev/null | wc -l | tr -d ' ' || true)"
  before_baseline="${before_baseline:-0}"

  if [ -f "$db" ]; then
    bak="$(ps_backup_db "$data_dir" || true)"
    if [ -n "$bak" ]; then ps_ok "Backed up database → $bak"; else ps_warn "DB backup failed (continuing)"; fi
  else
    ps_info "No existing database to back up (fresh install)."
  fi

  ps_step "Applying schema migrations (single source of truth: runMigrations)…"
  if ! PS_DATA_DIR="$data_dir" "$npm_bin" --prefix "$repo" run db:migrate; then
    ps_err "Schema migration failed."
    [ -n "$bak" ] && ps_warn "Your data is safe in the backup: $bak"
    return 1
  fi

  ps_step "Migrating legacy data to the runtime model (cron jobs → schedules)…"
  if ! PS_DATA_DIR="$data_dir" node "$repo/scripts/tooling/migrate-to-runtime.mjs" --apply; then
    ps_warn "Runtime data migration reported issues (non-fatal — schema is migrated; backup retained)."
  fi

  after_baseline="$(find "$data_dir" -maxdepth 1 -name "${db_base}.pre-baseline-*" 2>/dev/null | wc -l | tr -d ' ' || true)"
  after_baseline="${after_baseline:-0}"
  if [ "${after_baseline:-0}" -gt "${before_baseline:-0}" ]; then
    ps_warn "A baseline REBUILD occurred — the previous DB was incompatible and was rebuilt."
    ps_warn "Preserved tables were re-imported; anything not carried over remains in a"
    ps_warn "${db_base}.pre-baseline-* backup under $data_dir. Review it before deleting."
  fi

  ps_ok "Migration complete."
  [ -n "$bak" ] && ps_dim "Pre-migration backup retained: $bak"
  return 0
}
