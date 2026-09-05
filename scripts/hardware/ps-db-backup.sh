#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# ps-db-backup.sh — snapshot the PatterStage SQLite DB + rotate
# ═══════════════════════════════════════════════════════════════
# Copies control-hub.db to a timestamped backup and prunes old backups.
# Uses the SQLite .backup command when available (consistent online copy),
# else a plain cp. Safe: only writes into the backups dir, only deletes
# its OWN rotated backups beyond the retention count.
#
# Environment (defaults in parentheses):
#   PS_DATA_DIR        ($HOME/control-hub/data)
#   PS_DB_BACKUP_DIR   ($PS_DATA_DIR/backups/db)
#   PS_DB_BACKUP_KEEP  (14)

set -euo pipefail

PS_DATA_DIR="${PS_DATA_DIR:-${CH_DATA_DIR:-${CONTROL_HUB_DATA_DIR:-$( [ ! -d "$HOME/patterstage/data" ] && [ -d "$HOME/control-hub/data" ] && echo "$HOME/control-hub/data" || echo "$HOME/patterstage/data" )}}}"
# Prefer patterstage.db; fall back to a legacy control-hub.db (un-migrated).
DB="$PS_DATA_DIR/$( [ ! -f "$PS_DATA_DIR/patterstage.db" ] && [ -f "$PS_DATA_DIR/control-hub.db" ] && echo control-hub.db || echo patterstage.db )"
DB_BASE="$(basename "$DB" .db)"
BACKUP_DIR="${PS_DB_BACKUP_DIR:-$PS_DATA_DIR/backups/db}"
KEEP="${PS_DB_BACKUP_KEEP:-14}"

log() { echo "[$(date -Iseconds 2>/dev/null || date)] [ps-db-backup] $*"; }

if [ ! -f "$DB" ]; then
  log "ERROR: database not found: $DB"
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$BACKUP_DIR/$DB_BASE.$TS.db"

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB" ".backup '$DEST'"
  log "sqlite .backup → $DEST"
else
  cp "$DB" "$DEST"
  log "cp → $DEST"
fi

# Rotate: keep the newest $KEEP, delete the rest (only our own snapshots).
COUNT=$(ls -1 "$BACKUP_DIR/$DB_BASE".*.db 2>/dev/null | wc -l | tr -d ' ')
if [ "$COUNT" -gt "$KEEP" ]; then
  ls -1t "$BACKUP_DIR/$DB_BASE".*.db | tail -n +"$((KEEP + 1))" | while read -r old; do
    rm -f "$old" && log "pruned $old"
  done
fi

log "backup complete ($COUNT snapshot(s), keeping $KEEP)"
