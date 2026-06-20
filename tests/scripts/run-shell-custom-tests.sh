#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Validates scripts/lib/ps-dotenv-local.sh and ps-hermes-profile-templates.sh
# plus ps-hermes-profile-templates.sh (install-only; update uses seed-catalog.ts).
#
# Safe: uses mktemp fake HERMES_HOME only.
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
TESTS_RUN=0
TESTS_FAIL=0
TMP_ENV=""
FAKE_HOME=""

pass() {
  TESTS_RUN=$((TESTS_RUN + 1))
  echo "  OK: $*"
}

fail() {
  TESTS_RUN=$((TESTS_RUN + 1))
  TESTS_FAIL=$((TESTS_FAIL + 1))
  echo "  FAIL: $*" >&2
}

cleanup() {
  rm -rf "${TMP_ENV:-}" "${FAKE_HOME:-}" 2>/dev/null || true
}
trap cleanup EXIT

report() {
  echo ""
  echo "Shell custom tests: $TESTS_RUN run, $TESTS_FAIL failed"
  [ "$TESTS_FAIL" -eq 0 ]
}

echo "== Repo root: $REPO_ROOT"

# ── dotenv loader ───────────────────────────────────────────────
echo ""
echo "== ps-dotenv-local.sh"

TMP_ENV=$(mktemp -d)
mkdir -p "$TMP_ENV"
printf '%s\n' \
  '# comment' \
  'FOO=ignored' \
  'PS_READ_ONLY=0' \
  'HERMES_HOME=/tmp/from-dotenv' \
  'INSTALL_HERMES_PROFILE_TEMPLATES=yes' \
  'PS_DATA_DIR=/tmp/chdata' \
  >"$TMP_ENV/.env.local"

# shellcheck source=../../scripts/lib/ps-dotenv-local.sh
source "$REPO_ROOT/scripts/lib/ps-dotenv-local.sh"

unset HERMES_HOME INSTALL_HERMES_PROFILE_TEMPLATES PS_DATA_DIR PS_READ_ONLY FOO || true
ps_load_patterstage_env_local "$TMP_ENV"

[[ -z "${FOO+x}" ]] || fail "FOO should not be exported"
[[ "${PS_READ_ONLY:-}" == "0" ]] || fail "expected PS_READ_ONLY from dotenv"
[[ "${HERMES_HOME:-}" == "/tmp/from-dotenv" ]] || fail "expected HERMES_HOME from dotenv"
[[ "${INSTALL_HERMES_PROFILE_TEMPLATES:-}" == "yes" ]] || fail "expected INSTALL_HERMES_PROFILE_TEMPLATES"
[[ "${PS_DATA_DIR:-}" == "/tmp/chdata" ]] || fail "expected PS_DATA_DIR"
pass "loads whitelisted keys from .env.local"

printf '# CRLF line\r\nPS_READ_ONLY=1\r\n' >>"$TMP_ENV/.env.local"
unset PS_READ_ONLY || true
ps_load_patterstage_env_local "$TMP_ENV"
[[ "${PS_READ_ONLY:-}" == "1" ]] || fail "CRLF strip for PS_READ_ONLY"
pass "strips CR on keys"

# Back-compat: a legacy CH_* key loads literally AND bridges to its PS_* name.
printf 'CH_ENABLE_DEPLOY_API=1\n' >>"$TMP_ENV/.env.local"
unset PS_ENABLE_DEPLOY_API CH_ENABLE_DEPLOY_API || true
ps_load_patterstage_env_local "$TMP_ENV"
[[ "${CH_ENABLE_DEPLOY_API:-}" == "1" ]] || fail "legacy CH_ key should load literally"
[[ "${PS_ENABLE_DEPLOY_API:-}" == "1" ]] || fail "CH_ key should bridge to PS_"
pass "legacy CH_* keys bridge to PS_*"

rm -rf "$TMP_ENV"
TMP_ENV=""

# ── Hermes profile library ────────────────────────────────────
echo ""
echo "== ps-hermes-profile-templates.sh"

FAKE_HOME=$(mktemp -d)

export HOME="$FAKE_HOME"
export HERMES_HOME="$FAKE_HOME/hermes"
mkdir -p "$HERMES_HOME/profiles"

# shellcheck source=../../scripts/lib/ps-hermes-profile-templates.sh
source "$REPO_ROOT/scripts/lib/ps-hermes-profile-templates.sh"

unset HERMES_HOME || true
ps_resolve_hermes_home
[[ "$HERMES_HOME" == "$HOME/.hermes" ]] || fail "default HERMES_HOME should be \$HOME/.hermes"
pass "ps_resolve_hermes_home defaults to \$HOME/.hermes"

export HERMES_HOME="$FAKE_HOME/hermes"
ps_resolve_hermes_home
[[ "$HERMES_HOME" == "$FAKE_HOME/hermes" ]] || fail "explicit HERMES_HOME preserved"
pass "ps_resolve_hermes_home respects env"

rm -f "$HERMES_HOME/config.yaml"
ps_resolve_hermes_home
if ps_hermes_config_present; then fail "config absent should be false"; fi
pass "ps_hermes_config_present false without config.yaml"

touch "$HERMES_HOME/config.yaml"
ps_resolve_hermes_home
ps_hermes_config_present || fail "config present should be true"
pass "ps_hermes_config_present true with config.yaml"

# Install must not overwrite existing SOUL.md (data/seed/profiles/<slug>)
mkdir -p "$HERMES_HOME/profiles/qa"
echo 'USER_CUSTOM_SOUL' >"$HERMES_HOME/profiles/qa/SOUL.md"
printf '{}' >"$HERMES_HOME/auth.json"

ps_bundled_profiles_install "$REPO_ROOT"
[[ "$(cat "$HERMES_HOME/profiles/qa/SOUL.md")" == "USER_CUSTOM_SOUL" ]] || fail "install overwrote existing qa/SOUL.md"
pass "install preserves existing SOUL.md"

[[ -f "$HERMES_HOME/profiles/qa/AGENTS.md" ]] || fail "install should add missing AGENTS.md for qa"
grep -q "QA — Development Guide" "$HERMES_HOME/profiles/qa/AGENTS.md" || fail "qa AGENTS content unexpected"
pass "install adds missing AGENTS.md from template"

rm -rf "$HERMES_HOME/profiles/devops"
ps_bundled_profiles_install "$REPO_ROOT"
[[ -f "$HERMES_HOME/profiles/devops/SOUL.md" ]] || fail "devops SOUL missing after install"
grep -q "DevOps — Development Guide" "$HERMES_HOME/profiles/devops/AGENTS.md" || fail "devops AGENTS missing expected phrase"
pass "install creates missing profile dirs and copies templates"

# ── ps-backup.sh (mock hindsight_bridge.py) ───────────────────
echo ""
echo "== ps-backup.sh (mock bridge)"

BKROOT="$(mktemp -d)"
mkdir -p "$BKROOT/scripts" "$BKROOT/hermes-agent/venv/bin" "$BKROOT/out"
ln -sf "$(command -v python3)" "$BKROOT/hermes-agent/venv/bin/python3"
cat >"$BKROOT/scripts/hindsight_bridge.py" <<'PY'
#!/usr/bin/env python3
import json
import sys

cmd = sys.argv[1] if len(sys.argv) > 1 else ""
if cmd == "list":
    print(json.dumps({"memories": [{"id": "m1", "content": "x"}], "count": 1, "total": 99}))
elif cmd == "directives":
    print(json.dumps({"directives": [{"id": "d1", "name": "n"}]}))
elif cmd == "mental-models":
    print(json.dumps({"models": [{"id": "mm1", "name": "M"}]}))
else:
    print(json.dumps({"error": "bad cmd", "cmd": cmd}))
    sys.exit(1)
PY
chmod +x "$BKROOT/scripts/hindsight_bridge.py"

HERMES_HOME="$BKROOT" \
  HINDSIGHT_BACKUP_DIR="$BKROOT/out" \
  HINDSIGHT_BACKUP_BANK="testbank" \
  HINDSIGHT_BACKUP_RETENTION_DAYS="365" \
  HINDSIGHT_BACKUP_LIMIT="10" \
  bash "$REPO_ROOT/scripts/hardware/ps-backup.sh" || fail "ps-backup.sh exited non-zero"

latest=""
latest=$(ls -t "$BKROOT/out"/testbank-*.json 2>/dev/null | head -1)
[[ -n "$latest" ]] || fail "expected testbank-*.json in backup dir"
jq -e '.bank == "testbank" and (.memories | length) == 1 and (.directives | length) == 1 and (.mental_models | length) == 1' "$latest" >/dev/null 2>&1 || fail "merged json shape unexpected: $latest"
pass "ps-backup.sh wrote valid merged snapshot"

rm -rf "$BKROOT"


# setup.sh preserves HERMES_HOME from existing .env.local
echo ""
echo "== setup.sh HERMES_HOME preservation"
SETUP_REPO=$(mktemp -d)
printf '%s\n' 'HERMES_HOME=/custom/hermes/from-dotenv' > "$SETUP_REPO/.env.local"
# shellcheck source=../../scripts/lib/ps-dotenv-local.sh
source "$REPO_ROOT/scripts/lib/ps-dotenv-local.sh"
ps_load_patterstage_env_local "$SETUP_REPO"
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
if [[ "$HERMES_HOME" == "/custom/hermes/from-dotenv" ]]; then
  pass "ps_load_patterstage_env_local preserves custom HERMES_HOME before setup default"
else
  fail "expected /custom/hermes/from-dotenv, got $HERMES_HOME"
fi
rm -rf "$SETUP_REPO"

# bash -n on touched scripts
echo ""
echo "== bash -n on scripts"
for f in \
  "$REPO_ROOT/scripts/bootstrap/setup.sh" \
  "$REPO_ROOT/scripts/bootstrap/install.sh" \
  "$REPO_ROOT/scripts/application/ps-deploy.sh" \
  "$REPO_ROOT/scripts/lib/ps-deploy-status.sh" \
  "$REPO_ROOT/scripts/lib/ps-hermes-profile-templates.sh" \
  "$REPO_ROOT/scripts/lib/ps-dotenv-local.sh" \
  "$REPO_ROOT/scripts/hardware/ps-backup.sh"; do
  bash -n "$f" || fail "bash -n $f"
  pass "bash -n $(basename "$f")"
done

echo ""
# Note: full ps-deploy restart / port-free / fixture-git smoke is not in this harness
# (see docs/TESTING.md — CI docker-image job + manual staging checks).
echo "All shell custom checks passed."
if ! report; then
  exit 1
fi
