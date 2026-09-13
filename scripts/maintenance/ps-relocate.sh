#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# PatterStage — guided one-time relocation: ~/control-hub → ~/patterstage
#
# Moves an existing bootstrap install (repo + data dir) to the new default
# location. Run this MANUALLY with the app stopped — a running deploy cannot
# safely relocate its own checkout, so this is intentionally not automatic.
# Existing installs keep working at ~/control-hub without it (the resolver
# falls back); this just completes the cosmetic move to ~/patterstage.
#
#   bash scripts/maintenance/ps-relocate.sh             # ~/control-hub → ~/patterstage
#   OLD=/path NEW=/path bash scripts/maintenance/ps-relocate.sh
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

OLD="${OLD:-$HOME/control-hub}"
NEW="${NEW:-$HOME/patterstage}"

say() { echo "  $*"; }

echo "PatterStage relocate: $OLD → $NEW"

if [ ! -d "$OLD" ]; then
  say "Nothing to do — $OLD does not exist."
  exit 0
fi
if [ -e "$NEW" ]; then
  say "ERROR: target $NEW already exists. Move or remove it first."
  exit 1
fi

# Best-effort guard: refuse while a server is listening on the configured port.
PORT_GUESS="$(grep -E '^PORT=' "$OLD/.env.local" 2>/dev/null | tail -1 | cut -d= -f2- || true)"
if [ -n "${PORT_GUESS:-}" ] && command -v lsof >/dev/null 2>&1 && lsof -ti:"$PORT_GUESS" >/dev/null 2>&1; then
  say "ERROR: something is listening on port $PORT_GUESS. Stop PatterStage first:"
  say "  bash $OLD/scripts/bootstrap/stop.sh"
  exit 1
fi

# Step out of the way of our own CWD before moving the tree.
cd "$HOME"
mv "$OLD" "$NEW"
say "Moved $OLD → $NEW"

# Repoint .env.local paths to NEW and rename CH_* keys → PS_*.
ENV_FILE="$NEW/.env.local"
if [ -f "$ENV_FILE" ]; then
  tmp="$(mktemp)"
  sed -E "s#$OLD#$NEW#g; s/^CH_/PS_/" "$ENV_FILE" >"$tmp" && mv "$tmp" "$ENV_FILE"
  grep -q '^PS_RENAMED=' "$ENV_FILE" 2>/dev/null || echo "PS_RENAMED=1" >>"$ENV_FILE"
  say "Updated $ENV_FILE (paths + CH_→PS_ keys)"
fi

# Rename the DB file in place if still legacy-named.
DATA_DIR="$NEW/data"
if [ -f "$DATA_DIR/control-hub.db" ] && [ ! -f "$DATA_DIR/patterstage.db" ]; then
  mv "$DATA_DIR/control-hub.db" "$DATA_DIR/patterstage.db" 2>/dev/null || true
  for s in -wal -shm; do
    [ -f "$DATA_DIR/control-hub.db$s" ] && mv "$DATA_DIR/control-hub.db$s" "$DATA_DIR/patterstage.db$s" 2>/dev/null || true
  done
  say "Renamed control-hub.db → patterstage.db"
fi

echo ""
echo "Done. Next:"
echo "  cd $NEW"
echo "  bash scripts/application/ps-deploy.sh restart   # or your normal start command"
echo ""
echo "If you scheduled host (hardware) cron scripts, update any crontab entries that"
echo "referenced $OLD/data/scripts/ to $NEW/data/scripts/ — the scripts moved with the"
echo "data dir, so the old paths no longer exist."
