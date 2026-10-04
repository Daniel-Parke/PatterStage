#!/usr/bin/env python3
"""T0206 diagnostic only: minimal decoration of the existing stalled observer.
No shell/source changes. Outer execution is NOT the six-second supervised interval.
Inclusive timings overlap; an unallocated remainder is NOT an IPC/capture cause.
"""
from __future__ import annotations
import contextlib
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import platform
import shutil
import socket
import socketserver
import subprocess
import sys
import tempfile
import threading
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
FILES = [HERE / name for name in ("release-install-http-probe.py", "release-install-http-context-probe.py",
    "release-install-http-curl-bridge.py", "release-install-http-timing-diagnostic.py")]
FILES += [ROOT / "tests/integration/test_full_install_update_process.py", ROOT / "tests/unit/release-install-http-context.test.ts"]

def hashes() -> dict[str, str]:
    return {p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in FILES}

def selected(result: dict) -> dict:
    fields = ("accepted", "withinDeadline", "probeExit", "ownedStopped", "decoySurvived", "signalsOwned",
        "requestsBounded", "connectBounded", "scratchExclusive", "scratchPrivate", "scratchOwned", "scratchRemoved",
        "scratchCreatedBeforeLaunch", "credentialLeaked", "scriptContainsCredential")
    native = result["native"]
    counts = {"nativeCalls": native["calls"], "nativeStatuses": len(native["statuses"]),
        "completedExits": len(result["completedExits"]), "returnedExits": len(result["returnedExits"]),
        "entries": len(result["entries"]), "postEntries": sum(e["phase"] == "post" for e in result["entries"])}
    flags = {key: result[key] for key in fields}
    flags.update({key: native[key] for key in ("errors", "cancelled", "ownedCurlStopped", "listenerStopped", "ipcStopped", "environmentRegistered")})
    flags.update(requestCountBounded=0 < len(result["requests"]) <= 20,
        sameShellContext=all([e["shellPid"], e["bashPid"]] == result["identity"][0] for e in result["entries"]),
        exitsAgree=native["statuses"] == result["completedExits"] == result["returnedExits"],
        nativeStalls=28 in native["statuses"] and all(code in (52, 28) for code in native["statuses"][1:]))
    return {"flags": flags, "counts": counts, "requestCount": len(result["requests"]),
        "nativeStatuses": native["statuses"], "completedExits": result["completedExits"],
        "nativeBinarySHA256": sorted(set(native["clients"].values()))}

@contextlib.contextmanager
def decorate(report: dict):
    saved, processes, kinds, events = [], [], {}, []
    totals, local, lock = {}, threading.local(), threading.Lock()
    def record(label, seconds, size=0):
        with lock:
            row = totals.setdefault(label, {"calls": 0, "seconds": 0.0, "bytes": 0})
            row["calls"] += 1; row["seconds"] += seconds; row["bytes"] += size
    def measured(label, function, *args, **kwargs):
        start = time.perf_counter()
        try:
            return function(*args, **kwargs)
        finally:
            duration = time.perf_counter() - start
            record(label, duration)
            if label != "binary-read":
                with lock: events.append({"phase": label, "seconds": duration})
    def replace(target, name, function):
        saved.append((target, name, getattr(target, name))); setattr(target, name, function)
    original_init, original_communicate = subprocess.Popen.__init__, subprocess.Popen.communicate
    original_handler, original_recv = socketserver.BaseRequestHandler.__init__, socket.socket.recv
    original_read = Path.read_bytes
    def initialise(process, args, *rest, **kwargs):
        command = args if isinstance(args, (list, tuple)) else ()
        native = getattr(local, "bridge", False) and command and Path(str(command[0])).name.lower() in ("curl", "curl.exe")
        supervisor = any(isinstance(a, str) and a.endswith("/supervisor.sh") for a in command)
        label = "native" if native else "outer" if supervisor else "other"
        if label == "other": return original_init(process, args, *rest, **kwargs)
        measured(label + ".spawn", original_init, process, args, *rest, **kwargs)
        with lock: kinds[id(process)] = label; processes.append(process)
    def communicate(process, *args, **kwargs):
        label = kinds.get(id(process))
        if label is None: return original_communicate(process, *args, **kwargs)
        return measured(label + ".communicate", original_communicate, process, *args, **kwargs)
    def handler(instance, request, address, server):
        if type(server).__module__ != "release_install_http_curl_bridge":
            return original_handler(instance, request, address, server)
        local.bridge = True
        try: return measured("bridge-request-inclusive", original_handler, instance, request, address, server)
        finally: local.bridge = False
    def receive(connection, *args, **kwargs):
        if not getattr(local, "bridge", False): return original_recv(connection, *args, **kwargs)
        start, data = time.perf_counter(), b""
        try:
            data = original_recv(connection, *args, **kwargs); return data
        finally: record("bridge-recv", time.perf_counter() - start, len(data))
    def read_bytes(path):
        if path.name.lower() not in ("curl", "curl.exe"): return original_read(path)
        return measured("binary-read", original_read, path)
    try:
        replace(subprocess.Popen, "__init__", initialise); replace(subprocess.Popen, "communicate", communicate)
        replace(socketserver.BaseRequestHandler, "__init__", handler); replace(socket.socket, "recv", receive)
        replace(Path, "read_bytes", read_bytes)
        for target, name, label in ((socketserver.BaseServer, "shutdown", "cleanup.server-shutdown"),
                (tempfile.TemporaryDirectory, "cleanup", "cleanup.temporary-directory")):
            original = getattr(target, name)
            replace(target, name, lambda self, *a, fn=original, phase=label, **k: measured(phase, fn, self, *a, **k))
        yield
    finally:
        for target, name, original in reversed(saved): setattr(target, name, original)
        report.update(totals=totals, events=events, objectsRestored=all(getattr(t, n) is f for t, n, f in saved),
            ownedPids=[p.pid for p in processes], ownedProcessesStopped=all(p.poll() is not None for p in processes))

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument("output", type=Path)
    parser.add_argument("--workload", choices=("isolated", "coverage-concurrent", "other-concurrent"), default="isolated")
    arguments = parser.parse_args()
    report = {"diagnosticOnly": True, "case": "stalled", "python": platform.python_version(), "pid": os.getpid(),
        "reportStartMonotonicNs": time.monotonic_ns(), "callerWorkloadLabel": arguments.workload,
        "observerSHA256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "platform": platform.system(), "architecture": platform.machine(), "cpuCount": os.cpu_count(),
        "conditions": {"order": ["before", "observed", "restored"], "concurrency": "three sequential observations; caller workload label is unverified",
            "nativeCallsExpected": 21, "supervisorSeconds": 6, "outerSeconds": 25, "curlMaxAndConnectSeconds": 0.1, "retries": 0},
        "limits": ["Outer communicate is execution plus collection, NOT the exact supervised interval.",
            "Whole observation includes preparation and cleanup outside the watchdog.",
            "Bridge totals include registration and overlap native/recv timings; do not add inclusive totals.",
            "recv timing includes blocking/scheduling; binary reads exclude SHA256 computation.",
            "Unallocated remainder is NOT an IPC or status-capture cause; those phases are not isolated here.",
            "Bookkeeping perturbs timing. Before/after delta includes drift/cache effects, not causal overhead.",
            "No signal hook: an owning background wrapper must wait for observer completion and cleanup.",
            "Report end precedes JSON serialization. Platform-local diagnostic, not acceptance."], "observations": {}, "measurement": {}}
    before, environment = hashes(), dict(os.environ)
    old_tempdir, old_bytecode = tempfile.tempdir, sys.dont_write_bytecode
    bash = "C:/Program Files/Git/bin/bash.exe" if os.name == "nt" else shutil.which("bash")
    with arguments.output.open("x", encoding="utf-8") as output:
        try:
            if not bash: raise RuntimeError("Bash unavailable")
            with tempfile.TemporaryDirectory(prefix="t0206-phases-") as owned:
                os.environ.clear()
                os.environ.update({k: v for k, v in environment.items() if k.upper() in
                    ("SYSTEMROOT", "WINDIR", "COMSPEC", "PATH", "PATHEXT", "LANG", "LC_ALL")})
                for name in ("home", "data", "hermes", "temp"): Path(owned, name).mkdir()
                os.environ.update(HOME=str(Path(owned, "home")), USERPROFILE=str(Path(owned, "home")),
                    APPDATA=str(Path(owned, "home")), LOCALAPPDATA=str(Path(owned, "home")), PS_DATA_DIR=str(Path(owned, "data")),
                    HERMES_HOME=str(Path(owned, "hermes")), TMP=str(Path(owned, "temp")), TEMP=str(Path(owned, "temp")),
                    TMPDIR=str(Path(owned, "temp")), PYTHONDONTWRITEBYTECODE="1", PYTHONIOENCODING="utf-8")
                tempfile.tempdir, sys.dont_write_bytecode = str(Path(owned, "temp")), True
                spec = importlib.util.spec_from_file_location("t0206_context", HERE / "release-install-http-context-probe.py")
                if spec is None or spec.loader is None: raise RuntimeError("Observer unavailable")
                module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
                for label in ("before", "observed", "restored"):
                    scope = decorate(report["measurement"]) if label == "observed" else contextlib.nullcontext()
                    with scope:
                        row = {"startMonotonicNs": time.monotonic_ns()}; report["observations"][label] = row
                        try: row["outcome"] = selected(module.observe("stalled", bash))
                        finally:
                            row["endMonotonicNs"] = time.monotonic_ns()
                            row["wholeSeconds"] = (row["endMonotonicNs"] - row["startMonotonicNs"]) / 1e9
                rows = list(report["observations"].values())
                report["matchingBoundedPredicatesAndCounts"] = all(r["outcome"][k] == rows[0]["outcome"][k] for r in rows for k in ("flags", "counts", "nativeBinarySHA256"))
                report["observedMinusMeanControlsSeconds"] = rows[1]["wholeSeconds"] - (rows[0]["wholeSeconds"] + rows[2]["wholeSeconds"]) / 2
        except Exception as error:
            report.update(failureClass=type(error).__name__, errno=getattr(error, "errno", None))
            frame = error.__traceback__
            while frame.tb_next: frame = frame.tb_next
            report["failureSite"] = {"file": Path(frame.tb_frame.f_code.co_filename).name, "line": frame.tb_lineno}
        finally:
            os.environ.clear(); os.environ.update(environment)
            tempfile.tempdir, sys.dont_write_bytecode = old_tempdir, old_bytecode
            report.update(environmentRestored=dict(os.environ) == environment, frozenHashes=before, frozenFilesUnchanged=hashes() == before)
            report["measurementComplete"] = "failureClass" not in report and report["environmentRestored"] and report["frozenFilesUnchanged"] and report["measurement"].get("objectsRestored", False) and report["measurement"].get("ownedProcessesStopped", False)
            report["reportEndMonotonicNs"] = time.monotonic_ns()
            json.dump(report, output, indent=2); output.write("\n")
    print(json.dumps({k: report.get(k) for k in ("diagnosticOnly", "measurementComplete", "failureClass", "matchingBoundedPredicatesAndCounts")}))
    return 0 if report["measurementComplete"] else 90

if __name__ == "__main__":
    try: sys.exit(main())
    except Exception as error:
        print(json.dumps({"diagnosticOnly": True, "failureClass": type(error).__name__}), file=sys.stderr); sys.exit(90)
