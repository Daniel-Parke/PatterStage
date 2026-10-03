#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# reconnect-hindsight.sh — Reconnect Hindsight memory to Hermes
# ═══════════════════════════════════════════════════════════════
#
# Run this after a deploy update that may have stripped the
# Hindsight memory configuration from ~/.hermes/config.yaml.
# It re-wires the memory: and plugins:hindsight: sections and
# syncs the result to the PatterStage SQLite database so
# subsequent pushes preserve it.
#
# Usage:
#   bash scripts/hardware/reconnect-hindsight.sh
#
# No prerequisites beyond an existing Hindsight installation.
# ═══════════════════════════════════════════════════════════════

set -e

HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
PS_DATA_DIR="${PS_DATA_DIR:-${CH_DATA_DIR:-${CONTROL_HUB_DATA_DIR:-$( [ ! -d "$HOME/patterstage/data" ] && [ -d "$HOME/control-hub/data" ] && echo "$HOME/control-hub/data" || echo "$HOME/patterstage/data" )}}}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ── Helpers ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}ℹ${NC}  $*"; }
ok()    { echo -e "${GREEN}✓${NC}  $*"; }
warn()  { echo -e "${YELLOW}⚠${NC}  $*"; }
fail()  { echo -e "${RED}✗${NC}  $*"; exit 1; }

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Hindsight — Reconnect                   ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Validate ───────────────────────────────────────────────
if [ ! -f "$HERMES_HOME/hindsight/config.json" ]; then
    fail "Hindsight config not found at $HERMES_HOME/hindsight/config.json"
    echo "  Install Hindsight first:"
    echo "    bash $REPO_ROOT/scripts/bootstrap/setup-hindsight.sh"
    exit 1
fi
ok "Hindsight config found at $HERMES_HOME/hindsight/config.json"

if [ ! -f "$HERMES_HOME/config.yaml" ]; then
    fail "Hermes config not found at $HERMES_HOME/config.yaml"
    echo "  Run Hermes setup first."
    exit 1
fi
ok "Hermes config found at $HERMES_HOME/config.yaml"

# ── Re-wire config.yaml ────────────────────────────────────
if grep -q "provider: hindsight" "$HERMES_HOME/config.yaml" 2>/dev/null; then
    ok "Hindsight already wired in config.yaml"
else
    info "Adding Hindsight memory provider to config.yaml..."
    if command -v python3 &>/dev/null; then
        python3 -c "
import yaml
path = '$HERMES_HOME/config.yaml'
with open(path) as f:
    config = yaml.safe_load(f) or {}
config.setdefault('memory', {})
config['memory']['provider'] = 'hindsight'
config['memory']['memory_enabled'] = True
config.setdefault('plugins', {}).setdefault('hindsight', {})
config['plugins']['hindsight'].update({
    'auto_retain': True,
    'auto_recall': True,
    'mode': 'local_external',
    'api_url': 'http://localhost:9177',
    'llm_provider': 'openai',
})
with open(path, 'w') as f:
    yaml.dump(config, f, default_flow_style=False, sort_keys=False)
print('ok')
" && ok "config.yaml updated with Hindsight memory provider" || fail "Failed to update config.yaml"
    else
        fail "python3 not found — cannot update config.yaml"
    fi
fi

# ── Sync to PatterStage SQLite ────────────────────────────
# Prefer the canonical patterstage.db; fall back to a legacy control-hub.db — mirrors getDbPath() in src/lib/paths.ts.
PS_DB="$( [ ! -f "$PS_DATA_DIR/patterstage.db" ] && [ -f "$PS_DATA_DIR/control-hub.db" ] && echo "$PS_DATA_DIR/control-hub.db" || echo "$PS_DATA_DIR/patterstage.db" )"
if [ -f "$PS_DB" ]; then
    info "Syncing to PatterStage SQLite..."
    if command -v python3 &>/dev/null; then
        PS_DB="$PS_DB" python3 -c "
import os, sqlite3
hermes_home = os.environ.get('HERMES_HOME', os.path.expanduser('~/.hermes'))
db_path = os.environ['PS_DB']
config_path = os.path.join(hermes_home, 'config.yaml')
if os.path.exists(db_path) and os.path.exists(config_path):
    with open(config_path) as f:
        config_yaml = f.read()
    conn = sqlite3.connect(db_path)
    conn.execute('UPDATE agent_root SET config_yaml = ?, updated_at = datetime(\"now\") WHERE id = 1', (config_yaml,))
    conn.commit()
    conn.close()
    print('ok')
" && ok "SQLite agent_root.config_yaml synced" || warn "SQLite sync failed"
    else
        warn "python3 not found — SQLite sync skipped"
    fi
else
    info "PatterStage database not found at $PS_DB — SQLite sync skipped"
    echo "  SQLite sync will happen on the next deploy update."
fi

# ── Summary ────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Hindsight Reconnect Complete!           ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Memory provider is now wired in config.yaml and synced to SQLite."
echo ""
echo "If the dashboard still shows 0 memories, restart the server:"
echo "  cd $REPO_ROOT && npm run restart"
echo ""
echo "To verify: curl http://localhost:9177/health"
echo ""
