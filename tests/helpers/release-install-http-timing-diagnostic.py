"""Phase evidence for the unchanged T-0205 healthy path, not acceptance."""
from __future__ import annotations

import importlib.machinery
import importlib.util
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import socketserver
import subprocess
import sys
import tempfile
import threading
import time
from http.server import ThreadingHTTPServer


def main() -> int:
    started = time.monotonic()
    events: list[dict] = []
    restorations: list[tuple] = []
    observation: dict = {}
    tools: dict = {}

    def measured(label, function, *args, **kwargs):
        begin = time.monotonic()
        failed = True
        try:
            value = function(*args, **kwargs)
            failed = False
            return value
        finally:
            events.append({"phase": label, "startSeconds": begin - started,
                           "seconds": time.monotonic() - begin, "failed": failed})

    def replace(target, name, replacement):
        restorations.append((target, name, getattr(target, name), name in vars(target)))
        setattr(target, name, replacement)

    loader = importlib.machinery.SourceFileLoader
    original_exec = loader.exec_module
    original_run = subprocess.run
    original_shutdown = socketserver.BaseServer.shutdown
    original_close = ThreadingHTTPServer.server_close
    original_wait = subprocess.Popen.wait
    original_join = threading.Thread.join
    original_cleanup = tempfile.TemporaryDirectory.cleanup

    def exec_module(self, module):
        if Path(self.path).name == "test_full_install_update_process.py":
            return measured("harness.import", original_exec, self, module)
        result = original_exec(self, module)
        if Path(self.path).name == "release-install-http-probe.py":
            bridge_class = module.CurlBridge

            class ObservedBridge(bridge_class):
                def __init__(self, *args, **kwargs):
                    measured("bridge.prepare", super().__init__, *args, **kwargs)
                    close = self.server.server_close
                    replace(self.server, "server_close", lambda: measured("bridge.server-close", close))

                def __enter__(self):
                    return measured("bridge.enter", super().__enter__)

                def __exit__(self, *args):
                    with self.lock:
                        events.append({"phase": "bridge.cleanup-entry", "startSeconds": time.monotonic() - started,
                                       "processes": len(self.children), "active": len(self.active),
                                       "workers": len(self.workers), "connections": len(self.connections)})
                    try:
                        return measured("bridge.cleanup", super().__exit__, *args)
                    finally:
                        with self.lock:
                            events.append({"phase": "bridge.cleanup-exit", "startSeconds": time.monotonic() - started,
                                           "processes": len(self.children), "active": len(self.active),
                                           "workers": len(self.workers), "connections": len(self.connections)})

            replace(module, "CurlBridge", ObservedBridge)
        return result

    def run(*args, **kwargs):
        command = args[0] if args else kwargs.get("args", ())
        supervisor = isinstance(command, (list, tuple)) and any(
            isinstance(arg, str) and arg.endswith("/supervisor.sh") for arg in command)
        return measured("supervisor.execution-and-collection" if supervisor else "preparation.subprocess",
                        original_run, *args, **kwargs)

    def shutdown(self):
        return measured("http.shutdown" if isinstance(self, ThreadingHTTPServer) else "bridge.shutdown",
                        original_shutdown, self)

    diagnostic_failed = False
    try:
        replace(loader, "exec_module", exec_module)
        replace(subprocess, "run", run)
        replace(socketserver.BaseServer, "shutdown", shutdown)
        replace(ThreadingHTTPServer, "server_close", lambda self: measured("http.server-close", original_close, self))
        replace(subprocess.Popen, "wait", lambda self, *args, **kwargs: measured("process.wait", original_wait, self, *args, **kwargs))
        replace(threading.Thread, "join", lambda self, *args, **kwargs: measured("thread.join", original_join, self, *args, **kwargs))
        replace(tempfile.TemporaryDirectory, "cleanup", lambda self: measured("temporary-directory.cleanup", original_cleanup, self))
        helper = Path(__file__).with_name("release-install-http-context-probe.py")
        spec = importlib.util.spec_from_file_location("t0205_timing_context", helper)
        if spec is None or spec.loader is None:
            raise RuntimeError("diagnostic import unavailable")
        module = importlib.util.module_from_spec(spec)
        measured("context.import", spec.loader.exec_module, module)
        bash = os.environ.get("T0202_BASH") or ("C:/Program Files/Git/bin/bash.exe" if os.name == "nt" else shutil.which("bash"))
        if not bash:
            raise RuntimeError("diagnostic Bash unavailable")
        subprocess.run([bash, "--noprofile", "--norc", "-c", "export PATH=/usr/bin:/bin:$PATH; command -v curl >/dev/null && command -v timeout >/dev/null && command -v mktemp >/dev/null && command -v stat >/dev/null"], check=True, capture_output=True, timeout=25)
        lookup = 'export PATH=/usr/bin:/bin:$PATH; if [[ "$OSTYPE" == msys* || "$OSTYPE" == cygwin* ]]; then cygpath -w "$(type -P timeout)"; else type -P timeout; fi'
        found = subprocess.run([bash, "--noprofile", "--norc", "-c", lookup], check=True, capture_output=True, text=True, timeout=25)
        timeout_path = Path(found.stdout.strip())
        if os.name == "nt" and not timeout_path.is_file():
            timeout_path = Path(str(timeout_path) + ".exe")
        version = subprocess.run([str(timeout_path), "--version"], check=True, capture_output=True, text=True, timeout=25)
        if "GNU coreutils" not in version.stdout:
            raise RuntimeError("diagnostic GNU timeout unavailable")
        result = measured("observe.healthy", module.observe, "healthy", bash)
        tools = {"bashSHA256": hashlib.sha256(Path(bash).read_bytes()).hexdigest(),
                 "gnuTimeoutSHA256": hashlib.sha256(timeout_path.read_bytes()).hexdigest(),
                 "gnuTimeoutVersion": version.stdout.splitlines()[0],
                 "nativeCurlSHA256": sorted(set(result["native"]["clients"].values()))}
        for name in ("elapsedSeconds", "accepted", "ownedStopped", "decoySurvived", "signalsOwned", "withinDeadline"):
            observation[name] = result[name]
    except Exception:
        diagnostic_failed = True
    finally:
        for target, name, original, owned_attribute in reversed(restorations):
            if owned_attribute:
                setattr(target, name, original)
            else:
                delattr(target, name)
    print(json.dumps({"diagnosticOnly": True, "control": "healthy alone; CI schedules after coverage on an already exercised runner",
                      "failed": diagnostic_failed, "python": platform.python_version(),
                      "platform": platform.system(), "architecture": platform.machine(),
                      "tools": tools, "originalObservation": observation, "phases": events}))
    return 90 if diagnostic_failed else 0


if __name__ == "__main__":
    sys.exit(main())
