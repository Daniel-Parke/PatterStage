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
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
CASES = ("control", "healthy", "wrong-credential", "anonymous-200", "health-204",
         "health-503", "health-redirect", "anonymous-redirect", "auth-redirect",
         "auth-403", "dead-launch", "occupied-listener", "stalled", "stubborn")


def shell_path(path: Path) -> str:
    value = path.resolve().as_posix()
    return f"/{value[0].lower()}{value[2:]}" if os.name == "nt" else value


def shell_file(path: Path, source: str) -> None:
    path.write_text(source, encoding="utf-8", newline="\n")
    path.chmod(0o700)


SUPERVISOR = r'''
export PATH="$T0202_ROOT/bin:/usr/bin:/bin:$PATH"
sleep() { /usr/bin/sleep 0.01; }
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
  command curl "${args[@]}"
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
export -f sleep curl kill
"$T0202_ROOT/bin/decoy" >/dev/null 2>&1 &
for ((attempt=0; attempt<100; attempt++)); do
  [[ -f "$T0202_ROOT/decoy.pid" ]] && break
  /usr/bin/sleep 0.01
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
  /usr/bin/sleep 1
  printf 'bind-failed\n' > "$T0202_ROOT/bind-failure"
  exit 78
fi
touch "$T0202_ROOT/active"
if [[ "$T0202_CASE" == stubborn ]]; then trap '' TERM
else trap 'rm -f "$T0202_ROOT/active"; exit 0' TERM INT; fi
while :; do /usr/bin/sleep 0.01; done
'''
DECOY = r'''#!/usr/bin/env bash
printf '%s\n' "$$" > "$T0202_ROOT/decoy.pid"
trap 'exit 0' TERM INT
while :; do /usr/bin/sleep 0.01; done
'''


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

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        server.daemon_threads = True
        listener = threading.Thread(target=server.serve_forever, daemon=True)
        listener.start()
        port, workspace = server.server_address[1], shell_path(install)
        (install / ".env.local").write_text(f"PORT={port}\nCH_DATA_DIR={workspace}/data\nPS_DATA_DIR={workspace}/data\n", encoding="utf-8")
        environment = {key: value for key, value in os.environ.items() if not key.startswith(("CH_", "PS_", "CONTROL_HUB_"))}
        environment.update(T0202_ROOT=shell_path(fixture), T0202_WORKSPACE=workspace, T0202_CASE=case, CH_DATA_DIR=f"{workspace}/data", PS_DATA_DIR=f"{workspace}/data")
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
            result = subprocess.run([bash, "--noprofile", "--norc", f"{shell_path(fixture)}/supervisor.sh"], env={**environment, **(env or {})}, capture_output=True, text=True, timeout=25)
            if result.returncode:
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
            "credentialLeaked": any(token in text for text in captured),
            "scriptContainsCredential": any(token in script for script in scripts),
            "workspaceHasSpaces": " " in workspace,
            "listenerControlStatuses": listener_controls, "requests": requests,
        }


def main() -> None:
    bash = os.environ.get("T0202_BASH") or ("C:/Program Files/Git/bin/bash.exe" if os.name == "nt" else shutil.which("bash"))
    if not bash:
        raise RuntimeError("Bash is required")
    subprocess.run([bash, "--noprofile", "--norc", "-c", "export PATH=/usr/bin:/bin:$PATH; command -v curl >/dev/null && command -v timeout >/dev/null"], check=True, capture_output=True)
    cases = sys.argv[1:] or CASES
    if any(case not in CASES for case in cases):
        raise ValueError("Unknown T-0202 case")
    print(json.dumps({case: run_case(case, bash) for case in cases}))


if __name__ == "__main__":
    main()
