#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# PatterStage — shared logging + prompt helpers
#
# Source this in any script for consistent, colourful output and a single
# interactivity convention. Destructive operations should print a plan, then
# `ch_confirm` before acting; the UI and CI pass a skip-flag so they run
# unattended.
#
# Skip-prompt (non-interactive) when ANY of:
#   --yes on the CLI (parsed into CH_ASSUME_YES=1 by the calling script)
#   CH_ASSUME_YES=1 · CH_INSTALL_NONINTERACTIVE=1 · CI=1|true
#   stdout/stdin is not a TTY (piped / spawned by the dashboard)
# Colours auto-disable when stdout is not a TTY or NO_COLOR is set.
# ═══════════════════════════════════════════════════════════════

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  CH_C_RED=$'\033[0;31m'; CH_C_GREEN=$'\033[0;32m'; CH_C_YELLOW=$'\033[1;33m'
  CH_C_CYAN=$'\033[0;36m'; CH_C_DIM=$'\033[2m'; CH_C_NC=$'\033[0m'
else
  CH_C_RED=''; CH_C_GREEN=''; CH_C_YELLOW=''; CH_C_CYAN=''; CH_C_DIM=''; CH_C_NC=''
fi

ch_info() { printf '%s\n' "${CH_C_CYAN}ℹ${CH_C_NC}  $*"; }
ch_ok()   { printf '%s\n' "${CH_C_GREEN}✓${CH_C_NC}  $*"; }
ch_warn() { printf '%s\n' "${CH_C_YELLOW}⚠${CH_C_NC}  $*" >&2; }
ch_err()  { printf '%s\n' "${CH_C_RED}✗${CH_C_NC}  $*" >&2; }
ch_step() { printf '%s\n' "${CH_C_CYAN}▶${CH_C_NC}  $*"; }
ch_dim()  { printf '%s\n' "${CH_C_DIM}$*${CH_C_NC}"; }
ch_fail() { ch_err "$*"; exit 1; }

# True when prompts should be SKIPPED (assume-yes / non-interactive / CI).
ch_assume_yes() {
  case "${CH_ASSUME_YES:-}" in 1 | yes | YES | true | True) return 0 ;; esac
  [ "${CH_INSTALL_NONINTERACTIVE:-}" = "1" ] && return 0
  case "${CI:-}" in 1 | true | TRUE) return 0 ;; esac
  return 1
}

# True only when we can and should prompt the user.
ch_is_interactive() {
  ch_assume_yes && return 1
  [ -t 0 ] && [ -t 1 ]
}

# ch_confirm "Question?" [Y|N default] → 0 (yes) / 1 (no).
# Auto-yes when ch_assume_yes; falls back to the default when there is no TTY.
ch_confirm() {
  local prompt="$1" def="${2:-N}" reply hint
  if ch_assume_yes; then
    return 0
  fi
  if ! { [ -t 0 ] && [ -t 1 ]; }; then
    case "$def" in Y | y) return 0 ;; *) return 1 ;; esac
  fi
  case "$def" in Y | y) hint="[Y/n]" ;; *) hint="[y/N]" ;; esac
  read -r -p "${CH_C_YELLOW}?${CH_C_NC} ${prompt} ${hint}: " reply
  reply="${reply:-$def}"
  [[ "$reply" =~ ^[Yy]$ ]]
}

# Consume a leading --yes/-y/--non-interactive flag from "$@" by exporting
# CH_ASSUME_YES. Call as: eval "$(ch_absorb_yes_flag "$@")" is overkill — instead
# scripts loop their own args; this helper just records the intent.
ch_set_assume_yes() { export CH_ASSUME_YES=1; }
