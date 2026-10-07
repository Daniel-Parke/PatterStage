#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Load selected keys from PatterStage .env.local into the environment.
# Only exports lines that look like KEY=value for safe, known keys — no arbitrary shell.
# ═══════════════════════════════════════════════════════════════

ps_legacy_value_selected() {
  local key="$1" value="$2"
  case "$key" in
    PS_SCRIPTS_DIR|CH_SCRIPTS_DIR|PS_ENABLE_DEPLOY_API|CH_ENABLE_DEPLOY_API|PS_REQUEST_SIGNING_SECRET|CH_REQUEST_SIGNING_SECRET|PS_READ_ONLY|CH_READ_ONLY)
      [[ -n "${value//[[:space:]]/}" ]] ;;
    *) [[ -n "$value" ]] ;;
  esac
}

ps_legacy_value_effective() {
  local key="$1" value="$2"
  case "$key" in
    CH_ENABLE_DEPLOY_API|CH_READ_ONLY|CH_RUN_MAX_MINUTES|CH_UPDATE_GIT_BRANCH|CH_PULL_RECONCILE_DISK|CH_ALLOWED_DEV_ORIGINS)
      # Node is a PatterStage prerequisite. Use the same parsing rules as the
      # consumers without evaluating shell input or printing its value.
      command -v node >/dev/null 2>&1 && node -e '
        const [key, value] = process.argv.slice(1);
        const flag = value.trim().toLowerCase();
        const selected = key === "CH_ENABLE_DEPLOY_API"
          ? ["1", "true", "yes", "0", "false", "no"].includes(flag)
          : key === "CH_READ_ONLY" ? ["1", "true"].includes(flag)
          : key === "CH_RUN_MAX_MINUTES" ? Boolean(Number(value))
          : key === "CH_UPDATE_GIT_BRANCH" ? /[a-zA-Z0-9._/-]/.test(value)
          : key === "CH_PULL_RECONCILE_DISK" ? value === "1"
          : value.split(",").some((entry) => Boolean(entry.trim().replace(/^https?:\/\//, "")));
        process.exit(selected ? 0 : 1);
      ' "$key" "$value" >/dev/null 2>&1 ;;
    *) return 0 ;;
  esac
}

ps_load_patterstage_env_local() {
  local dir="${1:-}"
  local f="$dir/.env.local"
  local -a legacy_keys=(CH_DATA_DIR CH_SCRIPTS_DIR CH_HARDWARE_LOG_DIR CH_ENABLE_DEPLOY_API CH_REQUEST_SIGNING_SECRET CH_READ_ONLY CH_RUN_MAX_MINUTES CH_UPDATE_GIT_BRANCH CH_PULL_RECONCILE_DISK CH_ALLOWED_DEV_ORIGINS)
  local -a inherited_canonical=() explicit_keys=() explicit_values=() explicit_legacy_keys=()
  local legacy_key ps_key canonical legacy_value names="" data_canonical="" key val explicit_legacy
  local i j
  # Snapshot canonical inputs before CH_* bridging copies a legacy value into
  # PS_*. The warning later selects from the final explicit file values or
  # these inherited inputs, never from an unlabelled bridge copy.
  for legacy_key in "${legacy_keys[@]}"; do
    ps_key="PS_${legacy_key#CH_}"
    inherited_canonical+=("${!ps_key:-}")
  done

  if [ -n "$dir" ] && [ -f "$f" ]; then
    while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in
      ''|\#*) continue ;;
    esac
    case "$line" in
      PS_*=*|CH_*=*|INSTALL_HERMES_*=*|HERMES_HOME=*|INSTALL_HERMES_PROFILE_TEMPLATES=*)
        key="${line%%=*}"
        val="${line#*=}"
        export "${key}=${val}"
        if [[ "$key" == PS_* ]]; then
          explicit_keys+=("$key")
          explicit_values+=("$val")
        elif [[ "$key" == CH_* ]]; then
          explicit_legacy_keys+=("$key")
        fi
        # Back-compat: bridge a legacy CH_* key to its PS_* name so the
        # renamed scripts read it without per-site fallbacks. Only sets the
        # PS_ alias when it isn't already present (an explicit PS_ wins).
        case "$key" in
          CH_*)
            ps_key="PS_${key#CH_}"
            # `if` (not `&&`) so a no-op under set -e doesn't abort the caller.
            if [ -z "${!ps_key:-}" ]; then
              export "${ps_key}=${val}"
            fi
            ;;
        esac
        ;;
    esac
    done <"$f"
  fi

  # Resolve each name once from the final file value, or the inherited value
  # when the file did not set it. This handles empty later PS_* lines and
  # repeated CH_* lines without losing or duplicating warning provenance.
  for i in "${!legacy_keys[@]}"; do
    legacy_key="${legacy_keys[$i]}"
    ps_key="PS_${legacy_key#CH_}"
    canonical="${inherited_canonical[$i]}"
    for j in "${!explicit_keys[@]}"; do
      if [[ "${explicit_keys[$j]}" == "$ps_key" ]]; then canonical="${explicit_values[$j]}"; fi
    done
    if [[ "$legacy_key" == CH_DATA_DIR ]]; then data_canonical="$canonical"; fi
    legacy_value="${!legacy_key:-}"
    explicit_legacy=false
    for j in "${!explicit_legacy_keys[@]}"; do
      if [[ "${explicit_legacy_keys[$j]}" == "$legacy_key" ]]; then explicit_legacy=true; break; fi
    done
    if { [[ "$legacy_key" == CH_DATA_DIR ]] || [[ "$explicit_legacy" == true ]]; } &&
       ! ps_legacy_value_selected "$ps_key" "$canonical" &&
       ps_legacy_value_selected "$legacy_key" "$legacy_value" &&
       ps_legacy_value_effective "$legacy_key" "$legacy_value"; then
      names="${names:+$names, }${legacy_key} → ${ps_key}"
    fi
  done
  if ! ps_legacy_value_selected PS_DATA_DIR "$data_canonical" &&
     ! ps_legacy_value_selected CH_DATA_DIR "${CH_DATA_DIR:-}" &&
     ps_legacy_value_selected CONTROL_HUB_DATA_DIR "${CONTROL_HUB_DATA_DIR:-}"; then
    names="${names:+$names, }CONTROL_HUB_DATA_DIR → PS_DATA_DIR"
  fi
  if [ -n "$names" ] && [ -z "${_PS_LEGACY_BRIDGE_WARNED:-}" ]; then
    printf '[config] Pre-rename configuration selected: %s. These names work through v1.0.0 and retire in the first later release; move to the named replacements.\n' "$names" >&2
    _PS_LEGACY_BRIDGE_WARNED=1
  fi
}
