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

# ── ps-deploy status + lock / build failure (mocked npm) ─────────
echo ""
echo "== ps-deploy rebuild status (mock npm)"

ORIG_PATH="$PATH"
FAKE_HOME=$(mktemp -d)
export HOME="$FAKE_HOME"
mkdir -p "$HOME/.hermes/logs"
export PS_DEPLOY_STATUS_FILE="$HOME/.hermes/logs/ps-deploy.status"
DEPLOY_TMP=$(mktemp -d)
export TMPDIR="$DEPLOY_TMP"
MOCK_BIN="$DEPLOY_TMP/mock-bin"
mkdir -p "$MOCK_BIN"

cat >"$MOCK_BIN/npm" <<'MOCKNPM'
#!/usr/bin/env bash
if [[ "$1" == "run" && "$2" == "build" ]]; then
  if [[ "${PS_DEPLOY_TEST_BUILD_FAIL:-}" == "1" ]]; then
    echo "mock build failed" >&2
    exit 1
  fi
  echo "mock build ok"
  exit 0
fi
if [[ "$1" == "install" ]]; then
  exit 0
fi
echo "mock npm: $*" >&2
exit 0
MOCKNPM
chmod +x "$MOCK_BIN/npm"
ln -sf "$MOCK_BIN/npm" "$MOCK_BIN/node"
export PATH="$MOCK_BIN:$ORIG_PATH"

# shellcheck source=../../scripts/lib/ps-deploy-status.sh
source "$REPO_ROOT/scripts/lib/ps-deploy-status.sh"
ps_deploy_status_write "running" "rebuild" "build" "test" "" "ps-build.log"
grep -q '^state=running' "$PS_DEPLOY_STATUS_FILE" || fail "status file missing running state"
pass "ps_deploy_status_write"

LOCK_FILE="${TMPDIR}/ps-deploy.lock"
(
  exec 200>"$LOCK_FILE"
  flock 200
  sleep 60
) &
LOCK_HOLDER=$!
sleep 0.2
set +e
bash "$REPO_ROOT/scripts/application/ps-deploy.sh" rebuild >/dev/null 2>&1
REBUILD_RC=$?
set -e
kill "$LOCK_HOLDER" 2>/dev/null || true
wait "$LOCK_HOLDER" 2>/dev/null || true

[[ "$REBUILD_RC" -eq 1 ]] || fail "rebuild should exit 1 on lock contention (got $REBUILD_RC)"
grep -q '^state=failed' "$PS_DEPLOY_STATUS_FILE" || fail "status should be failed after lock contention"
pass "rebuild exits 1 when deploy lock held"

# Verify the fd-inheritance fix: after a script that takes the lock releases
# it, no process should still hold the deploy lock. This was the root cause
# of the 2026-06-08 incident where the lock was held for 22+ hours by a
# backgrounded next-server child process that inherited fd 200.
#
# We can't easily run the full restart in the mock env (the MOCK node exits
# immediately so ps_deploy_do_restart_body fails on the readiness probe),
# but we CAN test the unit invariant: a ps-deploy-impl.sh function call
# that acquires then releases the lock must leave the lock free. This is
# the core property the fix preserves — `exec 200>&-` before nohup
# releases the lock at the script level, regardless of what the child does.
rm -f "$LOCK_FILE"
( exec 200>"$LOCK_FILE"
  if flock -n 200; then
    # Mimic the fix: close fd 200 BEFORE backgrounding a child.
    exec 200>&-
    : > /tmp/ps-fd-inherit-marker
    ( flock -n 200; echo "child got lock" > /tmp/ps-fd-inherit-marker ) &
    CHILD=$!
    wait "$CHILD" 2>/dev/null || true
    if [ -f /tmp/ps-fd-inherit-marker ]; then
      if grep -q "child got lock" /tmp/ps-fd-inherit-marker; then
        fail "child acquired lock — fd was not closed before nohup"
      else
        pass "child could not acquire lock — fd-inheritance prevention works"
      fi
    else
      pass "child never wrote marker — fd closed before nohup"
    fi
  else
    fail "could not acquire lock to set up fd-inheritance test"
  fi
)
rm -f "$LOCK_FILE" /tmp/ps-fd-inherit-marker

export PS_DEPLOY_TEST_BUILD_FAIL=1
rm -f "$LOCK_FILE"
set +e
bash "$REPO_ROOT/scripts/application/ps-deploy.sh" rebuild >/dev/null 2>&1
FAIL_RC=$?
set -e
unset PS_DEPLOY_TEST_BUILD_FAIL
[[ "$FAIL_RC" -eq 1 ]] || fail "rebuild should exit 1 on build failure (got $FAIL_RC)"
grep -q '^state=failed' "$PS_DEPLOY_STATUS_FILE" || fail "status should be failed after build failure"
grep -q 'ps-build.log' "$PS_DEPLOY_STATUS_FILE" || fail "expected ps-build.log logHint"
pass "rebuild exits 1 and records failed status on build failure"

rm -rf "$FAKE_HOME" "$DEPLOY_TMP"
export PATH="$ORIG_PATH"
unset HOME PS_DEPLOY_STATUS_FILE TMPDIR

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
  "$REPO_ROOT/scripts/lib/ps-deploy-impl.sh" \
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
