#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Optional Hermes profile templates — install.sh only (update uses seed-catalog.ts → SQLite → push)
#
# Hermes root: HERMES_HOME (default ~/.hermes). Profiles live under
#   $HERMES_HOME/profiles/<name>/
# PatterStage data (PS_DATA_DIR) is never used for profile paths here.
# ═══════════════════════════════════════════════════════════════

# Ordered list (must match data/seed/profiles/manifest.json).
# Slugs must match data/seed/profiles/manifest.json (PatterStage DB is source of truth).
PS_BUNDLED_PROFILE_LIST=(
  qa
  swe
  devops
  data-scientist
  creative-lead
  support
)

ps_resolve_hermes_home() {
  export HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
}

ps_hermes_config_present() {
  [ -f "$HERMES_HOME/config.yaml" ]
}

# Optional hook: define ps_profiles_log() before calling install/sync to integrate with caller logging.
_ch_profiles_emit() {
  if declare -F ps_profiles_log >/dev/null 2>&1; then
    ps_profiles_log "$@"
  else
    echo "$@"
  fi
}

_ch_hermes_cli_ok() {
  command -v hermes &>/dev/null && hermes --version &>/dev/null
}

# Install mode: create missing profile dirs; copy SOUL.md / AGENTS.md / auth.json only if destination missing.
ps_bundled_profiles_install() {
  local repo_root="$1"
  local templates="$repo_root/data/seed/profiles"
  local profile profile_dir

  ps_resolve_hermes_home

  for profile in "${PS_BUNDLED_PROFILE_LIST[@]}"; do
    profile_dir="$HERMES_HOME/profiles/$profile"

    if [ ! -d "$profile_dir" ]; then
      _ch_profiles_emit "Creating Hermes profile: $profile"
      if _ch_hermes_cli_ok; then
        hermes profile create "$profile" --clone --no-alias 2>/dev/null || true
      fi
      if [ ! -d "$profile_dir" ]; then
        mkdir -p "$profile_dir"/{memories,sessions,skills,skins,logs,plans,workspace,cron}
        [ -f "$HERMES_HOME/config.yaml" ] && cp "$HERMES_HOME/config.yaml" "$profile_dir/config.yaml"
        [ -f "$HERMES_HOME/.env" ] && cp "$HERMES_HOME/.env" "$profile_dir/.env"
      fi
    fi

    if [ -f "$templates/$profile/SOUL.md" ] && [ ! -f "$profile_dir/SOUL.md" ]; then
      cp "$templates/$profile/SOUL.md" "$profile_dir/SOUL.md"
      _ch_profiles_emit "Installed $profile/SOUL.md"
    fi
    if [ -f "$templates/$profile/AGENTS.md" ] && [ ! -f "$profile_dir/AGENTS.md" ]; then
      cp "$templates/$profile/AGENTS.md" "$profile_dir/AGENTS.md"
      _ch_profiles_emit "Installed $profile/AGENTS.md"
    fi
    if [ ! -f "$profile_dir/auth.json" ] && [ -f "$HERMES_HOME/auth.json" ]; then
      cp "$HERMES_HOME/auth.json" "$profile_dir/auth.json"
      chmod 600 "$profile_dir/auth.json"
      _ch_profiles_emit "Installed $profile/auth.json (from Hermes home)"
    fi
  done
}
