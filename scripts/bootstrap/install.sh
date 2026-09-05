#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# PatterStage — Install Script
# ═══════════════════════════════════════════════════════════════
# One-command installer for PatterStage (OSS control plane for the Hermes Agent).
# Handles fresh install, re-install, optional Hermes bootstrap (two-pass), and Hindsight.
#
# Usage:
#   Bootstrap (clones to INSTALL_DIR, default ~/patterstage):
#     bash path/to/scripts/bootstrap/install.sh
#   Already cloned this repo (runs setup only):
#     bash scripts/bootstrap/install.sh --in-repo
#   Typical developer path after git clone:
#     bash scripts/bootstrap/setup.sh
#
# Environment (non-interactive / CI / VPS):
#   PS_INSTALL_NONINTERACTIVE=1  or  CI=1
#     Requires either a working `hermes` on PATH, or:
#     INSTALL_HERMES=yes   — run upstream Hermes install + `hermes setup`, then exit (re-run this script after)
#     INSTALL_HERMES=no    — continue without Hermes CLI (limited profile/gateway steps)
# Bundled Hermes profile templates (SOUL.md / AGENTS.md under HERMES_HOME/profiles/, default ~/.hermes):
#   INSTALL_HERMES_PROFILE_TEMPLATES=yes — install missing template files (never overwrites existing)
#   unset / no — skip in CI/non-interactive; interactive prompts [y/N] when unset
#   HERMES_HOME — override Hermes root (default $HOME/.hermes); optional Hermes profile step requires config.yaml there
#
# Hermes two-pass: if you choose to install Hermes when prompted, this script runs the official
# installer and `hermes setup`, then exits — run install.sh again to finish PatterStage setup.
#
# Override: INSTALL_DIR=/path/to/hub bash scripts/bootstrap/install.sh
# Git branch for initial clone only: BRANCH=dev (default). Ongoing deploy pulls use
# PS_UPDATE_GIT_BRANCH in .env.local (see scripts/application/ps-deploy.sh), not BRANCH.
# Prerequisites: Node.js 20+, git. Hermes recommended (see prompts). macOS and Linux only.
# ═══════════════════════════════════════════════════════════════

set -e

IN_REPO=false
while [ "${1:-}" = "--in-repo" ]; do
    IN_REPO=true
    shift
done

REPO_URL="${REPO_URL:-https://github.com/Daniel-Parke/PatterStage.git}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/patterstage}"
BRANCH="${BRANCH:-dev}"

SCRIPT_PATH="${BASH_SOURCE[0]:-$0}"
SCRIPT_REPO_ROOT="$(cd "$(dirname "$SCRIPT_PATH")/../.." && pwd -P)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}ℹ${NC}  $*"; }
ok()    { echo -e "${GREEN}✓${NC}  $*"; }
warn()  { echo -e "${YELLOW}⚠${NC}  $*"; }
fail()  { echo -e "${RED}✗${NC}  $*"; exit 1; }

hermes_cli_ok() {
  command -v hermes &>/dev/null && hermes --version &>/dev/null
}

noninteractive() {
  [[ "${CI:-}" == "1" || "${PS_INSTALL_NONINTERACTIVE:-}" == "1" ]]
}

HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
HERMES_INSTALL_URL="https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh"

# shellcheck source=../lib/ps-env.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../lib" && pwd)/ps-env.sh"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../lib" && pwd)/ps-reinstall.sh"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   PatterStage — Installer                 ║"
echo "╚══════════════════════════════════════════╝"
echo ""
ps_print_hermes_install_paths

if [ "$IN_REPO" = true ]; then
    if ! command -v node &>/dev/null; then
        fail "Node.js not found. Install Node.js 20+ first: https://nodejs.org"
    fi
    info "Running in-repo setup from $SCRIPT_REPO_ROOT"
    cd "$SCRIPT_REPO_ROOT"
    bash scripts/bootstrap/setup.sh

    # shellcheck source=../lib/ps-dotenv-local.sh
    source "$SCRIPT_REPO_ROOT/scripts/lib/ps-dotenv-local.sh"
    ps_load_patterstage_env_local "$SCRIPT_REPO_ROOT"
    # shellcheck source=../lib/ps-hermes-profile-templates.sh
    source "$SCRIPT_REPO_ROOT/scripts/lib/ps-hermes-profile-templates.sh"
    ps_resolve_hermes_home

    if ! ps_hermes_config_present; then
        info "Skipping optional Hermes profile templates (no $HERMES_HOME/config.yaml). Run Hermes setup, then re-run install or apply templates from data/seed/profiles/."
    else
        run_profile_templates=false
        if noninteractive; then
            case "${INSTALL_HERMES_PROFILE_TEMPLATES:-}" in
                yes|YES|1|true|True)
                    run_profile_templates=true
                    ;;
                *)
                    info "Skipping bundled Hermes profile templates (non-interactive; set INSTALL_HERMES_PROFILE_TEMPLATES=yes to install)."
                    ;;
            esac
        else
            case "${INSTALL_HERMES_PROFILE_TEMPLATES:-}" in
                yes|YES|1|true|True)
                    run_profile_templates=true
                    ;;
                no|NO|0|false|False)
                    info "Skipping bundled Hermes profile templates (INSTALL_HERMES_PROFILE_TEMPLATES=no)."
                    ;;
                *)
                    echo ""
                    info "Optional: copy missing profile files from data/seed/profiles/ (catalog seed during setup is the main path)."
                    echo "  Use this if Hermes was empty before seed-catalog push. Existing SOUL.md and AGENTS.md are never overwritten."
                    read -r -p "Copy missing bundled profile files to Hermes now? [y/N]: " REPLY_PROFILES
                    echo ""
                    if [[ "$REPLY_PROFILES" =~ ^[Yy]$ ]]; then
                        run_profile_templates=true
                    fi
                    ;;
            esac
        fi
        if [ "$run_profile_templates" = true ]; then
            ps_profiles_log() { info "$*"; }
            ps_bundled_profiles_install "$SCRIPT_REPO_ROOT"
            ok "Bundled Hermes profile templates installed (missing files only)."
        fi
    fi
    exit 0
fi

if ! command -v node &>/dev/null; then
    fail "Node.js not found. Install Node.js 20+ first: https://nodejs.org"
fi
NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
    fail "Node.js 20+ required (found $(node -v))"
fi
ok "Node.js $(node -v)"

# ── Hermes CLI: optional install (two-pass) or continue without ───────────
if ! hermes_cli_ok; then
    if noninteractive; then
        case "${INSTALL_HERMES:-}" in
            yes|YES|1|true|True)
                info "Installing Hermes (non-interactive)..."
                curl -fsSL "$HERMES_INSTALL_URL" | bash
                hermes setup || warn "hermes setup exited non-zero — complete setup manually, then re-run this script"
                echo ""
                ok "Hermes install step finished."
                echo ""
                echo "════════════════════════════════════════════════════════════"
                echo "  Next: open a new terminal if \`hermes\` is not on PATH, then run:"
                echo "    bash $(basename "$SCRIPT_PATH")"
                echo "  (from your PatterStage repo or re-download install.sh)"
                echo "  Full path hint: $SCRIPT_PATH"
                echo "════════════════════════════════════════════════════════════"
                exit 0
                ;;
            no|NO|0|false|False)
                warn "Hermes CLI not found; continuing without Hermes. Profile creation and some Hermes steps will be skipped."
                ;;
            *)
                fail "Non-interactive install: set INSTALL_HERMES=yes (install Hermes then exit) or INSTALL_HERMES=no (continue without Hermes CLI), or preinstall Hermes on PATH."
                ;;
        esac
    else
        while true; do
            read -p "Hermes CLI not found. Install Hermes now? [Y/n]: " -r REPLY_H
            echo ""
            if [[ "$REPLY_H" =~ ^[Nn]$ ]]; then
                warn "Continuing without Hermes. Some steps will be skipped. Install Hermes later and re-run this script for full setup."
                break
            fi
            read -p "This will require running install.sh again once Hermes install has completed. Continue? [Y/n]: " -r REPLY_C
            echo ""
            if [[ "$REPLY_C" =~ ^[Nn]$ ]]; then
                info "Back to Hermes install offer."
                continue
            fi
            info "Running official Hermes installer..."
            curl -fsSL "$HERMES_INSTALL_URL" | bash
            info "Running hermes setup..."
            hermes setup || warn "hermes setup exited non-zero — complete setup manually if needed"
            echo ""
            ok "Hermes install step finished."
            echo ""
            echo "════════════════════════════════════════════════════════════"
            echo "  Re-run this script to finish PatterStage setup:"
            echo "    bash scripts/bootstrap/install.sh --in-repo"
            echo "    # or: bash scripts/bootstrap/setup.sh"
            echo "  (from your repo clone, or the path you used to start the installer)"
            echo "════════════════════════════════════════════════════════════"
            exit 0
        done
    fi
fi

if hermes_cli_ok && [ -f "$HERMES_HOME/config.yaml" ]; then
    ok "Hermes config found at $HERMES_HOME/config.yaml"
elif hermes_cli_ok; then
    warn "Hermes CLI present but no $HERMES_HOME/config.yaml yet — run \`hermes setup\` if the dashboard misbehaves."
else
    warn "Proceeding without Hermes CLI — Hermes-specific steps will be skipped."
fi

if ! command -v git &>/dev/null; then
    fail "git not found. Install git first."
fi

# ── Handle Existing Installation ─────────────────────────────
if [ -d "$INSTALL_DIR" ]; then
    echo ""
    warn "Existing installation found at $INSTALL_DIR"
    EXISTING_ABS="$(cd "$INSTALL_DIR" && pwd -P)"
    if [ "$SCRIPT_REPO_ROOT" = "$EXISTING_ABS" ]; then
        echo ""
        fail "Cannot bootstrap in place: this script lives inside $INSTALL_DIR.

Use one of:
  bash scripts/bootstrap/setup.sh              # post-clone setup (recommended)
  bash scripts/bootstrap/install.sh --in-repo # same as setup.sh from repo root
  cd $INSTALL_DIR && git pull origin $BRANCH && bash scripts/bootstrap/setup.sh

Or clone into a different INSTALL_DIR, or remove this directory and re-run the installer."
    fi
    # The data directory is moved to $HOME/patterstage-data-backup-<stamp>
    # before anything is removed, and the prompt takes a typed word (T-0095,
    # D106). The function lives in scripts/lib/ps-reinstall.sh with its own
    # checks.
    if ps_reinstall_confirm_and_remove "$INSTALL_DIR" "$HOME"; then
        ok "Removed"
    else
        info "Using existing installation"
        cd "$INSTALL_DIR"
        if [ -f "scripts/bootstrap/setup.sh" ]; then
            info "Running setup in existing directory..."
            bash scripts/bootstrap/setup.sh
            echo ""
            ok "Setup complete! Start with: npm run start:network"
            exit 0
        else
            fail "setup.sh not found in $INSTALL_DIR — directory may be corrupted"
        fi
    fi
fi

# ── Clone Repository ─────────────────────────────────────────
echo ""
info "Cloning PatterStage..."
if ! git clone --branch "$BRANCH" --single-branch "$REPO_URL" "$INSTALL_DIR" 2>&1; then
    fail "Clone failed. Check your internet connection and try again."
fi
ok "Cloned to $INSTALL_DIR"

# ── Enable Gateway API Server ────────────────────────────────
if hermes_cli_ok && [ -f "$HERMES_HOME/config.yaml" ]; then
    if [ ! -f "$HERMES_HOME/.env" ] || ! grep -q "API_SERVER_ENABLED=true" "$HERMES_HOME/.env" 2>/dev/null; then
        info "Enabling gateway API server for Rec Room..."
        mkdir -p "$HERMES_HOME"
        echo "" >> "$HERMES_HOME/.env"
        echo "# Enable API server for PatterStage Rec Room" >> "$HERMES_HOME/.env"
        echo "API_SERVER_ENABLED=true" >> "$HERMES_HOME/.env"
        ok "API server enabled in ~/.hermes/.env"
    else
        info "API_SERVER_ENABLED already set in ~/.hermes/.env"
    fi

    # Restart the gateway so the change takes effect immediately
    info "Restarting Hermes gateway..."
    if hermes gateway stop 2>/dev/null; then
        hermes gateway start 2>/dev/null || warn "Gateway start failed — restart manually with: hermes gateway stop && hermes gateway start"
        ok "Gateway restarted"
    else
        warn "Could not stop gateway — restart manually with: hermes gateway stop && hermes gateway start"
    fi
else
    info "Skipping Hermes gateway .env tweak (Hermes not fully configured)."
fi

cd "$INSTALL_DIR"
if [ ! -f "scripts/bootstrap/setup.sh" ]; then
    fail "scripts/bootstrap/setup.sh not found after clone"
fi
bash scripts/bootstrap/setup.sh

# shellcheck source=lib/ps-dotenv-local.sh
source "$INSTALL_DIR/scripts/lib/ps-dotenv-local.sh"
ps_load_patterstage_env_local "$INSTALL_DIR"
# shellcheck source=lib/ps-hermes-profile-templates.sh
source "$INSTALL_DIR/scripts/lib/ps-hermes-profile-templates.sh"
ps_resolve_hermes_home

# ── Optional: bundled Hermes profile templates ───────────────
if ! ps_hermes_config_present; then
    info "Skipping optional Hermes profile templates (no $HERMES_HOME/config.yaml). Re-run install after Hermes setup, or set HERMES_HOME in .env.local if Hermes lives elsewhere."
else
    run_profile_templates=false
    if noninteractive; then
        case "${INSTALL_HERMES_PROFILE_TEMPLATES:-}" in
            yes|YES|1|true|True)
                run_profile_templates=true
                ;;
            *)
                info "Skipping bundled Hermes profile templates (non-interactive; set INSTALL_HERMES_PROFILE_TEMPLATES=yes to install)."
                ;;
        esac
    else
        case "${INSTALL_HERMES_PROFILE_TEMPLATES:-}" in
            yes|YES|1|true|True)
                run_profile_templates=true
                ;;
            no|NO|0|false|False)
                info "Skipping bundled Hermes profile templates (INSTALL_HERMES_PROFILE_TEMPLATES=no)."
                ;;
            *)
                echo ""
                info "Optional: install PatterStage bundled Hermes profile templates under $HERMES_HOME/profiles/"
                echo "  Existing SOUL.md and AGENTS.md files are never overwritten."
                read -r -p "Install bundled profile templates now? [y/N]: " REPLY_PROFILES
                echo ""
                if [[ "$REPLY_PROFILES" =~ ^[Yy]$ ]]; then
                    run_profile_templates=true
                fi
                ;;
        esac
    fi
    if [ "$run_profile_templates" = true ]; then
        ps_profiles_log() { info "$*"; }
        ps_bundled_profiles_install "$INSTALL_DIR"
        ok "Bundled Hermes profile templates installed (missing files only)."
    fi
fi

# ── Optional: Hindsight Memory Setup ─────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Memory Provider Setup (Optional)"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "  Hindsight provides long-term memory with semantic search"
echo "  using a knowledge graph (Postgres + pgvector)."
echo ""
echo "  Two ways to run it:"
echo "    • Docker  — cross-platform (Linux/macOS/Windows), no host Postgres/Python."
echo "    • Native  — Linux only (apt + systemd), runs on the Hermes agent venv."
echo ""
echo "  If your Hermes memory provider already differs, see docs: MEMORY.md,"
echo "  HERMES_CONFIG_INTEGRATION.md — this script will not overwrite your config."
echo ""

HINDSIGHT_ALREADY=false
if [ -f "$HERMES_HOME/hindsight/config.json" ]; then
    if curl -s --max-time 3 http://127.0.0.1:9177/health 2>/dev/null | grep -q healthy; then
        ok "Hindsight already configured and running"
        HINDSIGHT_ALREADY=true
    fi
fi

if [ "$HINDSIGHT_ALREADY" = false ]; then
    HS_SETUP="$INSTALL_DIR/scripts/bootstrap/setup-hindsight.sh"
    if noninteractive; then
        case "${INSTALL_HINDSIGHT:-auto}" in
            docker|DOCKER)
                if [ -f "$HS_SETUP" ]; then
                    bash "$HS_SETUP" --docker || warn "Hindsight (Docker) setup encountered issues"
                else
                    warn "setup-hindsight.sh not found — skipping"
                fi
                ;;
            yes|YES|1|true|True)
                if [ -f "$HS_SETUP" ]; then
                    bash "$HS_SETUP" || warn "Hindsight setup encountered issues"
                else
                    warn "setup-hindsight.sh not found — skipping"
                fi
                ;;
            no|NO|0|false|False)
                info "Skipping Hindsight (INSTALL_HINDSIGHT=no)"
                ;;
            *)
                info "Skipping Hindsight prompt (non-interactive). Set INSTALL_HINDSIGHT=docker|yes|no to control."
                ;;
        esac
    else
        # Native path is apt + systemd (Linux-only); Docker works everywhere.
        echo "  Set up Hindsight memory?"
        echo "    [d] Docker (cross-platform)   [n] Native (Linux)   [s] Skip"
        read -p "  Choice [d/n/s]: " -n 1 -r SETUP_HINDSIGHT
        echo ""
        case "$SETUP_HINDSIGHT" in
            d|D)
                echo ""
                if [ -f "$HS_SETUP" ]; then
                    bash "$HS_SETUP" --docker || {
                        warn "Hindsight (Docker) setup encountered issues"
                        echo "  Retry later: bash $HS_SETUP --docker"
                    }
                else
                    warn "setup-hindsight.sh not found — skipping"
                fi
                ;;
            n|N|y|Y)
                echo ""
                if [ -f "$HS_SETUP" ]; then
                    bash "$HS_SETUP" || {
                        warn "Hindsight setup encountered issues"
                        echo "  Retry later: bash $HS_SETUP"
                    }
                else
                    warn "setup-hindsight.sh not found — skipping"
                fi
                ;;
            *)
                info "Skipping Hindsight — set up later with:"
                echo "  bash $HS_SETUP --docker   # cross-platform"
                echo "  bash $HS_SETUP            # native (Linux)"
                ;;
        esac
    fi
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Installation Complete!                  ║"
echo "╚══════════════════════════════════════════╝"
echo ""
PS_DONE_PORT="(see .env.local PORT)"
if [ -f "$INSTALL_DIR/.env.local" ]; then
    PS_DONE_PORT="$(grep -E '^PORT=' "$INSTALL_DIR/.env.local" | tail -n1 | sed 's/^PORT=//' | tr -d '\r')"
fi
echo "Start the server:"
echo "  cd $INSTALL_DIR"
echo "  npm run start:network"
echo ""
echo "Listen port: $PS_DONE_PORT  →  http://127.0.0.1:${PS_DONE_PORT}/"
echo ""
ok "Install complete. Start the server with: cd $INSTALL_DIR && npm run start:network"
