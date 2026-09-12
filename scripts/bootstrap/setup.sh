#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# PatterStage — Setup Script
# ═══════════════════════════════════════════════════════════════
# Run after cloning the repository (golden path for developers / in-repo install).
#
# Usage:
#   cd PatterStage
#   bash scripts/bootstrap/setup.sh
#
# Prerequisites:
#   - Node.js 20+ (matches CI)
#   - Hermes optional: without ~/.hermes/config.yaml you get a standalone PatterStage
#     (missions/cron tied to Hermes paths will be limited until Hermes is installed).
#
# Environment:
#   CI=1 or PS_INSTALL_NONINTERACTIVE=1 — non-interactive; set PORT or auto-pick 42069–42100
#   PS_SETUP_RUN_TESTS=1 — run `npm test` during setup (CI runs tests automatically)
#   PS_SETUP_SKIP_CATALOG_SEED=1 — skip professional catalog seed (advanced; default seeds on setup)
#   PS_INSTALL_ADVANCED=1 — prompt for PS_DATA_DIR, HERMES_HOME, branch, API key (interactive only)
# ═══════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# shellcheck source=../lib/ps-env.sh
source "$SCRIPT_DIR/../lib/ps-env.sh"
# shellcheck source=../lib/ps-dotenv-local.sh
source "$SCRIPT_DIR/../lib/ps-dotenv-local.sh"
# shellcheck source=../lib/ps-port.sh
source "$SCRIPT_DIR/../lib/ps-port.sh"

echo "╔══════════════════════════════════════════╗"
echo "║       PatterStage — Setup               ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Node.js ────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
    echo "✗ Node.js not found. Please install Node.js 20+ first."
    exit 1
fi
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "✗ Node.js 20+ required (found v$NODE_VERSION)"
    exit 1
fi
echo "✓ Node.js $(node -v)"

# ── PORT + LAN dev origins (.env.local) ───────────────────────
ps_setup_port_and_dev_origins "$REPO_ROOT" || exit 1
PS_PORT_DISPLAY="${PS_SELECTED_PORT}"

ENV_LOCAL="${REPO_ROOT}/.env.local"
ps_load_patterstage_env_local "$REPO_ROOT"

# ── Advanced env (optional; before Hermes detection) ─────────
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
if ! ps_noninteractive_install; then
    if [ "${PS_INSTALL_ADVANCED:-}" = "1" ]; then
        ADVANCED=yes
    else
        read -r -p "Advanced: custom data directory, Hermes home, or update branch? [y/N]: " ADVANCED
        echo ""
    fi
    if [[ "${ADVANCED:-}" =~ ^[Yy]$ ]]; then
        read -r -p "PS_DATA_DIR [${PS_DATA_DIR:-${CH_DATA_DIR:-${CONTROL_HUB_DATA_DIR:-$( [ ! -d "$HOME/patterstage/data" ] && [ -d "$HOME/control-hub/data" ] && echo "$HOME/control-hub/data" || echo "$HOME/patterstage/data" )}}}]: " in_data
        echo ""
        if [ -n "${in_data// /}" ]; then
            export PS_DATA_DIR="${in_data// /}"
            ps_env_set "$ENV_LOCAL" "PS_DATA_DIR" "$PS_DATA_DIR"
        fi
        read -r -p "HERMES_HOME [${HERMES_HOME}]: " in_hm
        echo ""
        if [ -n "${in_hm// /}" ]; then
            export HERMES_HOME="${in_hm// /}"
            ps_env_set "$ENV_LOCAL" "HERMES_HOME" "$HERMES_HOME"
        fi
        read -r -p "PS_UPDATE_GIT_BRANCH for deploy scripts [${PS_UPDATE_GIT_BRANCH:-dev}]: " in_br
        echo ""
        if [ -n "${in_br// /}" ]; then
            ps_env_set "$ENV_LOCAL" "PS_UPDATE_GIT_BRANCH" "${in_br// /}"
        fi
    fi
fi

ps_env_set "$ENV_LOCAL" "HERMES_HOME" "$HERMES_HOME"
# The deploy buttons work on a fresh solo install (decision 17, T-0095). Only
# written when absent, so an operator who turned it off stays off.
ps_env_set_if_absent "$ENV_LOCAL" "PS_ENABLE_DEPLOY_API" "true"
ps_print_hermes_install_paths

# ── Hermes / agent home (optional) ────────────────────────────
HERMES_CONFIGURED=false
if [ -f "$HERMES_HOME/config.yaml" ]; then
    HERMES_CONFIGURED=true
    echo "✓ Hermes config found at $HERMES_HOME/config.yaml"
else
    echo "ℹ  No Hermes config at $HERMES_HOME/config.yaml — standalone mode."
    echo "   Install Hermes and run hermes setup for full gateway, cron, and config editing."
fi

if [ "$HERMES_CONFIGURED" = true ]; then
    echo ""
    if [ -f "$HERMES_HOME/memory_store.db" ]; then
        echo "✓ Holographic memory detected"
    else
        echo "ℹ  Holographic memory not found — Memory page will show an install notice."
        echo "   To enable: hermes plugins install hermes-memory-store"
    fi

    echo ""
    # ── Hermes API Server (required by the PatterStage runtime adapter) ──
    # The runtime dispatches missions as HTTP runs over the Hermes API Server
    # and authenticates with a bearer key. We enable the server and share one
    # key between Hermes (server side) and PatterStage (client side).
    HERMES_ENV="$HERMES_HOME/.env"
    mkdir -p "$HERMES_HOME"
    touch "$HERMES_ENV"

    API_KEY=$(grep -E '^API_SERVER_KEY=' "$HERMES_ENV" 2>/dev/null | tail -1 | cut -d= -f2-)
    if [ -z "$API_KEY" ]; then
        API_KEY=$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")
        echo "" >> "$HERMES_ENV"
        echo "# PatterStage runtime — Hermes API Server bearer key" >> "$HERMES_ENV"
        echo "API_SERVER_KEY=$API_KEY" >> "$HERMES_ENV"
        echo "✓ Generated Hermes API server key"
    fi
    if grep -q "API_SERVER_ENABLED=true" "$HERMES_ENV" 2>/dev/null; then
        echo "✓ Hermes API server already enabled"
    else
        echo "API_SERVER_ENABLED=true" >> "$HERMES_ENV"
        echo "✓ Enabled Hermes API server — restart the gateway to activate"
        echo "  Run: hermes gateway restart  (or: systemctl --user restart hermes-gateway)"
    fi

    # PatterStage authenticates to the gateway with the same key.
    ps_env_set "$ENV_LOCAL" "API_SERVER_KEY" "$API_KEY"
    echo "✓ PatterStage wired to the Hermes API server (shared API_SERVER_KEY)"
fi

# ── Data directories ─────────────────────────────────────────
echo ""
echo "Creating data directories..."
PS_DATA_ROOT="${PS_DATA_DIR:-${CH_DATA_DIR:-${CONTROL_HUB_DATA_DIR:-$( [ ! -d "$HOME/patterstage/data" ] && [ -d "$HOME/control-hub/data" ] && echo "$HOME/control-hub/data" || echo "$HOME/patterstage/data" )}}}"
mkdir -p "$PS_DATA_ROOT/missions"
mkdir -p "$PS_DATA_ROOT/templates"
mkdir -p "$PS_DATA_ROOT/operations"
mkdir -p "$PS_DATA_ROOT/recroom"
mkdir -p "$PS_DATA_ROOT/stories"
mkdir -p "$PS_DATA_ROOT/workspaces" 2>/dev/null || true
mkdir -p "$PS_DATA_ROOT/audit" 2>/dev/null || true
mkdir -p "$PS_DATA_ROOT/scripts" 2>/dev/null || true
mkdir -p "$PS_DATA_ROOT/logs" 2>/dev/null || true
if [ -d "$REPO_ROOT/scripts/hardware" ]; then
    for f in "$REPO_ROOT/scripts/hardware"/*.sh "$REPO_ROOT/scripts/hardware"/*.mjs; do
        [ -f "$f" ] || continue
        base=$(basename "$f")
        if [ ! -f "$PS_DATA_ROOT/scripts/$base" ]; then
            cp "$f" "$PS_DATA_ROOT/scripts/$base" && chmod +x "$PS_DATA_ROOT/scripts/$base"
        fi
    done
fi
if [ "$HERMES_CONFIGURED" = true ]; then
    mkdir -p "$HERMES_HOME/logs"
fi
echo "✓ PatterStage data directories created at $PS_DATA_ROOT"

# ── Discover local Hermes install (hermes-detection.json) ───
if command -v node &>/dev/null && [ -f "$REPO_ROOT/scripts/tooling/discover-agents.mjs" ]; then
    PS_DATA_DIR="$PS_DATA_ROOT" node "$REPO_ROOT/scripts/tooling/discover-agents.mjs" || true
    if [ -f "$PS_DATA_ROOT/hermes-detection.json" ]; then
        if ! grep -q '"valid": true' "$PS_DATA_ROOT/hermes-detection.json" 2>/dev/null; then
            echo "⚠  Hermes install not detected at HERMES_HOME."
            echo "   Install: curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash"
            echo "   Or set HERMES_HOME in .env.local to an existing install (see .env.example)."
        fi
    fi
fi

# ── Scripts executable ───────────────────────────────────────
chmod +x "$SCRIPT_DIR"/*.sh 2>/dev/null || true
chmod +x "$REPO_ROOT/scripts/lib"/*.sh 2>/dev/null || true
chmod +x "$REPO_ROOT/scripts/application"/*.sh 2>/dev/null || true
chmod +x "$REPO_ROOT/scripts/hardware"/*.sh 2>/dev/null || true
echo "✓ Scripts ready"

# ── Dependencies ─────────────────────────────────────────────
echo ""
echo "Installing dependencies..."
npm install
echo "✓ Dependencies installed"

# ── Tests (optional — default skip for faster local setup) ───
if [ "${PS_SETUP_RUN_TESTS:-}" = "1" ] || [ "${CI:-}" = "true" ]; then
    echo ""
    echo "Running tests..."
    if npm test -- --passWithNoTests 2>/dev/null; then
        echo "✓ All tests passed"
    else
        echo "⚠  Some tests failed — check output above"
    fi
else
    echo ""
    echo "ℹ  Skipping tests (set PS_SETUP_RUN_TESTS=1 or CI=true to run during setup)"
fi

# ── Build ─────────────────────────────────────────────────────
echo ""
echo "Building production bundle..."
npm run build
echo "✓ Build complete"

# ── Pre-import: wire Hindsight into config.yaml if installed ──
if [ "$HERMES_CONFIGURED" = true ] && [ -f "$HERMES_HOME/hindsight/config.json" ]; then
  echo ""
  echo "Checking Hindsight memory provider binding…"
  if grep -q "provider: hindsight" "$HERMES_HOME/config.yaml" 2>/dev/null; then
    echo "✓ Hindsight already wired in config.yaml"
  else
    echo "  Hindsight config found but not wired in config.yaml."
    if [ -f "$REPO_ROOT/scripts/bootstrap/setup-hindsight.sh" ]; then
      echo "  Running Hindsight config-wiring step before import…"
      if HERMES_HOME="$HERMES_HOME" bash "$REPO_ROOT/scripts/bootstrap/setup-hindsight.sh" --wire-only; then
        echo "✓ Hindsight wired into config.yaml"
      else
        echo "⚠  Hindsight wire step had issues — memory page may be unavailable"
      fi
    else
      echo "⚠  setup-hindsight.sh not found — cannot wire Hindsight automatically"
    fi
  fi
fi

# ── Database backup + migrate (schema + legacy data) + catalog seed ──
echo ""
echo "Backing up + applying database migrations…"
# shellcheck source=../lib/ps-log.sh
source "$SCRIPT_DIR/../lib/ps-log.sh"
# shellcheck source=../lib/ps-migrate.sh
source "$SCRIPT_DIR/../lib/ps-migrate.sh"
if ! ps_migrate_run "$REPO_ROOT" "$PS_DATA_ROOT"; then
  echo "⚠  Database migration reported issues (a backup was retained) — see output above"
fi

if [ -f "$HERMES_HOME/config.yaml" ]; then
  echo "Importing existing Hermes state into PatterStage SQLite…"
  if PS_DATA_DIR="$PS_DATA_ROOT" HERMES_HOME="$HERMES_HOME" npx tsx "$REPO_ROOT/scripts/tooling/import-hermes-state.ts"; then
    echo "✓ Hermes state imported (root, profiles, skills)"
  else
    echo "⚠  Hermes state import failed — run: npx tsx scripts/tooling/import-hermes-state.ts"
  fi
else
  echo "ℹ  Hermes config not found — seeding PatterStage defaults only"
fi

RUN_CATALOG_SEED=true
if [ "${PS_SETUP_SKIP_CATALOG_SEED:-}" = "1" ]; then
  RUN_CATALOG_SEED=false
  echo "ℹ  Skipping catalog seed (PS_SETUP_SKIP_CATALOG_SEED=1)"
elif [ -t 0 ] && [ "${CI:-}" != "true" ] && [ "${PS_INSTALL_NONINTERACTIVE:-}" != "1" ]; then
  echo ""
  echo "Professional catalog: six agent profiles + mission templates (SQLite + Hermes push when configured)."
  read -r -p "Install/refresh professional catalog now? [Y/n]: " REPLY_CATALOG
  echo ""
  if [[ "$REPLY_CATALOG" =~ ^[Nn]$ ]]; then
    RUN_CATALOG_SEED=false
    echo "ℹ  Catalog seed skipped — run: npx tsx scripts/tooling/seed-catalog.ts --merge"
  fi
fi

if [ "$RUN_CATALOG_SEED" = true ]; then
  echo "Seeding professional catalog (merge)…"
  if npx tsx "$REPO_ROOT/scripts/tooling/seed-catalog.ts" --merge; then
    echo "✓ Catalog seeded (profiles + templates in PatterStage; pushed to HERMES_HOME when ready)"
  else
    echo "⚠  Catalog seed failed — run: npx tsx scripts/tooling/seed-catalog.ts --merge"
  fi
fi

if [ -f "$HERMES_HOME/config.yaml" ]; then
  echo "Syncing model defaults to Hermes config.yaml…"
  if PS_DATA_DIR="$PS_DATA_ROOT" HERMES_HOME="$HERMES_HOME" npx tsx "$REPO_ROOT/scripts/tooling/ensure-hermes-model-sync.ts"; then
    echo "✓ Model defaults applied to config.yaml (when agent default is set in registry)"
  else
    echo "⚠  Model sync skipped or failed — set agent default under Config → Models"
  fi
fi

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║       Setup Complete!                    ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "PORT (PatterStage):     $PS_PORT_DISPLAY"
echo "PS_DATA_DIR:            $PS_DATA_ROOT"
echo "HERMES_HOME:            $HERMES_HOME"
echo "Hermes integrated:     $HERMES_CONFIGURED"
echo ""
echo "Start the server:"
echo "  npm run start          # bind per package.json / .env.local"
echo "  npm run start:network  # 0.0.0.0 (LAN)"
echo ""
echo "Local URL:  http://127.0.0.1:${PS_PORT_DISPLAY}/"
echo "LAN: use http://<this-host-ip>:${PS_PORT_DISPLAY}/ or http://<hostname>.local:${PS_PORT_DISPLAY}/"
echo ""
# The bare URL above answers 401 by design: PatterStage mints a random access
# token on its FIRST BOOT, which has not happened yet at setup time. Sending an
# operator to a URL that rejects them without saying why is how a first install
# dies, so name the token, the file and the recovery here.
echo "First open needs your access token:"
echo "  The server mints one on first boot and prints the full sign-in URL:"
echo "    [auth] Open PatterStage at http://127.0.0.1:${PS_PORT_DISPLAY}/?ps_token=<token>"
echo "  Open that URL once; PatterStage swaps it for a session cookie."
echo "  Lost it? The token is the single line in ${PS_DATA_ROOT}/auth-token,"
echo "  and every restart prints the URL again. See docs/SECURITY.md."
echo ""
echo "Development (hot reload):"
echo "  npm run dev            # PORT and PS_ALLOWED_DEV_ORIGINS come from .env.local"
echo ""
echo "Deploy / update:"
echo "  bash scripts/application/ps-deploy.sh update   (branch: PS_UPDATE_GIT_BRANCH in .env.local, default dev)"
echo ""
