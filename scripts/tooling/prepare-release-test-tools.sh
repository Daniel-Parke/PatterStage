#!/usr/bin/env bash
# CI-only prerequisites for the release fixtures; compatible with macOS Bash 3.2.
set -euo pipefail

fail() { printf 'Release test prerequisites: %s\n' "$*" >&2; exit 1; }

verify_tools() {
  local timeout_command=$1 bash_command=$2 version status
  version=$("$timeout_command" --version) || fail "timeout version check failed"
  [[ "$version" == *"GNU coreutils"* ]] || fail "GNU timeout is required"
  "$timeout_command" --kill-after=0.2 2 "$bash_command" --noprofile --norc -c 'exit 37' && status=0 || status=$?
  [[ "$status" == 37 ]] || fail "timeout does not preserve child status"

  "$timeout_command" --kill-after=2 0.2 sleep 2 && status=0 || status=$?
  [[ "$status" == 124 ]] || fail "timeout expiry did not return 124"
  "$timeout_command" --kill-after=0.2 1 "$bash_command" --noprofile --norc -c 'trap "" TERM; while :; do :; done' >/dev/null 2>&1 && status=0 || status=$?
  [[ "$status" == 137 ]] || fail "timeout cannot kill a TERM-resistant child"

  "$timeout_command" --kill-after=0.2 2 "$bash_command" --noprofile --norc -c '
    exec {channel}< <(printf "ready\n"; while :; do :; done)
    writer=$!
    trap '\''kill "$writer" 2>/dev/null || true; wait "$writer" 2>/dev/null || true'\'' EXIT
    IFS= read -r -t 1 -u "$channel" ready && [[ "$ready" == ready ]] || exit 1
    value=""
    IFS= read -r -t 0.01 -u "$channel" value && status=0 || status=$?
    exec {channel}<&-
    [[ "$status" == 142 && -z "$value" ]]
  ' || fail "Bash fractional waits or dynamic descriptors are incompatible"
}

formula_directory() {
  local formula=$1 suffix=$2 executable=$3 prefix directory
  prefix=$(brew --prefix "$formula") || fail "cannot resolve Homebrew $formula prefix"
  [[ -n "$prefix" && "$prefix" == /* && "$prefix" != *$'\n'* ]] || fail "invalid Homebrew $formula prefix"
  directory="$prefix/$suffix"
  if [[ ! -x "$directory/$executable" ]]; then
    HOMEBREW_NO_AUTO_UPDATE=1 brew install "$formula" >&2 || fail "Homebrew $formula installation failed"
    prefix=$(brew --prefix "$formula") || fail "cannot resolve installed Homebrew $formula prefix"
    [[ -n "$prefix" && "$prefix" == /* && "$prefix" != *$'\n'* ]] || fail "invalid installed Homebrew $formula prefix"
    directory="$prefix/$suffix"
  fi
  [[ -x "$directory/$executable" ]] || fail "Homebrew $formula did not provide $executable"
  printf '%s\n' "$directory"
}

platform=$(uname -s) || fail "cannot identify the test platform"
if [[ "$platform" == Darwin ]]; then
  command -v brew >/dev/null 2>&1 || fail "Homebrew is required on macOS"
  [[ -n "${GITHUB_PATH:-}" && -f "$GITHUB_PATH" && -w "$GITHUB_PATH" ]] || fail "GitHub PATH publication is unavailable"
  timeout_directory=$(formula_directory coreutils libexec/gnubin timeout)
  bash_directory=$(formula_directory bash bin bash)
  export PATH="$bash_directory:$timeout_directory:$PATH"
  verify_tools "$timeout_directory/timeout" "$bash_directory/bash"
  # Publish only after both tools pass. Later steps must select this real Bash.
  printf '%s\n%s\n' "$timeout_directory" "$bash_directory" >> "$GITHUB_PATH" || fail "cannot publish GitHub PATH"
else
  timeout_command=$(command -v timeout) || fail "GNU timeout is unavailable"
  bash_command=$(command -v bash) || fail "Bash is unavailable"
  verify_tools "$timeout_command" "$bash_command"
fi
printf 'Release test prerequisites verified.\n'
