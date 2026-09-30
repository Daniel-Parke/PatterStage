#!/usr/bin/env python3
"""Independent T-0202 native-Expect oracle; all installer effects are owned fixtures."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import re
import shlex
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

PROMPTS = {
    "hermes": "Hermes CLI not found. Install Hermes now? [Y/n]: ",
    "port": "Port [Enter = auto]: ",
    "advanced": "Advanced: custom data directory, Hermes home, or update branch? [y/N]: ",
    "catalogue": "Install/refresh professional catalog now? [Y/n]: ",
    "profiles-in-repo": "Copy missing bundled profile files to Hermes now? [y/N]: ",
    "profiles-bootstrap": "Install bundled profile templates now? [y/N]: ",
    "hindsight": "  Set up Hindsight memory?\n    [d] Docker (cross-platform)   [n] Native (Linux)   [s] Skip\n  Choice [d/n/s]: ",
}
SCENARIOS = {
    "setup_interactive": [("port", ""), ("advanced", "n"), ("catalogue", "y")],
    "install_in_repo_interactive_profiles_no": [
        ("port", ""), ("advanced", "n"), ("catalogue", "n"), ("profiles-in-repo", "n")
    ],
    "install_in_repo_interactive_profiles_yes": [
        ("port", ""), ("advanced", "n"), ("catalogue", "n"), ("profiles-in-repo", "y")
    ],
    # Current installer: 'n' requests native Hindsight; 's' preserves skip intent.
    "install_bootstrap_interactive": [
        ("hermes", "n"), ("port", ""), ("advanced", "n"), ("catalogue", "y"),
        ("profiles-bootstrap", "n"), ("hindsight", "s")
    ],
}
EXPECT = "/usr/bin/expect"
DEADLINE = 4.0


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes().replace(b"\r\n", b"\n")).hexdigest()


def installer(scenario: str, directory: Path) -> None:
    """Emit literal current prompts, independently recording input and file effects."""
    trace = directory / "trace.jsonl"

    def record(event: dict[str, Any]) -> None:
        with trace.open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(event) + "\n")

    record({"kind": "launch", "pid": os.getpid(), "parent": os.getppid()})
    has_hermes = scenario != "setup_interactive"
    catalogue = False
    profiles = False
    for key, _ in SCENARIOS[scenario]:
        record({"kind": "prompt", "key": key})
        if key == "hindsight":
            import tty
            tty.setcbreak(0)  # Match Bash read -n 1, including no required newline.
        print(PROMPTS[key], end="", flush=True)
        answer = sys.stdin.read(1) if key == "hindsight" else sys.stdin.readline()
        if answer == "":
            record({"kind": "input-eof", "key": key})
            raise SystemExit(3)
        answer = answer.rstrip("\r\n").lower()
        record({"kind": "answer", "key": key, "value": answer})
        print("", flush=True)
        if key == "catalogue":
            catalogue = answer != "n"
        elif key.startswith("profiles-"):
            profiles = answer == "y"
        if (catalogue and has_hermes) or profiles:
            qa = directory / "hermes/profiles/qa"
            qa.mkdir(parents=True, exist_ok=True)
            for filename in ("SOUL.md", "AGENTS.md"):
                (qa / filename).write_text("owned deterministic QA fixture\n", encoding="utf-8")
    record({"kind": "complete", "catalogueSeeded": catalogue, "profilesCopied": profiles})
    print("T0202_OWNED_INSTALL_COMPLETE", flush=True)


def capture(harness_path: Path) -> tuple[dict[str, dict[str, Any]], list[str]]:
    spec = importlib.util.spec_from_file_location("t0202_interactive_harness", harness_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Harness import infrastructure unavailable")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    captured: dict[str, dict[str, Any]] = {}
    for scenario in SCENARIOS:
        subject = module.Harness.__new__(module.Harness)
        scripts: list[str] = []
        qa_checks: list[str] = []
        hints: list[str] = []
        removed: list[str] = []
        subject.temp_workspace = lambda: Path("/unused-owned-workspace")
        subject.start_container = lambda _: "owned-capture-only"
        for method in ("docker_cp_workspace", "seed_fresh", "prepare_hub_bare_repo",
                       "assert_paths", "assert_paths_at", "http_smoke"):
            setattr(subject, method, lambda *args, **kwargs: None)

        def capture_expect(_container: str, body: str, **kwargs: Any) -> None:
            scripts.append(body)
            hints.append(kwargs["hint"])

        def capture_shell(*args: Any, **kwargs: Any) -> None:
            body = kwargs.get("script", args[1] if len(args) > 1 else "")
            if "test " in body:
                qa_checks.append(body)
            elif body != "mkdir -p /root/.hermes/logs && printf '%s\\n' 'version: 1' > /root/.hermes/config.yaml\n":
                raise RuntimeError("Unrecognised scenario preparation; reassess fixture capture")

        subject.docker_exec_expect = capture_expect
        subject.docker_exec = capture_shell
        subject._rm_container = removed.append
        getattr(subject, f"scenario_{scenario}")()
        if len(scripts) != 1 or hints != [scenario] or removed != ["owned-capture-only"]:
            raise RuntimeError("Actual scenario did not produce exactly one Tcl body and owned cleanup")
        captured[scenario] = {"script": scripts[0], "qaChecks": qa_checks,
                              "capturedHint": hints[0], "scenarioCleanupCalls": len(removed)}
    identities = [name for name in subject.scenario_fn_map() if name != "hermes-upstream"]
    return captured, identities


def complete_control(scenario: str, *, contaminate: bool = False) -> str:
    """Independent driver, not an edited copy of any harness Tcl."""
    lines = ["log_user 1", "set timeout 2", "set cmd {fixture-command}", "spawn bash -lc $cmd"]
    for key, answer in SCENARIOS[scenario]:
        if contaminate and key == "catalogue":
            answer = "y"
        # Hindsight's preceding multi-line explanation is followed by its actual read prompt.
        prompt = "Choice [d/n/s]: " if key == "hindsight" else PROMPTS[key]
        lines.append(f"expect -exact {{{prompt}}}")
        lines.append(f'send -- "{answer}' + ("" if key == "hindsight" else "\\r") + '"')
    lines.extend(["expect eof", "catch wait result", "exit [lindex $result 3]"])
    return "\n".join(lines) + "\n"


def events(directory: Path) -> list[dict[str, Any]]:
    trace = directory / "trace.jsonl"
    return [json.loads(line) for line in trace.read_text().splitlines()] if trace.exists() else []


def alive(pid: int) -> bool:
    stat = Path(f"/proc/{pid}/stat")
    try:
        return stat.read_text().split(") ", 1)[1].split()[0] != "Z"
    except FileNotFoundError:
        return False


def run_case(scenario: str, driver: str, captured: dict[str, Any], *, origin: str) -> dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="t0202-expect-") as temporary:
        directory = Path(temporary)
        helper = Path(__file__).resolve()
        command = shlex.join([sys.executable, str(helper), "--installer", scenario, str(directory)])
        # Only substitute the spawn command. Every actual expect/send/timeout/exit remains intact.
        rewritten, replacements = re.subn(r"^set cmd \{[^\n]*\}$", lambda _: f"set cmd {{exec {command}}}",
                                          driver, flags=re.MULTILINE)
        if replacements != 1:
            raise RuntimeError("Fixture requires exactly one captured spawn command")
        script = directory / "driver.exp"
        script.write_text(rewritten, encoding="utf-8")
        syntax = subprocess.run([EXPECT, "-c", f"set f [open {{{script}}}]; "
                                 'set s [read $f]; close $f; exit [expr {![info complete $s]}]'],
                                capture_output=True, text=True, timeout=3)
        if syntax.returncode != 0:
            raise RuntimeError(f"Tcl completeness infrastructure failed: {syntax.stderr}")
        decoy = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"], start_new_session=True)
        started = time.monotonic()
        process: subprocess.Popen[str] | None = None
        enforcement: list[dict[str, Any]] = []
        watchdog = False
        output = ""
        status: int | None = None
        try:
            process = subprocess.Popen([EXPECT, "-f", str(script)], stdout=subprocess.PIPE,
                                       stderr=subprocess.STDOUT, text=True, start_new_session=True)
            try:
                output, _ = process.communicate(timeout=DEADLINE)
            except subprocess.TimeoutExpired:
                watchdog = True
            observed = events(directory)
            installer_pids = [event["pid"] for event in observed if event["kind"] == "launch"]
            for pid in installer_pids:
                if alive(pid):
                    cmdline = Path(f"/proc/{pid}/cmdline").read_bytes().split(b"\0")
                    expected = [str(helper).encode(), b"--installer", scenario.encode(), str(directory).encode()]
                    if cmdline[1:5] != expected or pid == decoy.pid:
                        raise RuntimeError("Owned installer identity failed before cleanup")
                    try:
                        os.kill(pid, signal.SIGTERM)
                        enforcement.append({"owner": "fixture-installer", "pid": pid, "signal": "TERM"})
                    except ProcessLookupError:
                        pass  # The owned child exited between identity verification and signalling.
            if process.poll() is None:
                process.terminate()
                enforcement.append({"owner": "fixture-expect", "pid": process.pid, "signal": "TERM"})
            try:
                remaining, _ = process.communicate(timeout=1)
            except subprocess.TimeoutExpired:
                process.kill()
                enforcement.append({"owner": "fixture-expect", "pid": process.pid, "signal": "KILL"})
                remaining, _ = process.communicate(timeout=1)
            output = remaining  # communicate retains all output after TimeoutExpired.
            status = process.returncode
            cleanup_deadline = time.monotonic() + 1
            while any(alive(pid) for pid in installer_pids) and time.monotonic() < cleanup_deadline:
                time.sleep(0.02)
            for pid in installer_pids:
                if alive(pid):
                    try:
                        os.kill(pid, signal.SIGKILL)
                        enforcement.append({"owner": "fixture-installer", "pid": pid, "signal": "KILL"})
                    except ProcessLookupError:
                        pass
            observed = events(directory)
            complete = any(event["kind"] == "complete" for event in observed)
            answers = [{"key": event["key"], "value": event["value"]}
                       for event in observed if event["kind"] == "answer"]
            pending = next((event["key"] for event in reversed(observed) if event["kind"] == "prompt"), None)
            last = observed[-1]["kind"] if observed else None
            if complete:
                failure = None if status == 0 else "installer-exit"
            elif watchdog and last == "prompt":
                failure = "missing-answer"
            elif re.search(r'invalid command name|missing close|extra characters|couldn.t compile', output):
                failure = "tcl-error"
            else:
                failure = "launch-error" if not installer_pids else "installer-exit"
            qa_results = []
            if complete:
                for body in captured["qaChecks"]:
                    owned_body = body.replace("/root/.hermes", str(directory / "hermes"))
                    checked = subprocess.run(["/usr/bin/bash", "-c", owned_body], capture_output=True, timeout=2)
                    qa_results.append({"originalScript": body, "passed": checked.returncode == 0})
            completion = next((event for event in observed if event["kind"] == "complete"), {})
            return {
                "completed": complete, "expectExit": status, "failureKind": failure,
                "answers": answers, "pendingPrompt": pending if not complete else None,
                "catalogueSeeded": completion.get("catalogueSeeded"),
                "profilesCopied": completion.get("profilesCopied"),
                "qaSoulPresent": (directory / "hermes/profiles/qa/SOUL.md").is_file(),
                "qaAgentsPresent": (directory / "hermes/profiles/qa/AGENTS.md").is_file(),
                "qaChecks": qa_results, "capturedHint": captured["capturedHint"],
                "scenarioCleanupCalls": captured["scenarioCleanupCalls"], "driverOrigin": origin,
                "driverSha256": hashlib.sha256(driver.encode()).hexdigest(),
                "launches": len(installer_pids), "watchdogUsed": watchdog,
                "ownedStopped": process.poll() is not None and all(not alive(pid) for pid in installer_pids),
                "decoySurvived": decoy.poll() is None,
                "signalsOwned": all(event["pid"] in [process.pid, *installer_pids] for event in enforcement),
                "cleanupSignals": enforcement, "withinDeadline": time.monotonic() - started < DEADLINE + 3,
                "durationSeconds": round(time.monotonic() - started, 3), "output": output,
            }
        finally:
            if process is not None and process.poll() is None:
                process.kill()
                process.communicate(timeout=2)
            decoy.terminate()
            decoy.wait(timeout=2)


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] == "--installer":
        installer(sys.argv[2], Path(sys.argv[3]))
        return
    harness_path = Path(__file__).with_name("harness.py")
    if not harness_path.exists():
        harness_path = Path(__file__).resolve().parent.parent / "integration/test_full_install_update_process.py"
    captured, identities = capture(harness_path)
    metadata = {"harnessSha256": digest(harness_path), "helperSha256": digest(Path(__file__)),
                "python": sys.version, "scenarioIdentities": identities, "interactiveIdentities": list(SCENARIOS)}
    if "--native" not in sys.argv:
        print(json.dumps({"metadata": {**metadata, "nativeExecuted": False}, "captures": captured}))
        return
    if sys.platform != "linux" or not Path(EXPECT).is_file():
        raise RuntimeError("Native Linux Expect infrastructure unavailable; no emulation or download")
    results: dict[str, Any] = {}
    for scenario, context in captured.items():
        results[f"control:{scenario}"] = run_case(scenario, complete_control(scenario), context, origin="independent")
    # Infrastructure controls must complete before any actual missing-answer evidence is collected.
    for scenario in SCENARIOS:
        control = results[f"control:{scenario}"]
        expected_answers = [{"key": key, "value": value} for key, value in SCENARIOS[scenario]]
        catalogue = dict(SCENARIOS[scenario])["catalogue"] == "y"
        profiles = scenario.endswith("profiles_yes")
        qa = profiles or (catalogue and scenario != "setup_interactive")
        valid = (control["completed"] and control["expectExit"] == 0 and
                 control["answers"] == expected_answers and control["catalogueSeeded"] == catalogue and
                 control["profilesCopied"] == profiles and control["qaSoulPresent"] == qa and
                 control["qaAgentsPresent"] == qa and all(check["passed"] for check in control["qaChecks"]) and
                 all(control[key] for key in ("ownedStopped", "decoySurvived", "signalsOwned", "withinDeadline")))
        if not valid:
            raise RuntimeError(f"Independent control failed for {scenario}: {control['output']}")
    for scenario, context in captured.items():
        results[scenario] = run_case(scenario, context["script"], context, origin="actual-scenario-method")
    scenario = "setup_interactive"
    results["malformed-control"] = run_case(scenario, "set cmd {fixture-command}\n"
                                          "t0202_nonexistent_command\n", captured[scenario], origin="invalid-tcl-control")
    scenario = "install_in_repo_interactive_profiles_no"
    results["catalogue-contamination-control"] = run_case(scenario, complete_control(scenario, contaminate=True),
                                                         captured[scenario], origin="independent-adverse")
    failures: dict[str, list[str]] = {}
    for name, observed in results.items():
        checks = {key: observed[key] is True for key in
                  ("ownedStopped", "decoySurvived", "signalsOwned", "withinDeadline")}
        checks["scenario-cleanup"] = observed["scenarioCleanupCalls"] == 1
        if name == "malformed-control":
            checks["invalid-classification"] = (observed["failureKind"] == "tcl-error" and
                                               observed["launches"] == 0 and not observed["watchdogUsed"])
        else:
            scenario = name.removeprefix("control:")
            adverse = name == "catalogue-contamination-control"
            if adverse:
                scenario = "install_in_repo_interactive_profiles_no"
            choices = [{"key": key, "value": "y" if adverse and key == "catalogue" else value}
                       for key, value in SCENARIOS[scenario]]
            checks["completion"] = observed["completed"] and observed["expectExit"] == 0
            checks["ordered-choices"] = observed["answers"] == choices
            checks["native-launch"] = observed["launches"] == 1
            checks["no-watchdog"] = not observed["watchdogUsed"] and observed["failureKind"] is None
            catalogue = choices[next(i for i, step in enumerate(choices) if step["key"] == "catalogue")]["value"] == "y"
            copied = scenario.endswith("profiles_yes")
            qa = copied or (catalogue and scenario != "setup_interactive")
            checks["effects"] = (observed["catalogueSeeded"] == catalogue and observed["profilesCopied"] == copied and
                                 observed["qaSoulPresent"] == qa and observed["qaAgentsPresent"] == qa)
            checks["preserved-qa-assertions"] = (len(observed["qaChecks"]) == (1 if "in_repo" in scenario else 0) and
                                                all(check["passed"] != adverse for check in observed["qaChecks"]))
        failed = [check for check, passed in checks.items() if not passed]
        if failed:
            failures[name] = failed
    print(json.dumps({"metadata": {**metadata, "nativeExecuted": True,
                     "expect": subprocess.check_output([EXPECT, "-v"], text=True).strip(),
                     "bash": subprocess.check_output(["/usr/bin/bash", "--version"], text=True).splitlines()[0]},
                      "cases": results, "summary": {"total": len(results), "passed": len(results) - len(failures),
                      "failed": len(failures), "infrastructureErrors": 0, "failures": failures}}))
    if "--assert" in sys.argv and failures:
        raise SystemExit(1)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        import traceback
        traceback.print_exc()
        print(f"T0202 interactive fixture infrastructure: {type(error).__name__}: {error}", file=sys.stderr)
        raise SystemExit(2) from error
