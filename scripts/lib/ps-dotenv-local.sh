#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Load selected keys from PatterStage .env.local into the environment.
# Only exports lines that look like KEY=value for safe, known keys — no arbitrary shell.
# ═══════════════════════════════════════════════════════════════

ps_load_patterstage_env_local() {
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
      PS_*=*|CH_*=*|INSTALL_HERMES_*=*|HERMES_HOME=*|INSTALL_HERMES_PROFILE_TEMPLATES=*)
        local key="${line%%=*}"
        local val="${line#*=}"
        export "${key}=${val}"
        # Back-compat: bridge a legacy CH_* key to its PS_* name so the
        # renamed scripts read it without per-site fallbacks. Only sets the
        # PS_ alias when it isn't already present (an explicit PS_ wins).
        case "$key" in
          CH_*)
            local ps_key="PS_${key#CH_}"
            # `if` (not `&&`) so a no-op under set -e doesn't abort the caller.
            if [ -z "${!ps_key:-}" ]; then export "${ps_key}=${val}"; fi
            ;;
        esac
        ;;
    esac
  done <"$f"
}
