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
import math
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
import uuid

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
    classes, request_number = set(), 0
    def record(label, seconds, size=0, calls=1):
        with lock:
            row = totals.setdefault(label, {"calls": 0, "seconds": 0.0, "bytes": 0})
            row["calls"] += calls; row["seconds"] += seconds; row["bytes"] += size
    def measured(label, function, *args, _request_id=None, _size=0, **kwargs):
        start, completed, failure = time.monotonic_ns(), False, None
        request_id = _request_id if _request_id is not None else getattr(local, "request_id", None)
        try:
            result = function(*args, **kwargs)
            completed = True
            return result
        except BaseException as error:
            failure = failure_class(error)
            raise
        finally:
            end = time.monotonic_ns()
            duration = (end - start) / 1e9
            record(label, duration, _size)
            event = {"phase": label, "seconds": duration, "requestId": request_id,
                "startMonotonicNs": start, "endMonotonicNs": end,
                "calls": 1, "bytes": _size, "completed": completed}
            if failure is not None: event["failureClass"] = failure
            with lock: events.append(event)
    def replace(target, name, function):
        saved.append((target, name, getattr(target, name))); setattr(target, name, function)
    original_init, original_communicate = subprocess.Popen.__init__, subprocess.Popen.communicate
    original_handler, original_recv = socketserver.BaseRequestHandler.__init__, socket.socket.recv
    original_send = socket.socket.sendall
    original_read = Path.read_bytes
    def initialise(process, args, *rest, **kwargs):
        command = args if isinstance(args, (list, tuple)) else ()
        native = getattr(local, "bridge", False) and command and Path(str(command[0])).name.lower() in ("curl", "curl.exe")
        supervisor = any(isinstance(a, str) and a.endswith("/supervisor.sh") for a in command)
        label = "native" if native else "outer" if supervisor else "other"
        if label == "other": return original_init(process, args, *rest, **kwargs)
        measured(label + ".spawn", original_init, process, args, *rest, **kwargs)
        with lock: kinds[id(process)] = (label, getattr(local, "request_id", None)); processes.append(process)
    def communicate(process, *args, **kwargs):
        kind = kinds.get(id(process))
        if kind is None: return original_communicate(process, *args, **kwargs)
        return measured(kind[0] + ".communicate", original_communicate, process, *args,
            _request_id=kind[1], **kwargs)
    def flush_receive():
        row = getattr(local, "received", None)
        if row is None: return
        local.received = None
        record("bridge-recv", row["seconds"], row["bytes"], row["calls"])
        with lock: events.append({"phase": "bridge-recv", "requestId": local.request_id, **row})
    def validation(function, owner, *args, **kwargs):
        if not getattr(local, "bridge", False): return function(owner, *args, **kwargs)
        flush_receive()
        return measured("bridge-validate", function, owner, *args, **kwargs)
    def handler(instance, request, address, server):
        nonlocal request_number
        if type(server).__module__ != "release_install_http_curl_bridge":
            return original_handler(instance, request, address, server)
        # The real handler closes over its owner; discover the class without
        # replacing transport, loading another bridge or changing its source.
        for cell in getattr(getattr(type(instance), "handle", None), "__closure__", None) or ():
            owner = cell.cell_contents
            cls = type(owner)
            if cls.__name__ == "CurlBridge" and cls.__module__ == "release_install_http_curl_bridge":
                with lock:
                    if cls not in classes:
                        original = cls.validate
                        replace(cls, "validate", lambda self, *a, fn=original, **k: validation(fn, self, *a, **k))
                        classes.add(cls)
        with lock:
            request_number += 1
            local.request_id = request_number
        local.bridge = True
        local.received = None
        try: return measured("bridge-request-inclusive", original_handler, instance, request, address, server)
        finally:
            flush_receive()
            local.bridge = False
            local.request_id = None
    def receive(connection, *args, **kwargs):
        if not getattr(local, "bridge", False): return original_recv(connection, *args, **kwargs)
        start, data = time.monotonic_ns(), b""
        try:
            data = original_recv(connection, *args, **kwargs); return data
        finally:
            end = time.monotonic_ns()
            row = local.received
            if row is None:
                row = {"startMonotonicNs": start, "endMonotonicNs": end,
                    "calls": 0, "bytes": 0, "seconds": 0.0}
                local.received = row
            row["endMonotonicNs"] = end
            row["calls"] += 1; row["bytes"] += len(data); row["seconds"] += (end - start) / 1e9
    def send(connection, data, *args, **kwargs):
        if not getattr(local, "bridge", False): return original_send(connection, data, *args, **kwargs)
        return measured("bridge-send", original_send, connection, data, *args, _size=len(data), **kwargs)
    def read_bytes(path):
        if path.name.lower() not in ("curl", "curl.exe"): return original_read(path)
        return measured("binary-read", original_read, path)
    try:
        replace(subprocess.Popen, "__init__", initialise); replace(subprocess.Popen, "communicate", communicate)
        replace(socketserver.BaseRequestHandler, "__init__", handler); replace(socket.socket, "recv", receive)
        replace(socket.socket, "sendall", send)
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


PHASES = frozenset(("native.spawn", "native.communicate", "outer.spawn", "outer.communicate",
    "bridge-request-inclusive", "bridge-recv", "bridge-validate", "bridge-send", "binary-read",
    "cleanup.server-shutdown", "cleanup.temporary-directory"))
FAILURES = frozenset(("RuntimeError", "ValueError", "OSError", "TimeoutExpired", "InterruptedError",
    "BrokenPipeError", "ConnectionResetError", "PermissionError", "FileExistsError", "Exception"))

def failure_class(error: BaseException) -> str:
    name = type(error).__name__
    return name if name in FAILURES else "Exception"

def validate_actual_report(report: dict) -> None:
    """Validate diagnostic evidence, never reinterpret a failed HTTP outcome."""
    def require(condition):
        if not condition: raise RuntimeError("Invalid T0206 actual diagnostic evidence")
    def integer(value, minimum=0):
        return type(value) is int and value >= minimum
    def digest(value):
        return isinstance(value, str) and len(value) == 64 and all(c in "0123456789abcdef" for c in value)
    require(isinstance(report, dict))
    require(set(report) <= {"diagnosticOnly", "actualInvocation", "case", "measurementComplete", "measurement",
        "outcome", "frozenHashes", "frozenFilesUnchanged", "observerSHA256", "conditions",
        "reportStartMonotonicNs", "reportEndMonotonicNs", "failureClass"})
    require(report.get("diagnosticOnly") is True and report.get("actualInvocation") is True and
        report.get("case") == "stalled" and report.get("measurementComplete") is True and
        report.get("frozenFilesUnchanged") is True)
    require("failureClass" not in report)
    if "reportStartMonotonicNs" in report or "reportEndMonotonicNs" in report:
        require(integer(report.get("reportStartMonotonicNs")) and integer(report.get("reportEndMonotonicNs")) and
            report["reportEndMonotonicNs"] >= report["reportStartMonotonicNs"])
    require(report.get("conditions") == {"nativeCallsExpected": 21, "supervisorSeconds": 6,
        "outerSeconds": 25, "curlMaxAndConnectSeconds": 0.1, "retries": 0, "readinessLoops": 20})
    require(all(type(value) is (float if key == "curlMaxAndConnectSeconds" else int)
        for key, value in report["conditions"].items()))
    bindings = report.get("frozenHashes")
    require(isinstance(bindings, dict) and set(bindings) == {p.relative_to(ROOT).as_posix() for p in FILES})
    require(all(digest(value) for value in bindings.values()) and digest(report.get("observerSHA256")))
    measurement = report.get("measurement")
    require(isinstance(measurement, dict) and set(measurement) <=
        {"totals", "events", "objectsRestored", "ownedProcessesStopped", "ownedPids"})
    require(measurement.get("objectsRestored") is True and measurement.get("ownedProcessesStopped") is True)
    require(isinstance(measurement.get("ownedPids", []), list) and
        all(integer(pid, 1) for pid in measurement.get("ownedPids", [])))
    totals, events = measurement.get("totals"), measurement.get("events")
    require(isinstance(totals, dict) and bool(totals) and set(totals) <= PHASES)
    for row in totals.values():
        require(isinstance(row, dict) and set(row) == {"calls", "seconds", "bytes"})
        require(integer(row["calls"], 1) and integer(row["bytes"]) and
            type(row["seconds"]) in (float, int) and math.isfinite(row["seconds"]) and row["seconds"] >= 0)
    require(isinstance(events, list) and bool(events))
    groups = {}
    for event in events:
        require(isinstance(event, dict) and set(event) <= {"phase", "requestId", "startMonotonicNs",
            "endMonotonicNs", "seconds", "calls", "bytes", "completed", "failureClass"})
        require(event.get("phase") in PHASES and integer(event.get("startMonotonicNs")) and
            integer(event.get("endMonotonicNs")) and event["endMonotonicNs"] >= event["startMonotonicNs"])
        require(integer(event.get("calls"), 1) and integer(event.get("bytes")) and
            type(event.get("seconds")) in (float, int) and math.isfinite(event["seconds"]) and event["seconds"] >= 0)
        require(type(event.get("completed", True)) is bool and event.get("failureClass", "Exception") in FAILURES)
        request_id = event.get("requestId")
        require(request_id is None or integer(request_id, 1))
        if event["phase"].startswith(("native.", "bridge-")):
            require(integer(request_id, 1))
        if request_id is not None:
            groups.setdefault(request_id, {}).setdefault(event["phase"], []).append(event)
    outcome = report.get("outcome")
    require(isinstance(outcome, dict) and set(outcome) == {"flags", "counts", "requestCount",
        "nativeStatuses", "completedExits", "nativeBinarySHA256"})
    counts = outcome.get("counts")
    require(isinstance(counts, dict) and set(counts) == {"nativeCalls", "nativeStatuses", "completedExits",
        "returnedExits", "entries", "postEntries"} and all(integer(value) for value in counts.values()))
    require(counts["nativeCalls"] > 0 and integer(outcome.get("requestCount")))
    for key, count in (("nativeStatuses", counts["nativeStatuses"]), ("completedExits", counts["completedExits"])):
        require(isinstance(outcome[key], list) and len(outcome[key]) == count and
            all(integer(code) and code <= 255 for code in outcome[key]))
    require(isinstance(outcome["nativeBinarySHA256"], list) and bool(outcome["nativeBinarySHA256"]) and
        all(digest(value) for value in outcome["nativeBinarySHA256"]))
    flags = outcome.get("flags")
    expected_flags = {"accepted", "withinDeadline", "probeExit", "ownedStopped", "decoySurvived", "signalsOwned",
        "requestsBounded", "connectBounded", "scratchExclusive", "scratchPrivate", "scratchOwned", "scratchRemoved",
        "scratchCreatedBeforeLaunch", "credentialLeaked", "scriptContainsCredential", "errors", "cancelled",
        "ownedCurlStopped", "listenerStopped", "ipcStopped", "environmentRegistered", "requestCountBounded",
        "sameShellContext", "exitsAgree", "nativeStalls"}
    require(isinstance(flags, dict) and set(flags) == expected_flags)
    require(all(integer(value) if key in ("probeExit", "errors", "cancelled") else type(value) is bool
        for key, value in flags.items()))
    native = [group for group in groups.values() if "native.spawn" in group]
    require(len(native) == counts["nativeCalls"])
    for group in native:
        phases = ("bridge-recv", "bridge-validate", "native.spawn", "native.communicate", "bridge-send")
        require(all(len(group.get(phase, [])) == 1 for phase in phases))
        intervals = [group[phase][0] for phase in phases]
        require(intervals[0]["bytes"] > 0)
        require(all(after["startMonotonicNs"] >= before["endMonotonicNs"]
            for before, after in zip(intervals, intervals[1:])))

def observe_actual(callback, case: str, bash: str, reference: Path | None, directory: Path,
                   diagnostic_errors: list) -> dict:
    before = hashes()
    observer_hash = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    report = {"diagnosticOnly": True, "actualInvocation": True, "case": case,
        "reportStartMonotonicNs": time.monotonic_ns(), "measurementComplete": False,
        "measurement": {}, "frozenHashes": before, "observerSHA256": observer_hash,
        "conditions": {"nativeCallsExpected": 21, "supervisorSeconds": 6, "outerSeconds": 25,
            "curlMaxAndConnectSeconds": 0.1, "retries": 0, "readinessLoops": 20}}
    # Outside observation/watchdog; the CI parent owns this configured root.
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    try:
        with decorate(report["measurement"]):
            result = callback(case, bash, reference)
        report["outcome"] = selected(result)
        return result
    except BaseException as error:
        report["failureClass"] = failure_class(error)
        raise
    finally:
        try:
            report["frozenFilesUnchanged"] = hashes() == before and observer_hash == hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
            report["reportEndMonotonicNs"] = time.monotonic_ns()
            report["measurementComplete"] = "failureClass" not in report
            try:
                validate_actual_report(report)
            except RuntimeError:
                report["measurementComplete"] = False
                diagnostic_errors.append(True)
            with (directory / f"stalled-{os.getpid()}-{uuid.uuid4().hex}.json").open("x", encoding="utf-8") as output:
                json.dump(report, output); output.write("\n")
        except Exception:
            # A diagnostic failure must not replace the original observation exception.
            diagnostic_errors.append(True)

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
