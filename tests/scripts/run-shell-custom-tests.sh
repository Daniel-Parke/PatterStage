#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Bash checks for the install and deploy helpers:
#   the ps-dotenv-local.sh loader, the ps-hermes-profile-templates.sh install
#   rules, ps-backup.sh (snapshot + interpreter resolution), and the writers the
#   stdout-capture bug class runs through: ps-port.sh, ps-env.sh and
#   scripts/bootstrap/env-local.mjs. Ends with a bash -n sweep.
#
# Safe: every check works inside its own mktemp directory. Nothing here reads
# or writes the repo's real .env.local, and HERMES_HOME is always a fake.
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

# A check made of several assertions: group_begin, then the assertions, then
# group_pass, which prints the OK line only when none of them called fail.
# Without this a broken check reports its failures AND an OK for itself.
GROUP_FAILS=0
group_begin() { GROUP_FAILS="$TESTS_FAIL"; }
group_pass() {
  if [ "$TESTS_FAIL" -eq "$GROUP_FAILS" ]; then pass "$*"; fi
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

# ── ps_env_set_if_absent (B1, T-0095, decision 17) ───────────────
# setup writes PS_ENABLE_DEPLOY_API=true on a fresh install and must never
# flip a value the operator set on purpose. Placed here, ahead of the
# sections that need a Unix /tmp and symlinks, so it also runs on a Windows
# Git Bash where those cannot.
echo ""
echo "== ps-env.sh: ps_env_set_if_absent"
IA_TMP=$(mktemp -d)
IA_FILE="$IA_TMP/.env.local"
# shellcheck source=../../scripts/lib/ps-env.sh
source "$REPO_ROOT/scripts/lib/ps-env.sh"
group_begin
printf 'PORT=3000\nPS_ENABLE_DEPLOY_API=false\n' >"$IA_FILE"
ps_env_set_if_absent "$IA_FILE" "PS_ENABLE_DEPLOY_API" "true"
grep -q '^PS_ENABLE_DEPLOY_API=false$' "$IA_FILE" || fail "if_absent overwrote an existing value"
if grep -q '^PS_ENABLE_DEPLOY_API=true$' "$IA_FILE"; then fail "if_absent appended a second line"; fi
group_pass "ps_env_set_if_absent leaves an existing value alone"
group_begin
printf 'PORT=3000\n' >"$IA_FILE"
ps_env_set_if_absent "$IA_FILE" "PS_ENABLE_DEPLOY_API" "true"
grep -q '^PS_ENABLE_DEPLOY_API=true$' "$IA_FILE" || fail "if_absent did not write a missing key"
grep -q '^PORT=3000$' "$IA_FILE" || fail "if_absent lost a neighbouring line"
group_pass "ps_env_set_if_absent writes a missing key"
rm -rf "$IA_TMP"

# ── ps-reinstall.sh (B1, T-0095, D106) ───────────────────────────
# install.sh's Reinstall used to rm -rf the install directory, database and
# all, on one keypress. The step is now a function: it moves the data
# directory aside before anything is removed, and it takes a typed word.
echo ""
echo "== ps-reinstall.sh"
# shellcheck source=../../scripts/lib/ps-reinstall.sh
source "$REPO_ROOT/scripts/lib/ps-reinstall.sh"

RI_TMP=$(mktemp -d)
RI_INSTALL="$RI_TMP/patterstage"
RI_BACKUPS="$RI_TMP/backups"
mkdir -p "$RI_INSTALL/data" "$RI_INSTALL/src"
printf 'not really sqlite' >"$RI_INSTALL/data/patterstage.db"
printf 'code' >"$RI_INSTALL/src/x.ts"

group_begin
if printf 'y\n' | ps_reinstall_confirm_and_remove "$RI_INSTALL" "$RI_BACKUPS" >/dev/null 2>&1; then
  fail "reinstall accepted 'y' as consent"
fi
[ -f "$RI_INSTALL/data/patterstage.db" ] || fail "reinstall removed the database on a refused confirmation"
group_pass "reinstall refuses anything but the typed word"

group_begin
RI_OUT="$(printf 'DELETE\n' | ps_reinstall_confirm_and_remove "$RI_INSTALL" "$RI_BACKUPS" 2>&1)" || fail "reinstall failed on a valid confirmation: $RI_OUT"
if [ -d "$RI_INSTALL" ]; then fail "install directory still present after reinstall"; fi
RI_MOVED="$(find "$RI_BACKUPS" -name patterstage.db 2>/dev/null | head -n1)"
[ -n "$RI_MOVED" ] || fail "database was not moved aside before removal"
[ "$(cat "$RI_MOVED")" = "not really sqlite" ] || fail "moved database is not the original"
case "$RI_OUT" in
  *"$RI_BACKUPS"*) ;;
  *) fail "reinstall did not say where it put the data (got: $RI_OUT)" ;;
esac
group_pass "reinstall moves the data directory aside, removes the install, and says where"

group_begin
mkdir -p "$RI_INSTALL/src"
printf 'DELETE\n' | ps_reinstall_confirm_and_remove "$RI_INSTALL" "$RI_BACKUPS" >/dev/null 2>&1 || fail "reinstall without a data dir failed"
if [ -d "$RI_INSTALL" ]; then fail "install directory still present (no data dir case)"; fi
group_pass "reinstall with no data directory simply removes"
rm -rf "$RI_TMP"

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

# ── PORT resolution + dotenv writer (the stdout-capture bug class) ──
# The interactive port prompt runs inside $( ), so its stdout IS the value the
# caller stores. A banner line printed there becomes the PORT, and the old
# grep-based de-dup could not remove the orphan lines it had just written, so
# the corruption survived every re-run. These checks pin both halves shut.
echo ""
echo "== ps-port.sh / ps-env.sh (stdout capture + dotenv writer)"

# True when every non-blank line is a comment or KEY=VALUE, i.e. no orphan prose.
env_lines_are_clean() {
  local f="$1" line
  [ -f "$f" ] || return 1
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in
      '' | \#*) continue ;;
    esac
    [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || return 1
  done <"$f"
  return 0
}

# One-line rendering of a dotenv file, for readable failure messages.
env_flat() {
  tr '\n' '|' <"$1" | head -c 240
}

# Drive ps_setup_port_and_dev_origins down its INTERACTIVE branch: CI and PORT
# are unset so the non-interactive branch cannot be taken, and stdin is the
# operator typing. This is the path that had no test at all.
run_port_setup() {
  env -u CI -u PS_INSTALL_NONINTERACTIVE -u PORT bash -c '
    set -u
    source "$1/scripts/lib/ps-env.sh"
    source "$1/scripts/lib/ps-port.sh"
    ps_setup_port_and_dev_origins "$2"
  ' _ "$REPO_ROOT" "$1"
}

group_begin
PORTREPO="$(mktemp -d)"
printf '%s\n' 'HERMES_HOME=/keep/me' >"$PORTREPO/.env.local"
printf '45123\n' | run_port_setup "$PORTREPO" >/dev/null 2>&1 || true

if [ "$(grep -c '^PORT=' "$PORTREPO/.env.local" 2>/dev/null || true)" != "1" ]; then
  fail "interactive PORT: expected exactly one PORT= line, got: $(env_flat "$PORTREPO/.env.local")"
fi
if ! grep -qE '^PORT=45123$' "$PORTREPO/.env.local"; then
  fail "interactive PORT: expected a bare PORT=45123, got: $(env_flat "$PORTREPO/.env.local")"
fi
if ! env_lines_are_clean "$PORTREPO/.env.local"; then
  fail "interactive PORT: .env.local carries orphan (non KEY=VALUE) lines: $(env_flat "$PORTREPO/.env.local")"
fi
if ! grep -q '^HERMES_HOME=/keep/me$' "$PORTREPO/.env.local"; then
  fail "interactive PORT: an unrelated key was dropped"
fi
if ! grep -qE '^PS_ALLOWED_DEV_ORIGINS=http://localhost:45123,' "$PORTREPO/.env.local"; then
  fail "interactive PORT: PS_ALLOWED_DEV_ORIGINS was not built from the typed port"
fi
group_pass "typed port is written bare; the prompt banner is not"

group_begin
PORTREPO_AUTO="$(mktemp -d)"
printf '\n' | run_port_setup "$PORTREPO_AUTO" >/dev/null 2>&1 || true
if ! grep -qE '^PORT=[0-9]+$' "$PORTREPO_AUTO/.env.local" 2>/dev/null; then
  fail "auto PORT: expected a bare numeric PORT line, got: $(env_flat "$PORTREPO_AUTO/.env.local")"
fi
if ! env_lines_are_clean "$PORTREPO_AUTO/.env.local"; then
  fail "auto PORT: .env.local carries orphan lines: $(env_flat "$PORTREPO_AUTO/.env.local")"
fi
group_pass "Enter = auto writes a bare numeric PORT"

# The guard that closes the class: whatever pollutes the capture in future, a
# non-port must never reach .env.local.
group_begin
GUARDREPO="$(mktemp -d)"
if env -u CI -u PS_INSTALL_NONINTERACTIVE -u PORT bash -c '
  set -u
  source "$1/scripts/lib/ps-env.sh"
  source "$1/scripts/lib/ps-port.sh"
  # Stand-in for any future logger that writes good news to stdout in here.
  ps_resolve_port_interactive() {
    echo "PatterStage will listen on a TCP port (Next.js PORT)."
    printf "%s" "45124"
  }
  ps_setup_port_and_dev_origins "$2"
' _ "$REPO_ROOT" "$GUARDREPO" >/dev/null 2>&1; then
  fail "polluted capture: ps_setup_port_and_dev_origins reported success"
fi
if [ -f "$GUARDREPO/.env.local" ] && grep -q '^PORT=' "$GUARDREPO/.env.local"; then
  fail "polluted capture: a PORT line was written anyway: $(env_flat "$GUARDREPO/.env.local")"
fi
group_pass "ps_validate_port_number rejects a polluted interactive capture"

group_begin
ENVREPO="$(mktemp -d)"
printf '%s\n' 'HERMES_HOME=/keep/me' >"$ENVREPO/.env.local"
MULTILINE_VAL="$(printf 'PatterStage will listen on a TCP port.\n45125')"
if bash -c '
  set -u
  source "$1/scripts/lib/ps-env.sh"
  ps_env_set "$2/.env.local" "PORT" "$3"
' _ "$REPO_ROOT" "$ENVREPO" "$MULTILINE_VAL" >/dev/null 2>&1; then
  fail "ps_env_set accepted a multi-line value"
fi
if grep -q '^PORT=' "$ENVREPO/.env.local"; then
  fail "ps_env_set wrote a PORT line from a multi-line value: $(env_flat "$ENVREPO/.env.local")"
fi
if ! grep -q '^HERMES_HOME=/keep/me$' "$ENVREPO/.env.local"; then
  fail "ps_env_set lost an unrelated key while refusing"
fi
group_pass "ps_env_set refuses a multi-line value"

# Sticky corruption: the de-dup must be able to clear what an earlier bad write
# left behind, not just the KEY= line it recognises.
group_begin
STICKY="$(mktemp -d)"
{
  printf '%s\n' 'HERMES_HOME=/keep/me'
  printf '%s\n' '# a real comment survives'
  printf '%s\n' 'PORT='
  printf '%s\n' 'PatterStage will listen on a TCP port (Next.js PORT).'
  printf '%s\n' '  * Press Enter for auto: first free port in 42069-42100.'
  printf '%s\n' 'Port [Enter = auto]: 45126'
} >"$STICKY/.env.local"
bash -c '
  set -u
  source "$1/scripts/lib/ps-env.sh"
  ps_env_set "$2/.env.local" "PORT" "45126"
' _ "$REPO_ROOT" "$STICKY"
if ! env_lines_are_clean "$STICKY/.env.local"; then
  fail "ps_env_set left orphan lines from an already-corrupted file: $(env_flat "$STICKY/.env.local")"
fi
if [ "$(grep -c '^PORT=' "$STICKY/.env.local" 2>/dev/null || true)" != "1" ]; then
  fail "ps_env_set: expected exactly one PORT= line after cleanup"
fi
if ! grep -qE '^PORT=45126$' "$STICKY/.env.local"; then
  fail "ps_env_set: expected PORT=45126 after cleanup"
fi
if ! grep -q '^HERMES_HOME=/keep/me$' "$STICKY/.env.local"; then
  fail "ps_env_set: cleanup dropped an unrelated key"
fi
if ! grep -q '^# a real comment survives$' "$STICKY/.env.local"; then
  fail "ps_env_set: cleanup dropped a comment line"
fi
group_pass "ps_env_set clears the orphan lines an earlier corruption left behind"

rm -rf "$PORTREPO" "$PORTREPO_AUTO" "$GUARDREPO" "$ENVREPO" "$STICKY"

# ── setup.mjs dotenv writer (same defect, Node side) ────────────
echo ""
echo "== scripts/bootstrap/env-local.mjs (the setup.mjs writer)"

if ! command -v node >/dev/null 2>&1; then
  fail "node is required for the env-local.mjs checks"
else
  group_begin
  NODEREPO="$(mktemp -d)"
  {
    printf '%s\n' 'HERMES_HOME=/keep/me'
    printf '%s\n' '# a real comment survives'
    printf '%s\n' 'PORT='
    printf '%s\n' 'PatterStage will listen on a TCP port (Next.js PORT).'
    printf '%s\n' '45127'
  } >"$NODEREPO/.env.local"

  cat >"$NODEREPO/check.mjs" <<'MJS'
const [modUrl, envFile] = process.argv.slice(2);
const { setEnvVar } = await import(modUrl);

setEnvVar(envFile, "PORT", "45127");

let threw = false;
try {
  setEnvVar(envFile, "PORT", "PatterStage will listen on a TCP port.\n45127");
} catch {
  threw = true;
}
if (!threw) {
  console.error("setEnvVar accepted a multi-line value");
  process.exit(2);
}

let threwKey = false;
try {
  setEnvVar(envFile, "not a key", "1");
} catch {
  threwKey = true;
}
if (!threwKey) {
  console.error("setEnvVar accepted a non-identifier key");
  process.exit(3);
}
MJS

  if ! node "$NODEREPO/check.mjs" "file://$REPO_ROOT/scripts/bootstrap/env-local.mjs" "$NODEREPO/.env.local" >/dev/null 2>&1; then
    fail "env-local.mjs setEnvVar did not refuse a multi-line value or a bad key"
  fi
  if ! env_lines_are_clean "$NODEREPO/.env.local"; then
    fail "env-local.mjs left orphan lines: $(env_flat "$NODEREPO/.env.local")"
  fi
  if [ "$(grep -c '^PORT=' "$NODEREPO/.env.local" 2>/dev/null || true)" != "1" ]; then
    fail "env-local.mjs: expected exactly one PORT= line"
  fi
  if ! grep -qE '^PORT=45127$' "$NODEREPO/.env.local"; then
    fail "env-local.mjs: expected PORT=45127"
  fi
  if ! grep -q '^HERMES_HOME=/keep/me$' "$NODEREPO/.env.local"; then
    fail "env-local.mjs: dropped an unrelated key"
  fi
  if ! grep -q '^# a real comment survives$' "$NODEREPO/.env.local"; then
    fail "env-local.mjs: dropped a comment line"
  fi
  group_pass "setEnvVar refuses multi-line values and clears orphan lines"
  rm -rf "$NODEREPO"
fi

# ── ps-backup.sh resolve_python: return, never exit ─────────────
# The function is only ever run inside $( ). An exit there kills the subshell
# and hands the caller an empty interpreter path, so the contract has to be a
# return status. Call it OUTSIDE a subshell: an exit would take this shell with
# it and the sentinel would never print.
echo ""
echo "== ps-backup.sh resolve_python (return, not exit)"

group_begin
RP_EMPTY="$(mktemp -d)"
RP_OUT="$(bash -c '
  set -uo pipefail
  eval "$(sed -n "/^hermes_default_root()/,/^}/p;/^resolve_python()/,/^}/p" "$1")"
  HOME="$2"
  HERMES_HOME="$2"
  resolve_python "$2" >/dev/null 2>&1
  echo "SURVIVED rc=$?"
' _ "$REPO_ROOT/scripts/hardware/ps-backup.sh" "$RP_EMPTY" 2>/dev/null || true)"
if [ "$RP_OUT" != "SURVIVED rc=1" ]; then
  fail "resolve_python must return 1, not exit its caller (got: ${RP_OUT})"
fi
group_pass "resolve_python returns non-zero instead of exiting the shell"

# And the caller must still refuse to run with no interpreter.
group_begin
mkdir -p "$RP_EMPTY/scripts"
printf '%s\n' '#!/usr/bin/env python3' >"$RP_EMPTY/scripts/hindsight_bridge.py"
RP_ERR="$(HERMES_HOME="$RP_EMPTY" bash "$REPO_ROOT/scripts/hardware/ps-backup.sh" 2>&1 >/dev/null || true)"
if HERMES_HOME="$RP_EMPTY" bash "$REPO_ROOT/scripts/hardware/ps-backup.sh" >/dev/null 2>&1; then
  fail "ps-backup.sh exited 0 with no Hermes venv"
fi
case "$RP_ERR" in
  *"venv not found"*) ;;
  *) fail "ps-backup.sh did not report the missing venv (got: ${RP_ERR})" ;;
esac
group_pass "ps-backup.sh stops when the interpreter cannot be resolved"
rm -rf "$RP_EMPTY"

# bash -n on touched scripts
echo ""
echo "== bash -n on scripts"
for f in \
  "$REPO_ROOT/scripts/bootstrap/setup.sh" \
  "$REPO_ROOT/scripts/bootstrap/install.sh" \
  "$REPO_ROOT/scripts/application/ps-deploy.sh" \
  "$REPO_ROOT/scripts/lib/ps-deploy-status.sh" \
  "$REPO_ROOT/scripts/lib/ps-reinstall.sh" \
  "$REPO_ROOT/scripts/lib/ps-hermes-profile-templates.sh" \
  "$REPO_ROOT/scripts/lib/ps-dotenv-local.sh" \
  "$REPO_ROOT/scripts/lib/ps-port.sh" \
  "$REPO_ROOT/scripts/lib/ps-env.sh" \
  "$REPO_ROOT/scripts/lib/ps-log.sh" \
  "$REPO_ROOT/scripts/hardware/ps-backup.sh"; do
  bash -n "$f" || fail "bash -n $f"
  pass "bash -n $(basename "$f")"
done

echo ""
# Note: full ps-deploy restart / port-free / fixture-git smoke is not in this harness
# (see docs/contributing/testing.md — CI docker-image job + manual staging checks).
echo "All shell custom checks passed."
if ! report; then
  exit 1
fi
