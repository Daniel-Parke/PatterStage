#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# PatterStage — PORT selection + CH_ALLOWED_DEV_ORIGINS (sourced after ch-env.sh)
# ═══════════════════════════════════════════════════════════════

ch_auto_pick_port() {
  local p
  for p in $(seq 42069 42100); do
    if ! ch_tcp_port_in_use "$p"; then
      printf '%s' "$p"
      return 0
    fi
  done
  return 1
}

ch_validate_port_number() {
  local s="$1"
  [[ "$s" =~ ^[0-9]+$ ]] || return 1
  local n=$((10#$s))
  [ "$n" -ge 1 ] && [ "$n" -le 65535 ]
}

ch_noninteractive_install() {
  [[ "${CI:-}" == "1" || "${CH_INSTALL_NONINTERACTIVE:-}" == "1" ]]
}

ch_resolve_port_interactive() {
  local chosen=""
  while true; do
    echo ""
    echo "PatterStage will listen on a TCP port (Next.js PORT)."
    echo "  • Press Enter for auto: first free port in 42069–42100 (auto-selected if no input)."
    echo "  • Or type a port 1–65535 (1024–65535 suggested; <1024 may need root)."
    read -r -p "Port [Enter = auto]: " reply
    echo ""
    if [ -z "${reply// /}" ]; then
      chosen="$(ch_auto_pick_port)" || {
        echo "✗ No free port in 42069–42100. Install ss/lsof or set PORT in .env.local."
        return 1
      }
      echo "✓ Auto-selected port: $chosen"
      printf '%s' "$chosen"
      return 0
    fi
    chosen="${reply// /}"
    if ! ch_validate_port_number "$chosen"; then
      echo "✗ Invalid port (need 1–65535). Try again."
      continue
    fi
    if [ "$((10#$chosen))" -lt 1024 ]; then
      read -r -p "Ports below 1024 are privileged on many systems. Continue? [y/N]: " lo
      echo ""
      if ! [[ "$lo" =~ ^[Yy]$ ]]; then
        continue
      fi
    fi
    if ! ch_tcp_port_in_use "$chosen"; then
      printf '%s' "$chosen"
      return 0
    fi
    echo "✗ Port $chosen is already in use."
    echo "  [a] Try next free port upward from $chosen"
    echo "  [b] Enter a different port"
    echo "  [c] Cancel"
    read -r -p "Choice (a/b/c): " oc
    echo ""
    case "$oc" in
      a|A)
        local p=$((10#$chosen + 1))
        while [ "$p" -le 65535 ]; do
          if ! ch_tcp_port_in_use "$p"; then
            echo "✓ Using port: $p"
            printf '%s' "$p"
            return 0
          fi
          p=$((p + 1))
        done
        echo "✗ No free port found up to 65535."
        return 1
        ;;
      b|B)
        continue
        ;;
      *)
        echo "Aborted."
        return 1
        ;;
    esac
  done
}

# Resolve and write PORT + CH_ALLOWED_DEV_ORIGINS to repo .env.local.
# Sets CH_SELECTED_PORT export.
ch_setup_port_and_dev_origins() {
  local repo_root="$1"
  local env_file="${repo_root}/.env.local"
  local chosen=""

  if ch_noninteractive_install; then
    if [ -n "${PORT:-}" ]; then
      chosen="$PORT"
    else
      chosen="$(ch_auto_pick_port)" || {
        echo "✗ No free port in 42069–42100; set PORT in the environment." >&2
        return 1
      }
    fi
    if ! ch_validate_port_number "$chosen"; then
      echo "✗ Invalid PORT: ${PORT:-}" >&2
      return 1
    fi
    if ch_tcp_port_in_use "$chosen"; then
      echo "✗ PORT $chosen is already in use." >&2
      return 1
    fi
  else
    chosen="$(ch_resolve_port_interactive)" || return 1
  fi

  local origins
  origins="$(ch_build_allowed_dev_origins "$chosen")"
  ch_env_set "$env_file" "PORT" "$chosen"
  ch_env_set "$env_file" "CH_ALLOWED_DEV_ORIGINS" "$origins"
  export CH_SELECTED_PORT="$chosen"
  echo "✓ Wrote PORT and CH_ALLOWED_DEV_ORIGINS to .env.local"
}
