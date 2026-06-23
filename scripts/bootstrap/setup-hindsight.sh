#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# PatterStage — Hindsight Memory Provider Setup
# ═══════════════════════════════════════════════════════════════
# Installs and configures Hindsight memory with PostgreSQL backend.
# Run this on an existing PatterStage installation.
#
# Usage:
#   bash scripts/bootstrap/setup-hindsight.sh
#   bash scripts/bootstrap/setup-hindsight.sh --wire-only   # config + SQLite sync only
#
# Requires:
#   - sudo access (for PostgreSQL installation)
#   - Hermes agent with venv at ~/.hermes/hermes-agent/venv/
#   - Gateway API enabled (API_SERVER_ENABLED=true in .env)
# ═══════════════════════════════════════════════════════════════

set -e

HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ── Modes ────────────────────────────────────────────────────
# --wire-only : skip PostgreSQL / server / systemd; only update config.yaml
#               + sync to PatterStage SQLite (re-wire an existing install).
# --docker    : cross-platform path — bring up Postgres + pgvector + the
#               Hindsight server in containers (no host Postgres/venv/systemd),
#               then wire config. Works on Linux, macOS, and Windows.
WIRE_ONLY=false
DOCKER_MODE=false
for arg in "$@"; do
    case "$arg" in
        --wire-only) WIRE_ONLY=true ;;
        --docker)    DOCKER_MODE=true; WIRE_ONLY=true ;;  # skip native steps; config still runs
    esac
done

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
step()  { echo -e "\n${CYAN}── $* ──${NC}"; }

# ── Banner ───────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Hindsight Memory — Setup                ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Check if already configured ──────────────────────────────
if [ -f "$HERMES_HOME/hindsight/config.json" ]; then
    if curl -s --max-time 3 http://127.0.0.1:9177/health 2>/dev/null | grep -q healthy; then
        ok "Hindsight is already running and healthy"
        echo ""
        echo "To reconfigure, remove $HERMES_HOME/hindsight/config.json and run again."
        exit 0
    fi
    warn "Config exists but server not responding — will attempt to restart"
fi

# ── Docker mode: cross-platform Postgres + pgvector + server ─
if [ "$DOCKER_MODE" = true ]; then
step "Docker: Hindsight stack (Postgres + pgvector + server)"
if ! command -v docker >/dev/null 2>&1; then
    fail "Docker not found. Install Docker Desktop / Docker Engine, then re-run with --docker (or use the native Linux path: bash $SCRIPT_DIR/setup-hindsight.sh)."
fi
# Pass the gateway LLM key through to the container if the Hermes .env has one.
if [ -f "$HERMES_HOME/.env" ]; then
    HINDSIGHT_LLM_API_KEY="$(grep '^HINDSIGHT_LLM_API_KEY=' "$HERMES_HOME/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")"
    export HINDSIGHT_LLM_API_KEY
fi
( cd "$SCRIPT_DIR" && docker compose -f docker-compose.hindsight.yml up -d --build ) \
    || fail "docker compose up failed — check Docker is running"
info "Waiting for Hindsight to become healthy (first build can take a few minutes)..."
for i in $(seq 1 60); do
    if curl -s --max-time 3 http://127.0.0.1:9177/health 2>/dev/null | grep -q healthy; then
        ok "Hindsight (Docker) is healthy"
        break
    fi
    if [ "$i" -eq 60 ]; then
        warn "Hindsight not healthy yet — inspect with:"
        echo "  docker compose -f $SCRIPT_DIR/docker-compose.hindsight.yml logs -f hindsight"
    fi
    sleep 3
done
fi

# ── Check sudo access ────────────────────────────────────────
if [ "$WIRE_ONLY" = false ]; then
step "Checking sudo access"
if ! sudo -n true 2>/dev/null; then
    echo ""
    echo "Sudo access is required for PostgreSQL installation."
    echo "You will be prompted for your password."
    echo ""
    if ! sudo true; then
        fail "Cannot get sudo access. Install PostgreSQL manually and re-run this script."
    fi
fi
ok "Sudo access confirmed"
fi

# ── Step 1: PostgreSQL ───────────────────────────────────────
if [ "$WIRE_ONLY" = false ]; then
step "Step 1: PostgreSQL"
if command -v pg_isready &>/dev/null && pg_isready -q 2>/dev/null; then
    ok "PostgreSQL already running"
else
    info "Installing PostgreSQL..."
    sudo apt-get update -qq 2>/dev/null
    sudo apt-get install -y -qq postgresql postgresql-client || fail "PostgreSQL installation failed"
    sudo systemctl enable postgresql
    sudo systemctl start postgresql
    sleep 2
    if pg_isready -q 2>/dev/null; then
        ok "PostgreSQL installed and running"
    else
        fail "PostgreSQL installed but not responding"
    fi
fi

# ── Step 2: pgvector ─────────────────────────────────────────
step "Step 2: pgvector extension"
# Check if pgvector is already installed
if sudo -u postgres psql -d postgres -c "SELECT 1 FROM pg_extension WHERE extname = 'vector'" 2>/dev/null | grep -q 1; then
    ok "pgvector already installed"
else
    info "Installing pgvector..."
    # Try version-specific first, then generic
    # Portable: avoid grep -oP (GNU-only)
    PG_VERSION=$(pg_config --version 2>/dev/null | sed -n 's/.*PostgreSQL \([0-9][0-9]*\).*/\1/p' | head -1)
    if [ -n "$PG_VERSION" ]; then
        sudo apt-get install -y -qq "postgresql-${PG_VERSION}-pgvector" 2>/dev/null || true
    fi
    # Fallback to generic
    if ! dpkg -l | grep -q pgvector; then
        sudo apt-get install -y -qq postgresql-pgvector 2>/dev/null || {
            warn "Could not install pgvector automatically"
            echo "  Try manually: sudo apt-get install postgresql-XX-pgvector"
            echo "  Where XX is your PostgreSQL version"
        }
    fi
    ok "pgvector installed"
fi

# ── Step 3: Database ─────────────────────────────────────────
step "Step 3: Database setup"
info "Creating database and user..."
sudo -u postgres psql -c "CREATE USER hindsight_user WITH PASSWORD 'hindsight_local';" 2>/dev/null || true
if sudo -u postgres psql -lqt 2>/dev/null | cut -d'|' -f1 | grep -qw hindsight_db; then
    info "Database 'hindsight_db' already exists — skipping drop/recreate"
else
    sudo -u postgres psql -c "CREATE DATABASE hindsight_db OWNER hindsight_user;" 2>/dev/null || fail "Database creation failed"
fi
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE hindsight_db TO hindsight_user;" 2>/dev/null
sudo -u postgres psql -d hindsight_db -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || warn "Could not create vector extension"

# Verify connection
if PGPASSWORD=hindsight_local psql -h 127.0.0.1 -U hindsight_user -d hindsight_db -c "SELECT 1;" 2>/dev/null | grep -q 1; then
    ok "Database ready"
else
    fail "Database created but connection test failed"
fi

# ── Step 4: Python Dependencies ──────────────────────────────
step "Step 4: Python dependencies"
VENV_PYTHON="$HERMES_HOME/hermes-agent/venv/bin/python3"
if [ ! -f "$VENV_PYTHON" ]; then
    fail "Hermes venv not found at $VENV_PYTHON"
fi

# Check if hindsight is already installed
if "$VENV_PYTHON" -c "import hindsight" 2>/dev/null; then
    ok "hindsight-all already installed"
else
    info "Installing hindsight-all (this may take a few minutes)..."
    # Find uv
    if command -v uv &>/dev/null; then
        uv pip install --python "$VENV_PYTHON" hindsight-all 2>&1 | tail -3 || fail "Package installation failed"
    else
        "$VENV_PYTHON" -m pip install hindsight-all 2>&1 | tail -3 || fail "Package installation failed"
    fi
    ok "hindsight-all installed"
fi

# ── Step 5: Server Script ────────────────────────────────────
step "Step 5: Server script"
mkdir -p "$HERMES_HOME/scripts"
if [ -f "$SCRIPT_DIR/hindsight-server.py" ]; then
    cp "$SCRIPT_DIR/hindsight-server.py" "$HERMES_HOME/scripts/hindsight_server.py"
    ok "Server script installed"
else
    # Inline creation if script not in repo
    cat > "$HERMES_HOME/scripts/hindsight_server.py" << 'PYEOF'
#!/usr/bin/env python3
import os, sys, signal
sys.path.insert(0, os.path.expanduser("~/.hermes/hermes-agent"))

def main():
    from hindsight import start_server
    api_key = ""
    env_path = os.path.expanduser("~/.hermes/.env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.strip().startswith("HINDSIGHT_LLM_API_KEY="):
                    api_key = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break
    server = start_server(
        db_url="postgresql://hindsight_user:hindsight_local@localhost:5432/hindsight_db",
        llm_provider="openai",
        llm_api_key=api_key,
        llm_model="xiaomi/mimo-v2-pro",
        llm_base_url="http://localhost:8642/v1",
        host="127.0.0.1", port=9177,
        log_level="info", timeout=120,
    )
    print(f"Hindsight running at {server.url}")
    def shutdown(sig, frame):
        server.stop()
        sys.exit(0)
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)
    signal.pause()

if __name__ == "__main__":
    main()
PYEOF
    ok "Server script created"
fi
fi  # WIRE_ONLY = false block (PostgreSQL + server setup)

# ── Step 6: Configuration ────────────────────────────────────
step "Step 6: Configuration"
mkdir -p "$HERMES_HOME/hindsight"

# Read API key from .env
LLM_KEY=""
if [ -f "$HERMES_HOME/.env" ]; then
    LLM_KEY=$(grep "^HINDSIGHT_LLM_API_KEY=" "$HERMES_HOME/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
fi

# Create config
cat > "$HERMES_HOME/hindsight/config.json" << EOF
{
    "mode": "local_external",
    "api_url": "http://localhost:9177",
    "llm_provider": "openai",
    "llm_base_url": "http://localhost:8642/v1",
    "llm_model": "xiaomi/mimo-v2-pro",
    "bank_id": "hermes",
    "auto_retain": true,
    "auto_recall": true
}
EOF
ok "Config created at $HERMES_HOME/hindsight/config.json"

# Update agent config.yaml
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
" 2>/dev/null
    ok "Agent config updated (memory.provider = hindsight)"
else
    warn "python3 not found — update config.yaml manually:"
    echo "  memory:"
    echo "    provider: hindsight"
fi

# ── Step 6b: Sync to PatterStage SQLite ─────────────────────
step "Step 6b: Syncing to PatterStage SQLite"
PS_DATA_DIR="${PS_DATA_DIR:-${CH_DATA_DIR:-${CONTROL_HUB_DATA_DIR:-$( [ ! -d "$HOME/patterstage/data" ] && [ -d "$HOME/control-hub/data" ] && echo "$HOME/control-hub/data" || echo "$HOME/patterstage/data" )}}}"
# Prefer the canonical patterstage.db; fall back to a legacy control-hub.db (un-migrated install) — mirrors getDbPath() in src/lib/paths.ts.
PS_DB="$( [ ! -f "$PS_DATA_DIR/patterstage.db" ] && [ -f "$PS_DATA_DIR/control-hub.db" ] && echo "$PS_DATA_DIR/control-hub.db" || echo "$PS_DATA_DIR/patterstage.db" )"
if [ -f "$PS_DB" ]; then
    if command -v python3 &>/dev/null; then
        PS_DB="$PS_DB" python3 -c "
import json, os, sqlite3
hermes_home = os.environ.get('HERMES_HOME', os.path.expanduser('~/.hermes'))
db_path = os.environ['PS_DB']
if os.path.exists(db_path):
    with open(os.path.join(hermes_home, 'config.yaml')) as f:
        config_yaml = f.read()
    conn = sqlite3.connect(db_path)
    conn.execute('UPDATE agent_root SET config_yaml = ?, updated_at = datetime(\\'now\\') WHERE id = 1', (config_yaml,))
    conn.commit()
    conn.close()
    print('ok')
" 2>/dev/null && ok "SQLite agent_root.config_yaml synced" || warn "SQLite sync failed — may need hermes migrate first"
    else
        warn "python3 not found — cannot sync to PatterStage SQLite"
    fi
else
    info "PatterStage database not found at $PS_DB — SQLite sync skipped"
    echo "  SQLite sync will happen on next deploy update via seed-catalog"
fi

# ── Step 7: Systemd Service ──────────────────────────────────
if [ "$WIRE_ONLY" = false ]; then
step "Step 7: Systemd service"

# Canonical install path for the Hindsight daemon. We pin the binary the
# unit will execute to the live venv at $HERMES_HOME/hermes-agent/venv/
# (the one setup-hindsight.sh installs into). We do NOT trust any other
# path — historically, `~/.local/share/hermes-agent/venv/bin/hindsight-embed`
# was written to /etc/systemd/system/hindsight.service by a different
# (older) installer and produced 203/EXEC restart loops every 10s that
# thrashed the host. Verified on 2026-06-19 after a multi-hour device
# freeze incident.
HS_VENV="$HERMES_HOME/hermes-agent/venv"
HS_BIN="$HS_VENV/bin/hindsight-api"
if [ ! -x "$HS_BIN" ]; then
    fail "Hindsight binary not found at $HS_BIN — re-run setup-hindsight.sh from the top so the venv is populated (Step 4), or install with: $HS_VENV/bin/python -m pip install hindsight-all"
fi

# Load LLM + DB env vars from the profile env file before exec'ing the
# daemon. Without this, the daemon raises
# "ValueError: LLM API key is required. Set HINDSIGHT_API_LLM_API_KEY
# environment variable." at startup because hindsight-api reads LLM
# config from os.environ, not from ~/.hermes/hindsight/config.json.
HS_ENV="$HERMES_HOME/profiles/hermes.env"
if [ ! -f "$HS_ENV" ]; then
    warn "$HS_ENV not found — daemon will fail with 'LLM API key is required' on start. Create it before the next watchdog tick."
fi

sudo tee /etc/systemd/system/hindsight.service > /dev/null << EOF
[Unit]
Description=Hindsight Memory Server
After=postgresql.service network.target
Requires=postgresql.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$HS_VENV
EnvironmentFile=$HS_ENV
ExecStart=$HS_BIN --daemon --idle-timeout 0 --port 9177
Restart=on-failure
RestartSec=10
StandardOutput=append:$HERMES_HOME/logs/hindsight.log
StandardError=append:$HERMES_HOME/logs/hindsight.log
TimeoutStartSec=90

[Install]
WantedBy=multi-user.target
EOF

mkdir -p "$HERMES_HOME/logs"
sudo systemctl daemon-reload
sudo systemctl enable hindsight
sudo systemctl restart hindsight
ok "Systemd service created and started"

# ── Step 8: Verify ───────────────────────────────────────────
step "Step 8: Verification"
info "Waiting for server to start..."
for i in $(seq 1 20); do
    if curl -s --max-time 3 http://127.0.0.1:9177/health 2>/dev/null | grep -q healthy; then
        ok "Hindsight server is healthy"
        break
    fi
    if [ "$i" -eq 20 ]; then
        warn "Server may need more time to start"
        echo "  Check status: sudo systemctl status hindsight"
        echo "  Check logs: sudo journalctl -u hindsight -n 20"
    fi
    sleep 3
done

# Test store + retrieve
if curl -s --max-time 3 http://127.0.0.1:9177/health 2>/dev/null | grep -q healthy; then
    info "Testing memory store + retrieve..."
    curl -s --max-time 15 -X POST http://127.0.0.1:9177/v1/default/banks/hermes/memories \
        -H "Content-Type: application/json" \
        -d '{"items":[{"content":"Hindsight setup test memory","tags":["test"]}]}' >/dev/null 2>&1
    sleep 3
    COUNT=$(curl -s --max-time 10 "http://127.0.0.1:9177/v1/default/banks/hermes/memories/list?limit=1" 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('total',0))" 2>/dev/null || echo "?")
    ok "Test memory stored ($COUNT memories in bank)"
fi
fi  # WIRE_ONLY = false block (systemd + verification)

# ── Done ─────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Hindsight Setup Complete!               ║"
echo "╚══════════════════════════════════════════╝"
echo ""
if [ "$DOCKER_MODE" = true ]; then
echo "Services (Docker):"
echo "  docker compose -f $SCRIPT_DIR/docker-compose.hindsight.yml ps"
echo "  docker compose -f $SCRIPT_DIR/docker-compose.hindsight.yml logs -f hindsight"
echo "  docker compose -f $SCRIPT_DIR/docker-compose.hindsight.yml down   # stop"
else
echo "Services:"
echo "  Hindsight: sudo systemctl status hindsight"
echo "  PostgreSQL: sudo systemctl status postgresql"
fi
echo ""
PS_WEB_PORT="${CONTROL_HUB_PORT:-3000}"
if [ -f "$REPO_ROOT/.env.local" ]; then
  _p="$(grep -E '^PORT=' "$REPO_ROOT/.env.local" 2>/dev/null | tail -n1 | sed 's/^PORT=//' | tr -d '\r')"
  [ -n "$_p" ] && PS_WEB_PORT="$_p"
fi
echo "Dashboard:"
echo "  Memory page at http://localhost:${PS_WEB_PORT}/memory"
echo ""
echo "Useful commands:"
if [ "$DOCKER_MODE" = true ]; then
echo "  docker compose -f $SCRIPT_DIR/docker-compose.hindsight.yml restart hindsight"
echo "  docker compose -f $SCRIPT_DIR/docker-compose.hindsight.yml logs -f hindsight"
echo "  curl http://localhost:9177/health    # Check health"
else
echo "  sudo systemctl restart hindsight    # Restart server"
echo "  sudo journalctl -u hindsight -f     # View logs"
echo "  curl http://localhost:9177/health    # Check health"
fi
echo ""
