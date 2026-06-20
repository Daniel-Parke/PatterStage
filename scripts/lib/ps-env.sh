#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# PatterStage — shared .env.local helpers (sourced by setup.sh / install)
# ═══════════════════════════════════════════════════════════════

# Set KEY=value in a dotenv file (removes prior KEY= lines, appends one).
ps_env_set() {
  local file="$1"
  local key="$2"
  local val="$3"
  local dir
  dir="$(dirname "$file")"
  mkdir -p "$dir"
  touch "$file"
  local tmp
  tmp="$(mktemp)"
  grep -v "^${key}=" "$file" >"$tmp" 2>/dev/null || true
  echo "${key}=${val}" >>"$tmp"
  mv "$tmp" "$file"
}

# Resolve the PatterStage data dir. Explicit env wins (PS_ → CH_ →
# CONTROL_HUB_); otherwise prefer ~/patterstage/data but fall back to a
# pre-existing ~/control-hub/data so an un-migrated install keeps reading its
# data. Mirrors getPsDataDir() in src/lib/paths.ts.
ps_data_dir() {
  if [ -n "${PS_DATA_DIR:-}" ]; then printf '%s' "$PS_DATA_DIR"; return; fi
  if [ -n "${CH_DATA_DIR:-}" ]; then printf '%s' "$CH_DATA_DIR"; return; fi
  if [ -n "${CONTROL_HUB_DATA_DIR:-}" ]; then printf '%s' "$CONTROL_HUB_DATA_DIR"; return; fi
  if [ ! -d "$HOME/patterstage/data" ] && [ -d "$HOME/control-hub/data" ]; then
    printf '%s' "$HOME/control-hub/data"
  else
    printf '%s' "$HOME/patterstage/data"
  fi
}

# Default Hermes root from HERMES_HOME (profile-as-home → grandparent).
ps_hermes_default_root() {
  local h="${1:-${HERMES_HOME:-$HOME/.hermes}}"
  if [[ "$(basename "$(dirname "$h")")" == "profiles" ]]; then
    dirname "$(dirname "$h")"
  elif [[ "$h" == "$HOME/.hermes" || "$h" == "$HOME/.hermes/"* ]]; then
    echo "$HOME/.hermes"
  else
    echo "$h"
  fi
}

# Operator banner: single canonical Hermes layout for PatterStage.
ps_print_hermes_install_paths() {
  local hm="${HERMES_HOME:-$HOME/.hermes}"
  local root
  root="$(ps_hermes_default_root "$hm")"
  echo ""
  echo "PatterStage uses Hermes at: $hm"
  echo "  (default: $HOME/.hermes)"
  echo "Agent package: $root/hermes-agent"
  if [ -d "${HOME}/.local/share/hermes-agent" ]; then
    echo "⚠  Legacy ~/.local/share/hermes-agent is ignored — use one install under ~/.hermes (hermes update or Nous installer)."
  fi
}

# Print PORT value from .env.local or empty.
ps_env_read_port() {
  local file="$1"
  [ -f "$file" ] || return 1
  local line
  line="$(grep -E '^PORT=' "$file" | tail -n1)" || return 1
  line="${line#PORT=}"
  line="${line%$'\r'}"
  [ -n "$line" ] || return 1
  printf '%s' "$line"
}

# Build PS_ALLOWED_DEV_ORIGINS for next.config (comma-separated full origins).
ps_build_allowed_dev_origins() {
  local port="$1"
  local origins="http://localhost:${port},http://127.0.0.1:${port}"
  local ips
  ips="$(hostname -I 2>/dev/null || true)"
  for ip in $ips; do
    [[ "$ip" =~ ^127\. ]] && continue
    [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || continue
    origins="${origins},http://${ip}:${port}"
  done
  printf '%s' "$origins"
}

# True if something is listening on TCP port (this host).
# Always returns 0 (in-use / true) or 1 (free / false) regardless of
# whether the underlying command (ss/lsof) succeeds or fails.
ps_tcp_port_in_use() {
  local p="$1"
  if command -v ss &>/dev/null; then
    if ss -ltn "sport = :$p" 2>/dev/null | grep -q LISTEN; then
      return 0   # port is in use
    fi
    return 1     # port is free (grep found nothing — ss command itself succeeded)
  fi
  if command -v lsof &>/dev/null; then
    if lsof -iTCP:"$p" -sTCP:LISTEN &>/dev/null; then
      return 0   # port is in use
    fi
    return 1     # port is free
  fi
  # Fallback: try a TCP probe
  if (echo >/dev/tcp/127.0.0.1/"$p") &>/dev/null; then
    return 0
  fi
  return 1
}

# Print unique PIDs listening on TCP port (one per line). Portable (no grep -oP).
ps_pids_on_tcp_port() {
  local port="$1"
  local p line
  if command -v ss &>/dev/null; then
    while IFS= read -r line; do
      case "$line" in
        *pid=*)
          p="${line#*pid=}"
          p="${p%%,*}"
          p="${p%%)*}"
          [ -n "$p" ] && printf '%s\n' "$p"
          ;;
      esac
    done < <(ss -tlnp "sport = :$port" 2>/dev/null || true)
    return 0
  fi
  if command -v lsof &>/dev/null; then
    lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
    return 0
  fi
  return 0
}

# Kill all processes listening on TCP port (best-effort).
ps_kill_tcp_listeners_on_port() {
  local port="$1"
  local p
  for p in $(ps_pids_on_tcp_port "$port" | sort -u); do
    kill -9 "$p" 2>/dev/null || true
  done
}

# Stop PatterStage server + optional socat relay. $1 = app root directory.
ps_stop_patterstage() {
  local app_dir="$1"
  local env_file="${app_dir}/.env.local"
  local port="${PORT:-}"
  if [ -z "$port" ] && [ -f "$env_file" ]; then
    port="$(ps_env_read_port "$env_file" 2>/dev/null || true)"
  fi
  port="${port:-42069}"

  ps_kill_tcp_listeners_on_port "$port"

  local socat_pid_file="${HOME}/.hermes/logs/ps-socat.pid"
  local server_pid_file="${HOME}/.hermes/logs/ps-server.pid"
  local old_pid

  old_pid="$(cat "$server_pid_file" 2>/dev/null || true)"
  if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
    kill -9 "$old_pid" 2>/dev/null || true
  fi
  rm -f "$server_pid_file"

  old_pid="$(cat "$socat_pid_file" 2>/dev/null || true)"
  if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
    kill -9 "$old_pid" 2>/dev/null || true
  fi
  rm -f "$socat_pid_file"

  local use_relay=0
  case "${PS_SOCAT_RELAY:-}" in 1 | yes | YES | true | True) use_relay=1 ;; esac
  if [ -n "${PS_SOCAT_BIND:-}" ]; then
    use_relay=1
  fi
  if [ "$use_relay" -eq 1 ]; then
    local relay_port="${PS_SOCAT_RELAY_PORT:-42069}"
    ps_kill_tcp_listeners_on_port "$relay_port"
  fi
}
