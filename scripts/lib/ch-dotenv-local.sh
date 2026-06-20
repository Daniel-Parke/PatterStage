#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Load selected keys from PatterStage .env.local into the environment.
# Only exports lines that look like KEY=value for safe, known keys — no arbitrary shell.
# ═══════════════════════════════════════════════════════════════

ch_load_control_hub_env_local() {
  local dir="${1:-}"
  local f="$dir/.env.local"
  [ -n "$dir" ] || return 0
  [ -f "$f" ] || return 0

  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in
      ''|\#*) continue ;;
    esac
    case "$line" in
      CH_*=*|INSTALL_HERMES_*=*|HERMES_HOME=*|INSTALL_HERMES_PROFILE_TEMPLATES=*)
        local key="${line%%=*}"
        local val="${line#*=}"
        export "${key}=${val}"
        ;;
    esac
  done <"$f"
}
