#!/usr/bin/env python3
"""Independent T-0205 observer. Never reads Harness or writes existing fixtures.

Only the fixture's shell writer is decorated. The native bridge, listener,
request mapping, environment registration and watchdog remain unchanged.
Faults replace returned status bytes only after the real native curl completes.
Private --reference calibration is never selected by the acceptance suite.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time

HERE = Path(__file__).resolve()
FIXTURE = HERE.with_name("release-install-http-probe.py")
FAULTS = ("suffix", "second-line", "partial", "nul", "empty", "exit", "write-refused",
          "newline", "newlines", "stale")
CASES = ("healthy", "unset-tmpdir", "stalled", "wrong-credential", "health-503", "occupied-listener",
         "stubborn", "scratch-refused", *(f"fault-{fault}" for fault in FAULTS))

# Phase recording uses builtins without command substitutions.
ENTRY = r'''
  local t0205_phase=pre
  [[ -f "$T0202_ROOT/launches" ]] && t0205_phase=post
  printf '%s %s %s\n' "$$" "$BASHPID" "$t0205_phase" >> "$T0202_ROOT/context-entries"
'''
OUTPUT = r'''
  printf '%s\n' "$status" >> "$T0202_ROOT/context-completed"
  local t0205_auth=no t0205_arg t0205_health=no t0205_fault=none
  for t0205_arg in "${args[@]}"; do
    [[ "$t0205_arg" == Authorization:* ]] && t0205_auth=yes
    [[ "$t0205_arg" == */api/health ]] && t0205_health=yes
  done
  IFS= read -r t0205_fault < "$T0202_ROOT/context-fault"
  if [[ "$t0205_fault" == stale && "$t0205_health" == yes && -f "$T0202_ROOT/launches" ]]; then
    printf 'stale\n' >> "$T0202_ROOT/context-injected"
    if [[ -f "$T0202_ROOT/context-seeded" ]]; then output=''; else
      printf 'seed\n' > "$T0202_ROOT/context-seeded"; output=200; status=28
    fi
  elif [[ "$t0205_auth" == yes ]]; then
    case "$t0205_fault" in
      suffix) output=200junk;;
      second-line) output=$'200\njunk';;
      partial) output=20;;
      empty) output='';;
      exit) output=200; status=28;;
      newline) output=$'200\n';;
      newlines) output=$'200\n\n';;
      nul)
        printf 'nul\n' >> "$T0202_ROOT/context-injected"
        printf '%s\n' "$status" >> "$T0202_ROOT/context-returned-exits"
        printf '200\0'; return "$status";;
      write-refused)
        printf 'write-refused\n' >> "$T0202_ROOT/context-injected"
        printf '74\n' >> "$T0202_ROOT/context-returned-exits"
        exec 1>&-; return 74;;
    esac
    [[ "$t0205_fault" != none && "$t0205_fault" != stale ]] && printf '%s\n' "$t0205_fault" >> "$T0202_ROOT/context-injected"
  fi
  printf '%s\n' "$status" >> "$T0202_ROOT/context-returned-exits"
  printf '%s' "$output"
'''
UTILITIES = r'''
mktemp() {
  local t0205_fault=none t0205_path='' t0205_status
  IFS= read -r t0205_fault < "$T0202_ROOT/context-fault"
  printf 'attempt\n' >> "$T0202_ROOT/context-scratch-attempts"
  if [[ "$t0205_fault" == scratch-refused ]]; then return 73; fi
  command mktemp "$@" > "$T0202_ROOT/context-scratch-return"
  t0205_status=$?
  if ((t0205_status == 0)); then
    IFS= read -r t0205_path < "$T0202_ROOT/context-scratch-return"
    printf '%s\n' "$t0205_path" >> "$T0202_ROOT/context-scratch-paths"
    if [[ -f "$t0205_path" && ! -L "$t0205_path" ]]; then
      printf 'file\n' >> "$T0202_ROOT/context-scratch-types"
      if ! command stat -c '%a' "$t0205_path" >> "$T0202_ROOT/context-scratch-modes" 2>/dev/null; then
        command stat -f '%Lp' "$t0205_path" >> "$T0202_ROOT/context-scratch-modes"
      fi
    else printf 'invalid\n' >> "$T0202_ROOT/context-scratch-types"; fi
  fi
  command cat "$T0202_ROOT/context-scratch-return"
  return "$t0205_status"
}
export -f mktemp
'''


def native_path(value: str) -> Path:
    if os.name == "nt" and len(value) > 3 and value[0] == "/" and value[2] == "/":
        return Path(value[1] + ":" + value[2:])
    return Path(value)


def collect(fixture: Path, destination: Path) -> None:
    def lines(name: str) -> list[str]:
        path = fixture / name
        return path.read_text(encoding="utf-8").splitlines() if path.exists() else []

    identities = [[int(value) for value in row.split()] for row in lines("context-identity")]
    entries = [{"shellPid": int(row.split()[0]), "bashPid": int(row.split()[1]),
                "phase": row.split()[2]} for row in lines("context-entries")]
    paths = [native_path(value) for value in lines("context-scratch-paths")]
    owned = [path.resolve().is_relative_to((fixture / "scratch").resolve()) for path in paths]
    # Retain only metadata, never scratch contents, credentials or shell source.
    row = {"identity": identities, "entries": entries,
           "completedExits": [int(value) for value in lines("context-completed")],
           "returnedExits": [int(value) for value in lines("context-returned-exits")],
           "scratchModes": lines("context-scratch-modes"),
           "connectBounded": bool(lines("bounds")) and
               all(row.split() == ["1", "1"] for row in lines("bounds")),
           "injected": lines("context-injected"),
           "scratchAttempts": len(lines("context-scratch-attempts")),
           "scratchCreated": len(paths), "scratchExclusive": bool(paths) and
               len(set(paths)) == len(paths) and lines("context-scratch-types") == ["file"] * len(paths),
           "scratchPrivate": bool(paths) and len(lines("context-scratch-modes")) == len(paths) and
               all(value == "600" for value in lines("context-scratch-modes")),
           "scratchOwned": bool(paths) and all(owned),
           "scratchRemoved": bool(paths) and all(not path.exists() for path in paths),
           "probeExit": int(lines("status")[-1]),
           "scratchCreatedBeforeLaunch": bool(paths) and lines("context-scratch-launch") == ["pre"] * len(paths)}
    with destination.open("x", encoding="utf-8") as output:
        json.dump(row, output)


def observe(case: str, bash: str, reference: Path | None = None) -> dict[str, object]:
    spec = importlib.util.spec_from_file_location("t0205_fixture", FIXTURE)
    if spec is None or spec.loader is None:
        raise RuntimeError("Cannot load public HTTP fixture")
    fixture_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(fixture_module)
    original_writer = fixture_module.shell_file
    fault = case.removeprefix("fault-") if case.startswith("fault-") else case if case == "scratch-refused" else "none"
    base = "health-503" if fault == "stale" else "healthy" if case.startswith("fault-") or case in ("scratch-refused", "unset-tmpdir") else case
    with tempfile.TemporaryDirectory(prefix="t0205-context-") as directory:
        receipts = Path(directory)
        observation_file = receipts / "observation.json"
        audit = receipts / "rpc"

        def writer(path: Path, source: str) -> None:
            if path.name == "supervisor.sh":
                (path.parent / "context-fault").write_text(fault + "\n", encoding="utf-8", newline="\n")
                if source.count("curl() {\n") != 1 or source.count('  printf \'%s\' "$output"\n') != 1:
                    raise RuntimeError("HTTP fixture instrumentation interface drift")
                source = source.replace("curl() {\n", "curl() {\n" + ENTRY, 1)
                source = source.replace('  printf \'%s\' "$output"\n', OUTPUT, 1)
                source = 'export TMPDIR="$T0202_ROOT/scratch"\n' + UTILITIES + source
                source += f'\ncommand "{fixture_module.shell_path(Path(sys.executable))}" "{fixture_module.shell_path(HERE)}" --collect "$T0202_ROOT" "{fixture_module.shell_path(observation_file)}" || exit 90\n'
                source = source.replace('    printf \'%s\\n\' "$t0205_path" >>',
                    '    if [[ -f "$T0202_ROOT/launches" ]]; then printf post; else printf pre; fi >> "$T0202_ROOT/context-scratch-launch"\n    printf \'\\n\' >> "$T0202_ROOT/context-scratch-launch"\n    printf \'%s\\n\' "$t0205_path" >>', 1)
            elif path.name == "probe.sh":
                # Opaque generated script: prepend identity and relocate /tmp only.
                # Reference mode replaces it with a private calibration control.
                if reference is not None:
                    source = reference.read_text(encoding="utf-8")
                owned_root = fixture_module.shell_path(path.parent)
                # Protect paths already relocated by the fixture on Linux.
                source = source.replace(owned_root, "__T0205_OWNED_ROOT__")
                source = source.replace("/tmp", f"{owned_root}/scratch")
                source = source.replace("__T0205_OWNED_ROOT__", owned_root)
                source = 'printf \'%s %s\\n\' "$$" "$BASHPID" >> "$T0202_ROOT/context-identity"\n' + source
                if case == "unset-tmpdir":
                    source = "unset TMPDIR\n" + source
            original_writer(path, source)

        fixture_module.shell_file = writer
        previous = os.environ.get("T0202_RPC_AUDIT_DIR")
        os.environ["T0202_RPC_AUDIT_DIR"] = str(audit)
        started = time.monotonic()
        try:
            result = fixture_module.run_case(base, bash)
        finally:
            if previous is None:
                os.environ.pop("T0202_RPC_AUDIT_DIR", None)
            else:
                os.environ["T0202_RPC_AUDIT_DIR"] = previous
        elapsed = time.monotonic() - started
        rows = [json.loads(path.read_text()) for path in audit.glob("*.json")]
        if not observation_file.exists() or len(rows) != 1:
            raise RuntimeError("Missing context or native bridge receipt")
        result.update(json.loads(observation_file.read_text()), native=rows[0],
                      elapsedSeconds=elapsed, faultControl=fault != "none",
                      referenceCalibration=reference is not None)
        return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("cases", nargs="*")
    parser.add_argument("--collect", nargs=2, metavar=("FIXTURE", "DESTINATION"))
    parser.add_argument("--reference", type=Path, help="private calibration only")
    arguments = parser.parse_args()
    invalid_cases = [case for case in arguments.cases if case not in CASES]
    if invalid_cases:
        parser.error("Unknown T-0205 case")
    if arguments.collect:
        collect(*(native_path(value) for value in arguments.collect))
        return
    bash = os.environ.get("T0202_BASH") or ("C:/Program Files/Git/bin/bash.exe" if os.name == "nt" else shutil.which("bash"))
    if not bash:
        raise RuntimeError("Bash unavailable")
    subprocess.run([bash, "--noprofile", "--norc", "-c", "export PATH=/usr/bin:/bin:$PATH; command -v curl >/dev/null && command -v timeout >/dev/null && command -v mktemp >/dev/null && command -v stat >/dev/null"], check=True, capture_output=True, timeout=25)
    directory = os.environ.get("T0206_ACTUAL_PHASE_DIR")
    diagnostic_errors, results = [], {}
    for case in arguments.cases or CASES:
        if directory and case == "stalled":
            spec = importlib.util.spec_from_file_location("t0206_actual", HERE.with_name("release-http-phase-observer.py"))
            if spec is None or spec.loader is None:
                raise RuntimeError("Actual phase observer unavailable")
            observer = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(observer)
            results[case] = observer.observe_actual(observe, case, bash, arguments.reference,
                native_path(directory), diagnostic_errors)
        else:
            results[case] = observe(case, bash, arguments.reference)
    print(json.dumps(results))
    if diagnostic_errors:
        raise RuntimeError("T0206 actual diagnostic infrastructure failure")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # No subprocess exception text: it can contain generated source/secrets.
        print("T-0205 observer infrastructure failure", file=sys.stderr)
        sys.exit(90)
