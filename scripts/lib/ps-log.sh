#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# PatterStage — shared logging + prompt helpers
#
# Source this in any script for consistent, colourful output and a single
# interactivity convention. Destructive operations should print a plan, then
# `ps_confirm` before acting; the UI and CI pass a skip-flag so they run
# unattended.
#
# Skip-prompt (non-interactive) when ANY of:
#   --yes on the CLI (parsed into PS_ASSUME_YES=1 by the calling script)
#   PS_ASSUME_YES=1 · PS_INSTALL_NONINTERACTIVE=1 · CI=1|true
#   stdout/stdin is not a TTY (piped / spawned by the dashboard)
# Colours auto-disable when stdout is not a TTY or NO_COLOR is set.
#
# ── WHICH OF THESE IS SAFE INSIDE $( ) ────────────────────────
# Only ps_warn, ps_err and ps_fail are capture-safe. They write to stderr.
#
#   capture-safe (stderr):  ps_warn  ps_err  ps_fail
#   CAPTURE-UNSAFE (stdout): ps_info  ps_ok  ps_step  ps_dim
#
# The good-news loggers are exactly the ones that corrupt a capture, which is
# the wrong way round for how carefully people read them. Call ps_ok inside a
# function whose stdout is a value and the tick, the text and the colour codes
# all become part of that value. This is not hypothetical: ps_resolve_port_
# interactive printed its banner to stdout inside a $( ), and a clean bootstrap
# wrote the banner into .env.local as PORT= (see scripts/lib/ps-port.sh).
#
# So: a function whose stdout is a value prints ONLY that value, with printf,
# and sends every human-facing line to stderr or to ps_warn/ps_err. If you want
# ps_ok's phrasing in such a function, redirect it: `ps_ok "..." >&2`.
# ═══════════════════════════════════════════════════════════════

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  PS_C_RED=$'\033[0;31m'; PS_C_GREEN=$'\033[0;32m'; PS_C_YELLOW=$'\033[1;33m'
  PS_C_CYAN=$'\033[0;36m'; PS_C_DIM=$'\033[2m'; PS_C_NC=$'\033[0m'
else
  PS_C_RED=''; PS_C_GREEN=''; PS_C_YELLOW=''; PS_C_CYAN=''; PS_C_DIM=''; PS_C_NC=''
fi

ps_info() { printf '%s\n' "${PS_C_CYAN}ℹ${PS_C_NC}  $*"; }
ps_ok()   { printf '%s\n' "${PS_C_GREEN}✓${PS_C_NC}  $*"; }
ps_warn() { printf '%s\n' "${PS_C_YELLOW}⚠${PS_C_NC}  $*" >&2; }
ps_err()  { printf '%s\n' "${PS_C_RED}✗${PS_C_NC}  $*" >&2; }
ps_step() { printf '%s\n' "${PS_C_CYAN}▶${PS_C_NC}  $*"; }
ps_dim()  { printf '%s\n' "${PS_C_DIM}$*${PS_C_NC}"; }
ps_fail() { ps_err "$*"; exit 1; }

# True when prompts should be SKIPPED (assume-yes / non-interactive / CI).
ps_assume_yes() {
  case "${PS_ASSUME_YES:-}" in 1 | yes | YES | true | True) return 0 ;; esac
  [ "${PS_INSTALL_NONINTERACTIVE:-}" = "1" ] && return 0
  case "${CI:-}" in 1 | true | TRUE) return 0 ;; esac
  return 1
}

# True only when we can and should prompt the user.
ps_is_interactive() {
  ps_assume_yes && return 1
  [ -t 0 ] && [ -t 1 ]
}

# ps_confirm "Question?" [Y|N default] → 0 (yes) / 1 (no).
# Auto-yes when ps_assume_yes; falls back to the default when there is no TTY.
ps_confirm() {
  local prompt="$1" def="${2:-N}" reply hint
  if ps_assume_yes; then
    return 0
  fi
  if ! { [ -t 0 ] && [ -t 1 ]; }; then
    case "$def" in Y | y) return 0 ;; *) return 1 ;; esac
  fi
  case "$def" in Y | y) hint="[Y/n]" ;; *) hint="[y/N]" ;; esac
  read -r -p "${PS_C_YELLOW}?${PS_C_NC} ${prompt} ${hint}: " reply
  reply="${reply:-$def}"
  [[ "$reply" =~ ^[Yy]$ ]]
}

# Consume a leading --yes/-y/--non-interactive flag from "$@" by exporting
# PS_ASSUME_YES. Call as: eval "$(ps_absorb_yes_flag "$@")" is overkill — instead
# scripts loop their own args; this helper just records the intent.
ps_set_assume_yes() { export PS_ASSUME_YES=1; }
