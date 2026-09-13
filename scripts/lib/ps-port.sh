#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# PatterStage — PORT selection + PS_ALLOWED_DEV_ORIGINS (sourced after ps-env.sh)
# ═══════════════════════════════════════════════════════════════

ps_auto_pick_port() {
  local p
  for p in $(seq 42069 42100); do
    if ! ps_tcp_port_in_use "$p"; then
      printf '%s' "$p"
      return 0
    fi
  done
  return 1
}

ps_validate_port_number() {
  local s="$1"
  [[ "$s" =~ ^[0-9]+$ ]] || return 1
  local n=$((10#$s))
  [ "$n" -ge 1 ] && [ "$n" -le 65535 ]
}

ps_noninteractive_install() {
  [[ "${CI:-}" == "1" || "${PS_INSTALL_NONINTERACTIVE:-}" == "1" ]]
}

# Prompt the operator for a port. STDOUT OF THIS FUNCTION IS ITS RETURN VALUE:
# the only caller runs it inside $( ), so every byte printed to stdout is stored
# as the PORT. That is not a style point. It shipped: the banner below used to go
# to stdout, so a clean bootstrap wrote four lines of prose into .env.local as
# PORT= and the install was unusable from that moment on.
#
# The contract, therefore:
#   - every human-facing line goes to stderr (`>&2`), including the errors;
#   - `read -r -p` is safe, because bash writes its prompt to stderr;
#   - the chosen port leaves by exactly one `printf '%s'` on stdout, no newline;
#   - nothing here may call ps_info / ps_ok / ps_step / ps_dim, which log to
#     stdout (see the header of scripts/lib/ps-log.sh).
# The caller validates what comes back regardless, so a future slip is caught
# rather than written.
ps_resolve_port_interactive() {
  local chosen=""
  while true; do
    echo "" >&2
    echo "PatterStage will listen on a TCP port (Next.js PORT)." >&2
    echo "  • Press Enter for auto: first free port in 42069–42100 (auto-selected if no input)." >&2
    echo "  • Or type a port 1–65535 (1024–65535 suggested; <1024 may need root)." >&2
    read -r -p "Port [Enter = auto]: " reply
    echo "" >&2
    if [ -z "${reply// /}" ]; then
      chosen="$(ps_auto_pick_port)" || {
        echo "✗ No free port in 42069–42100. Install ss/lsof or set PORT in .env.local." >&2
        return 1
      }
      echo "✓ Auto-selected port: $chosen" >&2
      printf '%s' "$chosen"
      return 0
    fi
    chosen="${reply// /}"
    if ! ps_validate_port_number "$chosen"; then
      echo "✗ Invalid port (need 1–65535). Try again." >&2
      continue
    fi
    if [ "$((10#$chosen))" -lt 1024 ]; then
      read -r -p "Ports below 1024 are privileged on many systems. Continue? [y/N]: " lo
      echo "" >&2
      if ! [[ "$lo" =~ ^[Yy]$ ]]; then
        continue
      fi
    fi
    if ! ps_tcp_port_in_use "$chosen"; then
      printf '%s' "$chosen"
      return 0
    fi
    echo "✗ Port $chosen is already in use." >&2
    echo "  [a] Try next free port upward from $chosen" >&2
    echo "  [b] Enter a different port" >&2
    echo "  [c] Cancel" >&2
    read -r -p "Choice (a/b/c): " oc
    echo "" >&2
    case "$oc" in
      a|A)
        local p=$((10#$chosen + 1))
        while [ "$p" -le 65535 ]; do
          if ! ps_tcp_port_in_use "$p"; then
            echo "✓ Using port: $p" >&2
            printf '%s' "$p"
            return 0
          fi
          p=$((p + 1))
        done
        echo "✗ No free port found up to 65535." >&2
        return 1
        ;;
      b|B)
        continue
        ;;
      *)
        echo "Aborted." >&2
        return 1
        ;;
    esac
  done
}

# Resolve and write PORT + PS_ALLOWED_DEV_ORIGINS to repo .env.local.
# Sets PS_SELECTED_PORT export.
ps_setup_port_and_dev_origins() {
  local repo_root="$1"
  local env_file="${repo_root}/.env.local"
  local chosen=""

  if ps_noninteractive_install; then
    if [ -n "${PORT:-}" ]; then
      chosen="$PORT"
    else
      chosen="$(ps_auto_pick_port)" || {
        echo "✗ No free port in 42069–42100; set PORT in the environment." >&2
        return 1
      }
    fi
    if ! ps_validate_port_number "$chosen"; then
      echo "✗ Invalid PORT: ${PORT:-}" >&2
      return 1
    fi
    if ps_tcp_port_in_use "$chosen"; then
      echo "✗ PORT $chosen is already in use." >&2
      return 1
    fi
  else
    chosen="$(ps_resolve_port_interactive)" || return 1
    # The branch above validates what it read from the environment; this one is
    # a stdout capture, which is the branch that can be polluted by anything
    # printed inside the prompt. Validate it the same way, so a non-port can
    # never reach ps_env_set no matter who logs to stdout in future.
    if ! ps_validate_port_number "$chosen"; then
      echo "✗ Interactive port selection returned something that is not a port." >&2
      echo "  First line of what it returned: ${chosen%%$'\n'*}" >&2
      echo "  Something printed to stdout inside ps_resolve_port_interactive." >&2
      return 1
    fi
  fi

  local origins
  origins="$(ps_build_allowed_dev_origins "$chosen")"
  ps_env_set "$env_file" "PORT" "$chosen" || return 1
  ps_env_set "$env_file" "PS_ALLOWED_DEV_ORIGINS" "$origins" || return 1
  export PS_SELECTED_PORT="$chosen"
  echo "✓ Wrote PORT and PS_ALLOWED_DEV_ORIGINS to .env.local"
}
