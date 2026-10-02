#!/usr/bin/env python3
"""T-0202: execute Harness.http_smoke with stdlib HTTP and owned Bash shims.

The HTTP listener follows a launch marker; the real shell PID is checked after
the generated script exits, before fixture cleanup. No Docker or app launches.
Container /tmp paths are relocated. Sleeps and explicit curl timeouts are
shortened; missing request bounds remain missing. Raw output stays private.
"""
from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import secrets
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from socketserver import TCPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
BRIDGE_PATH = Path(__file__).resolve().with_name("release-install-http-curl-bridge.py")
_bridge_spec = importlib.util.spec_from_file_location("release_install_http_curl_bridge", BRIDGE_PATH)
if _bridge_spec is None or _bridge_spec.loader is None:
    raise RuntimeError("Cannot load release-install curl bridge")
_bridge_module = importlib.util.module_from_spec(_bridge_spec)
_bridge_spec.loader.exec_module(_bridge_module)
CurlBridge = _bridge_module.CurlBridge
CASES = ("control", "healthy", "wrong-credential", "anonymous-200", "health-204",
         "health-503", "health-redirect", "anonymous-redirect", "auth-redirect",
         "auth-403", "dead-launch", "occupied-listener", "stalled", "stubborn")
DEFAULT_CASES = ("default-control", "default-fresh", "default-uppercase-db",
                 "default-uppercase-legacy-db", "default-wrong-token", "default-wrong-control")


class LoopbackHttpServer(ThreadingHTTPServer):
    """Bind the numeric loopback listener without resolving a host name."""

    def server_bind(self) -> None:
        TCPServer.server_bind(self)
        self.server_name, self.server_port = self.socket.getsockname()[:2]


def shell_path(path: Path) -> str:
    value = path.resolve().as_posix()
    return f"/{value[0].lower()}{value[2:]}" if os.name == "nt" else value


def shell_file(path: Path, source: str) -> None:
    path.write_text(source, encoding="utf-8", newline="\n")
    path.chmod(0o700)


SUPERVISOR = r'''
if [[ "$OSTYPE" == darwin* ]]; then
  export PATH="$T0202_ROOT/bin:${BASH%/*}:/usr/bin:/bin:$PATH"
else
  export PATH="$T0202_ROOT/bin:/usr/bin:/bin:$PATH"
fi
export T0202_RPC_CLIENT=$(type -P curl)
# Python holds the pipe's writer open. A builtin wait avoids launching a Git
# Bash sleep process for every accelerated poll. EOF/data is fixture failure.
exec 9<&0 || exit 90
fixture_pause() {
  local status value=''
  if IFS= read -r -t "$1" -u 9 value; then status=0; else status=$?; fi
  if [[ "$status" != 142 || -n "$value" ]]; then
    printf 'invalid-timer\n' >> "$T0202_ROOT/fixture-error"
    return 90
  fi
}
sleep() { fixture_pause 0.01; }
curl() {
  local args=() arg flag='' bounded=0 connected=0
  for arg in "$@"; do
    if [[ -n "$flag" ]]; then
      if [[ "$arg" =~ ^[0-9]+([.][0-9]+)?$ && "$arg" =~ [1-9] ]]; then
        [[ "$flag" == total ]] && bounded=1 || connected=1
        args+=(0.1)
      else args+=("$arg"); fi
      flag=''; continue
    fi
    case "$arg" in
      --max-time|-m) flag=total; args+=("$arg");;
      --connect-timeout) flag=connect; args+=("$arg");;
      --max-time=*|--connect-timeout=*)
        if [[ "${arg#*=}" =~ ^[0-9]+([.][0-9]+)?$ && "${arg#*=}" =~ [1-9] ]]; then
          [[ "$arg" == --max-time=* ]] && bounded=1 || connected=1
          args+=("${arg%%=*}=0.1")
        else args+=("$arg"); fi;;
      *) args+=("$arg");;
    esac
  done
  printf '%s %s\n' "$bounded" "$connected" >> "$T0202_ROOT/bounds"
  if [[ ! -f "$T0202_ROOT/rpc-ready" ]]; then
    if ! command "$T0202_RPC_PYTHON" "$T0202_RPC_HELPER" --register "$T0202_RPC_PORT" "$T0202_RPC_CLIENT" "${args[@]}"; then
      printf 'rpc-registration\n' >> "$T0202_ROOT/fixture-error"; return 90
    fi
  fi
  local channel kind status output errors
  if ! exec {channel}<>"/dev/tcp/127.0.0.1/$T0202_RPC_PORT"; then
    printf 'rpc-connect\n' >> "$T0202_ROOT/fixture-error"; return 90
  fi
  printf '%s\0' T0202 "$T0202_RPC_KEY" "${#args[@]}" "$T0202_RPC_CLIENT" "${args[@]}" >&"$channel"
  if ! IFS= read -r -d '' -t 25 kind <&"$channel" || [[ "$kind" != OK ]] ||
     ! IFS= read -r -d '' -t 25 status <&"$channel" ||
     ! IFS= read -r -d '' -t 25 output <&"$channel" ||
     ! IFS= read -r -d '' -t 25 errors <&"$channel"; then
    exec {channel}>&-
    printf 'rpc-protocol\n' >> "$T0202_ROOT/fixture-error"; return 90
  fi
  exec {channel}>&-
  if [[ ! "$status" =~ ^[0-9]+$ ]] || ((status > 255)); then
    printf 'rpc-status\n' >> "$T0202_ROOT/fixture-error"; return 90
  fi
  printf '%s' "$errors" >&2
  printf '%s' "$output"
  return "$status"
}
kill() {
  local target="${!#}" owned='' decoy=''
  if [[ "$1" == -0 ]]; then builtin kill "$@"; return "$?"; fi
  [[ -f "$T0202_ROOT/owned.pid" ]] && owned=$(<"$T0202_ROOT/owned.pid")
  [[ -f "$T0202_ROOT/decoy.pid" ]] && decoy=$(<"$T0202_ROOT/decoy.pid")
  if [[ "$target" != "$owned" && "$target" != "$decoy" ]]; then
    printf 'forbidden\n' >> "$T0202_ROOT/signals"; return 1
  fi
  printf '%s\n' "$target" >> "$T0202_ROOT/signals"
  builtin kill "$@"
}
export -f fixture_pause sleep curl kill
"$T0202_ROOT/bin/decoy" >/dev/null 2>&1 &
for ((attempt=0; attempt<100; attempt++)); do
  [[ -f "$T0202_ROOT/decoy.pid" ]] && break
  fixture_pause 0.01
done
trap 'for name in owned decoy; do
  if [[ -f "$T0202_ROOT/$name.pid" ]]; then
    target=$(<"$T0202_ROOT/$name.pid")
    builtin kill -KILL "$target" 2>/dev/null || true
    wait "$target" 2>/dev/null || true
  fi
done' EXIT
cd "$T0202_WORKSPACE"
timeout --kill-after=0.2 6 bash --noprofile --norc "$T0202_ROOT/probe.sh" >"$T0202_ROOT/stdout" 2>"$T0202_ROOT/stderr"
printf '%s\n' "$?" > "$T0202_ROOT/status"
for name in owned decoy; do
  alive=no
  if [[ -f "$T0202_ROOT/$name.pid" ]]; then
    target=$(<"$T0202_ROOT/$name.pid")
    builtin kill -0 "$target" 2>/dev/null && alive=yes
  fi
  printf '%s\n' "$alive" > "$T0202_ROOT/$name.alive"
done
'''

LAUNCH = r'''#!/usr/bin/env bash
printf '%s\n' "$$" > "$T0202_ROOT/owned.pid"
printf 'launch\n' >> "$T0202_ROOT/launches"
if [[ "$T0202_CASE" == dead-launch ]]; then exit 78; fi
if [[ "$T0202_CASE" == occupied-listener ]]; then
  # A healthy foreign listener answers while this child is still alive.
  # The delay is real, not the accelerated readiness sleep function.
  fixture_pause 1 || exit 90
  printf 'bind-failed\n' > "$T0202_ROOT/bind-failure"
  exit 78
fi
touch "$T0202_ROOT/active"
if [[ "$T0202_CASE" == stubborn ]]; then trap '' TERM
else trap 'rm -f "$T0202_ROOT/active"; exit 0' TERM INT; fi
while :; do fixture_pause 0.01 || exit 90; done
'''
DECOY = r'''#!/usr/bin/env bash
printf '%s\n' "$$" > "$T0202_ROOT/decoy.pid"
trap 'exit 0' TERM INT
while :; do fixture_pause 0.01 || exit 90; done
'''


def prepare_defaults(fixture: Path, case: str, token: str) -> tuple[Path, dict[str, object], list[str]]:
    home = fixture / "owned home with spaces"
    uppercase = "uppercase" in case
    data = home / ("PatterStage" if uppercase else "patterstage") / "data"
    data.mkdir(parents=True)
    wrong = "wrong" in case
    file_token = secrets.token_hex(24) if wrong else token
    (data / "auth-token").write_text(file_token, encoding="utf-8")
    database = "control-hub.db" if "legacy" in case else "patterstage.db" if uppercase else None
    if database:
        with contextlib.closing(sqlite3.connect(data / database)) as connection:
            connection.execute("CREATE TABLE fixture (value TEXT)")
            connection.execute("INSERT INTO fixture VALUES ('populated')")
            connection.commit()
    lower = home / "patterstage/data"
    lower.mkdir(parents=True, exist_ok=True)
    distinct = uppercase and not data.samefile(lower)
    credentials = [token, file_token]
    if distinct:
        stale_token = secrets.token_hex(24)
        (lower / "auth-token").write_text(stale_token, encoding="utf-8")
        credentials.append(stale_token)
    return home, {
        "platform": os.name, "homeOwned": home.is_relative_to(fixture),
        "tokenRelativePath": (data / "auth-token").relative_to(home).as_posix(),
        "fileCredential": "wrong" if wrong else "valid", "databaseName": database,
        "lowerDirectoryExists": lower.is_dir(), "physicalCaseDistinct": distinct,
        "staleTokenDistinct": distinct,
        "lowerHasDatabase": any((lower / name).exists() for name in ("patterstage.db", "control-hub.db")),
    }, credentials


def run_case(case: str, bash: str) -> dict[str, object]:
    token = secrets.token_hex(24)
    requests: list[dict[str, object]] = []
    stop = threading.Event()
    with tempfile.TemporaryDirectory(prefix="t0202-http-") as directory:
        fixture = Path(directory)
        install = fixture / "installed workspace with spaces" if case == "healthy" else fixture
        install.mkdir(exist_ok=True)
        for name in ("bin", "scratch"):
            (fixture / name).mkdir()
        defaults, credentials = {}, [token]
        if case in DEFAULT_CASES:
            home, defaults, credentials = prepare_defaults(fixture, case, token)
        else:
            (install / "data").mkdir()
            (install / "data/auth-token").write_text(token, encoding="utf-8")
        for name, source in (("bin/node", LAUNCH), ("bin/decoy", DECOY), ("supervisor.sh", SUPERVISOR)):
            shell_file(fixture / name, source)
        for name in ("pkill", "killall", "fuser", "docker", "npm", "npx"):
            shell_file(fixture / f"bin/{name}", '#!/usr/bin/env bash\nprintf "forbidden\\n" >> "$T0202_ROOT/signals"\nexit 1\n')

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_args: object) -> None:
                pass

            def do_GET(self) -> None:
                if case != "occupied-listener" and not (fixture / "active").exists():
                    self.close_connection = True
                    return
                header = self.headers.get("Authorization", "")
                auth = "absent" if not header else "valid" if header == f"Bearer {token}" else "wrong"
                path = self.path.split("?", 1)[0]
                health = path == "/api/health"
                status = 200 if health or auth == "valid" else 401
                if path == "/redirect-target":
                    status = 200
                elif health:
                    status = {"health-204": 204, "health-503": 503, "health-redirect": 302}.get(case, status)
                elif auth == "absent":
                    status = {"anonymous-200": 200, "anonymous-redirect": 302}.get(case, status)
                else:
                    status = {"wrong-credential": 401, "auth-redirect": 302, "auth-403": 403}.get(case, status)
                requests.append({"path": path, "credential": auth, "status": status})
                if case == "stalled":
                    stop.wait(15)
                    return
                try:
                    self.send_response(status)
                    if status == 302:
                        self.send_header("Location", "/redirect-target")
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                except (BrokenPipeError, ConnectionResetError):
                    pass

        server = LoopbackHttpServer(("127.0.0.1", 0), Handler)
        server.daemon_threads = True
        listener = threading.Thread(target=server.serve_forever, daemon=True)
        listener.start()
        port, workspace = server.server_address[1], shell_path(install)
        (install / ".env.local").write_text(f"PORT={port}\nCH_DATA_DIR={workspace}/data\nPS_DATA_DIR={workspace}/data\n", encoding="utf-8")
        environment = {key: value for key, value in os.environ.items() if not key.startswith(("CH_", "PS_", "CONTROL_HUB_"))}
        environment.update(T0202_ROOT=shell_path(fixture), T0202_WORKSPACE=workspace, T0202_CASE=case, CH_DATA_DIR=f"{workspace}/data", PS_DATA_DIR=f"{workspace}/data")
        if defaults:
            environment.pop("CH_DATA_DIR")
            environment.pop("PS_DATA_DIR")
            environment.update(HOME=shell_path(home), T0202_DEFAULT_TOKEN_FILE=f"{shell_path(home)}/{defaults['tokenRelativePath']}")
            (install / ".env.local").write_text(f"PORT={port}\n", encoding="utf-8")
            defaults.update(dataEnvironmentAbsent=not any(key in environment for key in ("PS_DATA_DIR", "CH_DATA_DIR", "CONTROL_HUB_DATA_DIR")), dotenvKeys=["PORT"])
        output, captured, executions, scripts = io.StringIO(), [], [], []
        listener_controls: list[int] = []

        def content(name: str) -> str:
            return (fixture / name).read_text(encoding="utf-8", errors="replace").strip() if (fixture / name).exists() else ""

        def execute(_container: str, script: str, env: dict[str, str] | None = None, *, workdir: str = "/workspace") -> str:
            del workdir
            # Docker's CalledProcessError can include the entire original script.
            # Check before path adaptation; never export the script or token.
            scripts.append(script)
            shell_file(fixture / "probe.sh", script.replace("/tmp/ch-http-smoke.log", f"{shell_path(fixture)}/scratch/ch-http-smoke.log"))
            timer_read, timer_write = os.pipe()
            try:
                with CurlBridge(fixture, port, {**environment, **(env or {})}, bash) as bridge:
                    result = subprocess.run([bash, "--noprofile", "--norc", f"{shell_path(fixture)}/supervisor.sh"], env={**environment, **(env or {}), "T0202_RPC_PORT": str(bridge.port), "T0202_RPC_KEY": bridge.key, "T0202_RPC_PYTHON": shell_path(Path(sys.executable)), "T0202_RPC_HELPER": shell_path(BRIDGE_PATH)}, stdin=timer_read, capture_output=True, text=True, timeout=25)
            finally:
                os.close(timer_read)
                os.close(timer_write)
            if result.returncode or content("fixture-error"):
                raise RuntimeError("Fixture supervisor failed")
            status = int(content("status"))
            executions.append(status)
            captured.extend((content("stdout"), content("stderr")))
            if status:
                raise subprocess.CalledProcessError(status, ["fixture-probe"])
            return content("stdout")

        try:
            if case == "occupied-listener":
                # Establish the foreign listener's full contract before launch.
                for path, headers in (("/api/health", {}), ("/", {}), ("/", {"Authorization": f"Bearer {token}"})):
                    try:
                        with urlopen(Request(f"http://127.0.0.1:{port}{path}", headers=headers), timeout=1) as response:
                            listener_controls.append(response.status)
                    except HTTPError as error:
                        listener_controls.append(error.code)
                        error.close()
            accepted = True
            with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
                try:
                    if case == "control":
                        execute("fixture", f'''set -e
node fixture &
PID=$!
for attempt in $(seq 1 100); do
  test -f active && break
  sleep 1
done
curl --connect-timeout 1 --max-time 1 -s -o /dev/null 'http://127.0.0.1:{port}/api/health'
curl --connect-timeout 1 --max-time 1 -s -o /dev/null 'http://127.0.0.1:{port}/'
curl --connect-timeout 1 --max-time 1 -s -o /dev/null -H "Authorization: Bearer $(cat data/auth-token)" 'http://127.0.0.1:{port}/'
kill "$PID"
wait "$PID"
''')
                    elif case in ("default-control", "default-wrong-control"):
                        # Independent launch/HTTP controls bypass the harness's data guard.
                        execute("fixture", f'''set -e
node fixture & PID=$!
trap 'kill "$PID"; wait "$PID"' EXIT
for ((attempt=0; attempt<100; attempt++)); do [[ -f active ]] && break; sleep 1; done
for endpoint in /api/health /; do curl --connect-timeout 1 --max-time 1 -s -o /dev/null "http://127.0.0.1:{port}$endpoint"; done
curl --connect-timeout 1 --max-time 1 -s -o /dev/null -H "Authorization: Bearer $(cat "$T0202_DEFAULT_TOKEN_FILE")" 'http://127.0.0.1:{port}/'
''')
                    else:
                        spec = importlib.util.spec_from_file_location("t0202_harness", ROOT / "tests/integration/test_full_install_update_process.py")
                        if spec is None or spec.loader is None:
                            raise RuntimeError("Cannot load install harness")
                        module = importlib.util.module_from_spec(spec)
                        spec.loader.exec_module(module)
                        harness = module.Harness.__new__(module.Harness)
                        harness.skip_http, harness.repo_root = False, ROOT
                        harness.docker_exec = harness.docker_exec_capture = execute
                        harness.http_smoke("fixture", workspace=workspace)
                except subprocess.CalledProcessError:
                    accepted = False
        finally:
            stop.set()
            server.shutdown()
            server.server_close()
            listener.join(timeout=2)
        captured.append(output.getvalue())
        return {
            "accepted": accepted, "executions": len(executions),
            "launched": len(content("launches").splitlines()),
            "ownedStopped": content("owned.alive") == "no",
            "decoySurvived": content("decoy.alive") == "yes",
            "signalsOwned": "forbidden" not in content("signals") and content("decoy.pid") not in content("signals").splitlines(),
            "withinDeadline": all(status not in (124, 137) for status in executions),
            "requestsBounded": bool(content("bounds")) and all(line.startswith("1 ") for line in content("bounds").splitlines()),
            "credentialLeaked": any(value in text for value in credentials for text in captured),
            "scriptContainsCredential": any(value in script for value in credentials for script in scripts),
            "workspaceHasSpaces": " " in workspace,
            "listenerControlStatuses": listener_controls, "requests": requests,
            **({"defaults": defaults} if defaults else {}),
        }


def main() -> None:
    bash = os.environ.get("T0202_BASH") or ("C:/Program Files/Git/bin/bash.exe" if os.name == "nt" else shutil.which("bash"))
    if not bash:
        raise RuntimeError("Bash is required")
    subprocess.run([bash, "--noprofile", "--norc", "-c", "export PATH=/usr/bin:/bin:$PATH; command -v curl >/dev/null && command -v timeout >/dev/null"], check=True, capture_output=True)
    cases = sys.argv[1:] or CASES
    if any(case not in (*CASES, *DEFAULT_CASES) for case in cases):
        raise ValueError("Unknown T-0202 case")
    print(json.dumps({case: run_case(case, bash) for case in cases}))


if __name__ == "__main__":
    main()
