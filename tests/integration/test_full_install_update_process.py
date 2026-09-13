#!/usr/bin/env python3
"""
PatterStage — release-confidence install/update harness (Docker, local-only).

Runs isolated scenarios against your **current working tree copy**: ``scripts/bootstrap/setup.sh``,
``scripts/bootstrap/install.sh`` (bootstrap + ``--in-repo``), ``scripts/application/ps-deploy.sh update``,
optional upstream Hermes installer, with runtime-generated user data under ``CH_DATA_DIR`` and Hermes profile
markers. Ephemeral ``git`` state lives **inside the container** only.

**This runs in CI.** The ``install-harness`` job in ``.github/workflows/ci.yml``
runs ``--profile smoke --skip-http`` on every push and pull request. WG-OPS-002
ruled the native host install the one supported deployment model, and death #1 in
the venture brief is a stranger's first install failing, so the install path is a
gate rather than a pre-release ritual (WO-0011).

It was previously marked "not intended for CI". That was true while
``setup.sh``'s ``npm run build`` fetched fonts from the network, which would have
made this job a network flake wearing a gate's clothing. WO-0002 vendored the
fonts, so the build is deterministic and the disclaimer no longer holds.

**Manual verification (still worth doing before releases):** run
``python tests/integration/test_full_install_update_process.py --profile release``
with Docker up, read full logs + final summary, fix failures until exit 0. CI runs
the smoke profile; ``release`` covers the fuller matrix that CI does not.

Non-interactive paths use env flags documented in ``scripts/bootstrap/install.sh`` and
``scripts/tooling/ps-deploy.mjs``. Optional ``--with-interactive`` appends TTY-driven scenarios
that run ``expect`` **inside** the Linux test image (see ``docker/TestHarness.dockerfile``),
so the host stays Windows-friendly (no host-side ``pty``).

Usage (from repository root):
  python tests/integration/test_full_install_update_process.py --profile smoke --skip-http
  python tests/integration/test_full_install_update_process.py --profile release --skip-http
  python tests/integration/test_full_install_update_process.py --profile release --with-real-hermes-install
  python tests/integration/test_full_install_update_process.py --profile release --with-interactive --skip-http
"""

from __future__ import annotations

import argparse
import base64
import os
import random
import shutil
import signal
import string
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Callable

IMAGE_TAG = "patterstage-fulltest:latest"
DOCKERFILE_REL = Path("docker/TestHarness.dockerfile")

DEFAULT_HERMES_INSTALL_URL = (
    "https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh"
)

MARKER_USER_CH = "HARNESS_USER_DATA_MARKER"
MARKER_HERMES_QA_EDIT = "HERMES_USER_EDIT_QA_SOUL"
MARKER_CUSTOM_PROFILE = "CUSTOM_OPERATOR_IMMUTABLE"

# Copy workspace to container without heavy artefacts (rebuilt inside container).
# Wall-clock guard for expect runs (npm ci / build can be slow).
EXPECT_BUILD_TIMEOUT_SEC = 7200

COPY_IGNORE_DIR_NAMES = frozenset(
    {
        "node_modules",
        ".next",
        "coverage",
        ".turbo",
        "playwright-report",
        "test-results",
    }
)


def _repo_root_default() -> Path:
    # tests/integration/<this_file>.py → repo root is three levels up
    return Path(__file__).resolve().parent.parent.parent


def _rand_suffix(length: int = 8) -> str:
    return "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(length))


def _smoke_scenarios(*, include_hermes_upstream: bool) -> list[str]:
    s = ["fresh", "hermes", "dashboard", "both", "update"]
    if include_hermes_upstream:
        s.append("hermes-upstream")
    return s


def _release_scenarios(*, include_hermes_upstream: bool) -> list[str]:
    s = _smoke_scenarios(include_hermes_upstream=False)
    s.extend(
        [
            "restart",
            "rebuild",
            "install_bootstrap",
            "install_in_repo",
            "update_preserves_user_data",
            "update_runs_seed_catalog",
        ]
    )
    if include_hermes_upstream:
        s.append("hermes-upstream")
    return s


def _interactive_scenarios_tail() -> list[str]:
    """Append after non-interactive scenarios when ``--with-interactive`` is used."""
    return [
        "setup_interactive",
        "install_in_repo_interactive_profiles_no",
        "install_in_repo_interactive_profiles_yes",
        "install_bootstrap_interactive",
    ]


def _describe_manifest_change(before: str, after: str) -> str:
    """Say which files went, arrived or changed, rather than only that one did.

    Each manifest line is `<sha256>  <path>` from sha256sum, so the path is the
    identity and the hash is the content. Splitting on that makes the three
    interesting cases separable, and they are not equally alarming: a file that
    VANISHED is possible data loss, while one that merely changed may be a file
    the update is supposed to rewrite and nobody remembered to exclude.
    """

    def index(manifest: str) -> dict[str, str]:
        out: dict[str, str] = {}
        for line in manifest.splitlines():
            line = line.strip()
            if not line:
                continue
            parts = line.split(None, 1)
            if len(parts) == 2:
                out[parts[1].strip()] = parts[0].strip()
        return out

    a, b = index(before), index(after)
    gone = sorted(set(a) - set(b))
    new = sorted(set(b) - set(a))
    changed = sorted(k for k in set(a) & set(b) if a[k] != b[k])

    lines = []
    if gone:
        lines.append("  REMOVED (this is the data-loss case):")
        lines.extend(f"    - {p}" for p in gone)
    if new:
        lines.append("  ADDED:")
        lines.extend(f"    + {p}" for p in new)
    if changed:
        lines.append("  CONTENTS CHANGED:")
        lines.extend(f"    ~ {p}" for p in changed)
    if not lines:
        lines.append("  (the listings differ only in whitespace or ordering)")
    return "\n".join(lines)


class Harness:
    def __init__(
        self,
        repo_root: Path,
        skip_http: bool,
        keep_artifacts: bool,
        with_real_hermes_install: bool,
        hermes_install_url: str,
        profile: str,
        fail_fast: bool,
        continue_on_failure: bool,
    ) -> None:
        self.repo_root = repo_root.resolve()
        self.skip_http = skip_http
        self.keep_artifacts = keep_artifacts
        self.with_real_hermes_install = with_real_hermes_install
        self.hermes_install_url = hermes_install_url
        self.profile = profile
        self.fail_fast = fail_fast
        self.continue_on_failure = continue_on_failure
        self.run_id = _rand_suffix(10)
        self.containers: list[str] = []
        self.temp_dirs: list[Path] = []
        self._built_image = False
        self.scenario_results: list[tuple[str, float, bool, str | None]] = []
        self._started_at = time.perf_counter()

    def register_cleanup(self) -> None:
        def _cleanup(signum: int | None = None, frame: object | None = None) -> None:
            self.cleanup()

        signal.signal(signal.SIGINT, _cleanup)
        signal.signal(signal.SIGTERM, _cleanup)

    def cleanup(self) -> None:
        if self.keep_artifacts:
            print("[harness] --keep-artifacts: leaving Docker resources in place")
            return
        for name in list(self.containers):
            subprocess.run(
                ["docker", "rm", "-f", name],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        self.containers.clear()
        for d in list(self.temp_dirs):
            shutil.rmtree(d, ignore_errors=True)
        self.temp_dirs.clear()

    def check_docker(self) -> None:
        r = subprocess.run(
            ["docker", "info"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if r.returncode != 0:
            print(
                "ERROR: Docker daemon not reachable. Start Docker Desktop / dockerd, then retry.",
                file=sys.stderr,
            )
            sys.exit(2)

    def build_image(self) -> None:
        dockerfile = self.repo_root / DOCKERFILE_REL
        if not dockerfile.is_file():
            print(f"ERROR: missing {dockerfile}", file=sys.stderr)
            sys.exit(2)
        print(f"[harness] building image {IMAGE_TAG} …")
        subprocess.run(
            [
                "docker",
                "build",
                "-f",
                str(dockerfile),
                "-t",
                IMAGE_TAG,
                str(self.repo_root),
            ],
            check=True,
        )
        self._built_image = True

    def copy_workspace(self, dest: Path) -> None:
        dest.mkdir(parents=True, exist_ok=True)

        def _ignore(_path: str, names: list[str]) -> list[str]:
            return [n for n in names if n in COPY_IGNORE_DIR_NAMES]

        shutil.copytree(
            self.repo_root,
            dest,
            dirs_exist_ok=True,
            ignore=_ignore,
        )
        # Never leak the developer's local env into the Linux container — the
        # container writes its own .env.local during setup. Otherwise a host
        # Windows PS_DATA_DIR / HERMES_HOME pollutes the run (paths like
        # `C:\Users\...` become literal dir names inside the container).
        (dest / ".env.local").unlink(missing_ok=True)
        self._normalize_shell_lf(dest)

    def _normalize_shell_lf(self, workspace: Path) -> None:
        for path in workspace.rglob("*.sh"):
            try:
                data = path.read_bytes()
            except OSError:
                continue
            if b"\r\n" not in data and b"\r" not in data:
                continue
            path.write_bytes(data.replace(b"\r\n", b"\n").replace(b"\r", b"\n"))

    def temp_workspace(self) -> Path:
        d = Path(tempfile.mkdtemp(prefix=f"ch-fulltest-{self.run_id}-"))
        self.temp_dirs.append(d)
        self.copy_workspace(d)
        return d

    def start_container(self, scenario: str) -> str:
        name = f"ch-ft-{self.run_id}-{scenario}"
        subprocess.run(
            ["docker", "rm", "-f", name],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        subprocess.run(
            [
                "docker",
                "run",
                "-d",
                "--name",
                name,
                IMAGE_TAG,
                "sleep",
                "infinity",
            ],
            check=True,
        )
        self.containers.append(name)
        return name

    def docker_cp_workspace(self, container: str, workspace: Path) -> None:
        subprocess.run(
            ["docker", "cp", str(workspace) + "/.", f"{container}:/workspace"],
            check=True,
        )
        self.normalize_workspace_ownership(container)

    def normalize_workspace_ownership(self, container: str) -> None:
        """Make ``/workspace`` owned by the user the container's commands run as.

        ``docker cp`` (without ``-a``) preserves the *source* uid/gid whenever the
        source filesystem carries POSIX ownership. On a Linux host that is the
        invoking user — uid 1001 on a GitHub runner — while everything inside the
        container runs as root, so the copied tree lands owned by a stranger. Git
        refuses such a repository ("detected dubious ownership"), and commands that
        set up gently, like ``git config``, degrade that into the far less obvious
        ``fatal: not in a git directory`` — which reads as "there is no .git here"
        and sent WO-0019 hunting a missing directory that was present all along.

        A Windows host has no POSIX ownership to preserve, so the same copy lands
        root-owned and every git scenario passes. That asymmetry, not the checkout
        depth, is why ``update`` passed locally and failed on CI.

        A real install is owned by the user who runs it; mixed ownership is an
        artefact of the copy, so normalising it here restores fidelity rather than
        silencing a check. The line it prints is the diagnostic WO-0019 asked for:
        it records, every run, whether ``.git`` survived the copy and what git
        makes of the result.
        """
        self.docker_exec(
            container,
            "set -e\n"
            "before=$(stat -c '%u:%g' /workspace/.git 2>/dev/null || echo absent)\n"
            'chown -R "$(id -u):$(id -g)" /workspace\n'
            "after=$(stat -c '%u:%g' /workspace/.git 2>/dev/null || echo absent)\n"
            "tree=$(git -C /workspace rev-parse --is-inside-work-tree 2>&1 | tail -n1)\n"
            'echo "[harness] /workspace .git owner ${before} -> ${after}'
            ' (container user $(id -u):$(id -g)); git repo: ${tree}"\n',
            workdir="/",
        )

    def docker_exec(
        self,
        container: str,
        script: str,
        env: dict[str, str] | None = None,
        *,
        workdir: str = "/workspace",
    ) -> None:
        cmd = ["docker", "exec", "-w", workdir]
        if env:
            for k, v in env.items():
                cmd.extend(["-e", f"{k}={v}"])
        cmd.extend([container, "bash", "-lc", script])
        print(f"[harness] docker exec … {script[:80]}…")
        subprocess.run(cmd, check=True)

    def docker_exec_capture(
        self,
        container: str,
        script: str,
        env: dict[str, str] | None = None,
        *,
        workdir: str = "/workspace",
    ) -> str:
        cmd = ["docker", "exec", "-w", workdir]
        if env:
            for k, v in env.items():
                cmd.extend(["-e", f"{k}={v}"])
        cmd.extend([container, "bash", "-lc", script])
        p = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return (p.stdout or "").strip()

    def _docker_write_file(self, container: str, path: str, content: bytes) -> None:
        """Write ``content`` into the container without brittle shell quoting."""
        pp = path.replace("'", "'\"'\"'")
        cmd = ["docker", "exec", "-i", container, "bash", "-lc", f"base64 -d > '{pp}'"]
        subprocess.run(cmd, input=base64.standard_b64encode(content), check=True)

    def docker_exec_expect(
        self,
        container: str,
        exp_body: str,
        *,
        workdir: str = "/workspace",
        env: dict[str, str] | None = None,
        timeout_sec: int = EXPECT_BUILD_TIMEOUT_SEC,
        hint: str = "",
    ) -> None:
        """
        Run ``expect -f`` inside the container with a TTY (``docker exec -t``).

        Embedded ``.exp`` bodies should document which shell prompts they match.
        """
        exp_path = f"/tmp/ch-harness-{self.run_id}-{_rand_suffix(8)}.exp"
        self._docker_write_file(container, exp_path, exp_body.encode("utf-8"))
        cmd: list[str] = ["docker", "exec", "-t", "-w", workdir]
        if env:
            for k, v in env.items():
                cmd.extend(["-e", f"{k}={v}"])
        cmd.extend([container, "expect", "-f", exp_path])
        label = hint or "expect"
        print(f"[harness] docker exec -t expect … {label}")
        subprocess.run(cmd, check=True, timeout=timeout_sec)

    # ── seeds ─────────────────────────────────────────────────

    def seed_fresh(self, container: str) -> None:
        self.docker_exec(
            container,
            "rm -rf /root/.hermes /root/control-hub/data /root/patterstage/data /tmp/chdata /tmp/ch-hub-bare.git "
            "/tmp/ch-install-harness 2>/dev/null || true\n"
            "mkdir -p /root\n",
        )

    def seed_hermes_minimal_config(self, container: str) -> None:
        """Hermes config.yaml only (no profile dirs) — for catalog push tests."""
        self.docker_exec(
            container,
            "set -e\n"
            "mkdir -p /root/.hermes/logs\n"
            "printf '%s\\n' 'version: 1' > /root/.hermes/config.yaml\n",
        )

    def seed_hermes_existing(self, container: str) -> None:
        """Minimal Hermes for smoke persona (custom QA SOUL must survive setup)."""
        self.docker_exec(
            container,
            "mkdir -p /root/.hermes/profiles/qa\n"
            f"printf '%s\\n' '{MARKER_HERMES_QA_EDIT}' > /root/.hermes/profiles/qa/SOUL.md\n"
            "printf '%s\\n' 'version: 1' > /root/.hermes/config.yaml\n"
            "mkdir -p /root/.hermes/logs\n",
        )

    def seed_hermes_rich(self, container: str) -> None:
        """Hermes + bundled qa edit marker + non-bundled profile (immutable)."""
        self.docker_exec(
            container,
            "mkdir -p /root/.hermes/profiles/qa /root/.hermes/profiles/custom-operator "
            "/root/.hermes/logs\n"
            f"printf '%s\\n' '{MARKER_HERMES_QA_EDIT}' > /root/.hermes/profiles/qa/SOUL.md\n"
            "printf '%s\\n' 'version: 1' > /root/.hermes/config.yaml\n"
            "printf '%s\\n' '# harness placeholder' > /root/.hermes/.env\n"
            f"printf '%s\\n' '{MARKER_CUSTOM_PROFILE}' > "
            "/root/.hermes/profiles/custom-operator/SOUL.md\n",
        )

    def precreate_env_local_ch_data_dir(self, container: str, ch_data_dir: str) -> None:
        escaped = ch_data_dir.replace("'", "'\"'\"'")
        self.docker_exec(
            container,
            f"echo 'CH_DATA_DIR={escaped}' > /workspace/.env.local",
        )

    def seed_ch_data_rich(self, container: str, data_root: str) -> None:
        """Runtime CH_DATA_DIR with sentinel JSON + SQLite from prebuild."""
        dr = data_root.replace("'", "'\"'\"'")
        self.docker_exec(
            container,
            "set -e\n"
            f"mkdir -p '{dr}/missions' '{dr}/templates'\n"
            f"printf '%s\\n' '{{\"id\":\"harness-mission-1\",\"title\":\"Harness\"}}' "
            f"> '{dr}/missions/harness-sentinel.json'\n"
            f"printf '%s\\n' '{{\"id\":\"harness-template-1\"}}' "
            f"> '{dr}/templates/harness-sentinel.json'\n"
            f"printf '%s\\n' '{MARKER_USER_CH}' > '{dr}/USER_OWNED_MARKER.txt'\n"
            "cd /workspace\n"
            "npm ci\n"
            "HERMES_HOME=/tmp/ch-prebuild-no-push npm run prebuild\n"
            # prebuild emits patterstage.db on a clean tree, but falls back to an
            # existing control-hub.db (the repo may ship one) — copy whichever it
            # produced, seeded under the LEGACY name so the scenario simulates a
            # pre-rename install that the update migrates.
            f"cp -f data/patterstage.db '{dr}/control-hub.db' 2>/dev/null || "
            f"cp -f data/control-hub.db '{dr}/control-hub.db'\n",
        )

    def seed_both(self, container: str, *, rich_hermes: bool) -> None:
        if rich_hermes:
            self.seed_hermes_rich(container)
        else:
            self.seed_hermes_existing(container)
        self.seed_ch_data_rich(container, "/root/chdata-pre")

    # ── Snapshot / SQLite ─────────────────────────────────────

    def manifest_data_dir(self, container: str, root: str) -> str:
        """Sorted sha256 listing for stable comparison (excludes logs).

        ``hermes-detection.json`` is regenerated by ``ps-deploy update`` / ``scripts/tooling/discover-agents.mjs``
        with new timestamps every run — exclude it so deploy/update harness snapshots stay stable.

        ``control-hub.db`` and ``seed-state.json`` are updated by ``seed-catalog --merge`` on update;
        user-owned JSON/markers are asserted separately via ``assert_sentinel_ch_files``.

        ``auth-token`` is minted by the app on first boot since authentication began
        failing closed, so under ``--skip-http`` it first appears during the update
        rather than during setup. It is excluded here and asserted properly by
        ``assert_auth_token_intact``: what matters about that file is that it exists
        and is not rotated, neither of which a byte-equal listing was checking.
        """
        r = root.replace("'", "'\"'\"'")
        return self.docker_exec_capture(
            container,
            f"set -e\n"
            f"cd '{r}' && find . -type f ! -path './logs/*' "
            f"! -path './hermes-detection.json' "
            f"! -path './control-hub.db' "
            f"! -path './patterstage.db' "
            f"! -path './patterstage.db-wal' ! -path './patterstage.db-shm' "
            f"! -path './control-hub.db-wal' ! -path './control-hub.db-shm' "
            f"! -name '*.pre-migrate-*' ! -name '*.pre-baseline-*' "
            f"! -path './auth-token' "
            f"! -path './seed-state.json' | LC_ALL=C sort | xargs -r sha256sum\n",
            workdir="/",
        )

    def assert_auth_token_intact(self, container: str, root: str, before: str | None) -> None:
        """The token must exist after an update, and must not have been rotated.

        Both halves are the operator's problem rather than a tidiness question.
        A missing token locks them out of their own install; a rotated one
        silently breaks the ``?ps_token`` link the installer printed at them and
        that they have very likely bookmarked.

        ``before`` is the token's contents prior to the update, or None when the
        install had not minted one yet -- which is the ordinary case under
        ``--skip-http``, where no server ran during setup.
        """
        r = root.replace("'", "'\"'\"'")
        after = self.docker_exec_capture(
            container,
            f"test -s '{r}/auth-token' && cat '{r}/auth-token'\n",
            workdir="/",
        ).strip()
        if not after:
            raise AssertionError(
                "auth-token is missing or empty after the update; the operator is locked out",
            )
        if before and before != after:
            raise AssertionError(
                "auth-token was rotated by the update; every bookmarked ?ps_token link is now dead",
            )

    def sha256_file(self, container: str, path: str) -> str:
        p = path.replace("'", "'\"'\"'")
        out = self.docker_exec_capture(
            container,
            f"sha256sum '{p}' | awk '{{print $1}}'\n",
            workdir="/",
        )
        return out.strip()

    def sqlite_schema_version(self, container: str, db_path: str) -> int:
        dp = db_path.replace("'", "'\"'\"'")
        out = self.docker_exec_capture(
            container,
            "cd /workspace && "
            f"export CH_HARNESS_DB='{dp}' && "
            "node -e \""
            "const Database=require('better-sqlite3');"
            "const db=new Database(process.env.CH_HARNESS_DB);"
            "const row=db.prepare(\\\"SELECT value FROM meta WHERE key='schema_version'\\\").get();"
            "console.log(row?row.value:'0');"
            "\"\n",
            workdir="/workspace",
        )
        return int(out.strip() or "0")

    # ── setup / install ─────────────────────────────────────────

    def run_setup(
        self,
        container: str,
        extra_env: dict[str, str] | None = None,
        *,
        install_profile_templates: bool = False,
    ) -> None:
        env = {
            "CI": "1",
            "CH_INSTALL_NONINTERACTIVE": "1",
            "INSTALL_HERMES_PROFILE_TEMPLATES": (
                "yes" if install_profile_templates else "no"
            ),
        }
        if extra_env:
            env.update(extra_env)
        self.docker_exec(
            container,
            "cd /workspace && bash scripts/bootstrap/setup.sh",
            env=env,
        )

    def prepare_hub_bare_repo(self, container: str) -> None:
        """Bare clone at file:///tmp/ch-hub-bare.git with branch dev for install.sh bootstrap."""
        self.docker_exec(
            container,
            r"""
set -e
cd /workspace
git config user.email "harness@local"
git config user.name "harness"
if ! git rev-parse HEAD >/dev/null 2>&1; then
  git add -A
  git commit -m "harness initial" --allow-empty
fi
git add -A
if ! git diff --cached --quiet 2>/dev/null; then
  git commit -m "harness workspace snapshot"
fi
git checkout -B dev
rm -rf /tmp/ch-hub-bare.git
git clone --bare . /tmp/ch-hub-bare.git
""",
        )

    def run_install_bootstrap(self, container: str, install_dir: str) -> None:
        """Full install.sh clone path into INSTALL_DIR (offline hub via file://)."""
        self.prepare_hub_bare_repo(container)
        idir = install_dir.replace("'", "'\"'\"'")
        self.docker_exec(
            container,
            f"set -e\n"
            f"rm -rf '{idir}'\n"
            f"export CI=1 CH_INSTALL_NONINTERACTIVE=1 INSTALL_HERMES=no INSTALL_HINDSIGHT=no\n"
            f"export REPO_URL=file:///tmp/ch-hub-bare.git BRANCH=dev INSTALL_DIR='{idir}'\n"
            "bash /workspace/scripts/bootstrap/install.sh\n"
            f"test -f '{idir}/.env.local'\n"
            f"test -d '{idir}/.next'\n"
            f"grep -q '^PORT=' '{idir}/.env.local'\n",
            env={
                "CI": "1",
                "CH_INSTALL_NONINTERACTIVE": "1",
                "INSTALL_HERMES": "no",
                "INSTALL_HINDSIGHT": "no",
                "REPO_URL": "file:///tmp/ch-hub-bare.git",
                "BRANCH": "dev",
                "INSTALL_DIR": install_dir,
            },
        )

    def run_install_in_repo(self, container: str) -> None:
        """install.sh --in-repo with bundled profile templates (Hermes config present)."""
        self.docker_exec(
            container,
            r"""
set -e
mkdir -p /root/.hermes/logs
printf '%s\n' 'version: 1' > /root/.hermes/config.yaml
cd /workspace
""",
        )
        self.docker_exec(
            container,
            "cd /workspace && bash scripts/bootstrap/install.sh --in-repo",
            env={
                "CI": "1",
                "CH_INSTALL_NONINTERACTIVE": "1",
                "INSTALL_HERMES_PROFILE_TEMPLATES": "yes",
                "INSTALL_HINDSIGHT": "no",
            },
        )
        self.docker_exec(
            container,
            r"""
set -e
test -s /root/.hermes/profiles/qa/SOUL.md
test -s /root/.hermes/profiles/qa/AGENTS.md
""",
        )

    def assert_paths(self, container: str) -> None:
        self.docker_exec(
            container,
            "set -e\n"
            "test -f /workspace/.env.local\n"
            "grep -q '^PORT=' /workspace/.env.local\n"
            "test -d /workspace/.next\n",
        )

    def assert_paths_at(self, container: str, repo: str) -> None:
        rp = repo.replace("'", "'\"'\"'")
        self.docker_exec(
            container,
            f"set -e\n"
            f"test -f '{rp}/.env.local'\n"
            f"grep -q '^PORT=' '{rp}/.env.local'\n"
            f"test -d '{rp}/.next'\n",
            workdir="/",
        )

    def assert_hermes_qa_marker(self, container: str) -> None:
        out = self.docker_exec_capture(
            container,
            "cat /root/.hermes/profiles/qa/SOUL.md",
        )
        if MARKER_HERMES_QA_EDIT not in out:
            raise AssertionError(
                f"expected QA SOUL to retain marker {MARKER_HERMES_QA_EDIT!r}",
            )

    def assert_dashboard_db(self, container: str, data_root: str) -> None:
        self.docker_exec(
            container,
            f"set -e\n"
            f'test -s "{data_root}/patterstage.db" || test -s "{data_root}/control-hub.db"\n',
            workdir="/",
        )

    def assert_rename_migrated(self, container: str, data_root: str) -> None:
        """After `ps-deploy update`, the legacy control-hub.db is renamed to
        patterstage.db in place and .env.local CH_* keys become PS_*."""
        dr = data_root.replace("'", "'\"'\"'")
        self.docker_exec(
            container,
            "set -e\n"
            f"test -s '{dr}/patterstage.db'\n"
            f"test ! -f '{dr}/control-hub.db'\n"
            "grep -q '^PS_RENAMED=1' /workspace/.env.local\n"
            "grep -q '^PS_DATA_DIR=' /workspace/.env.local\n"
            "if grep -q '^CH_DATA_DIR=' /workspace/.env.local; then "
            "echo 'CH_DATA_DIR not rewritten to PS_DATA_DIR' >&2; exit 1; fi\n",
            workdir="/",
        )

    def assert_sentinel_ch_files(self, container: str, data_root: str) -> None:
        dr = data_root.replace("'", "'\"'\"'")
        self.docker_exec(
            container,
            f"set -e\n"
            f"grep -q '{MARKER_USER_CH}' '{dr}/USER_OWNED_MARKER.txt'\n"
            f"grep -q 'harness-mission-1' '{dr}/missions/harness-sentinel.json'\n",
            workdir="/",
        )

    def assert_custom_profile_unchanged(self, container: str) -> None:
        out = self.docker_exec_capture(
            container,
            "cat /root/.hermes/profiles/custom-operator/SOUL.md",
        )
        if MARKER_CUSTOM_PROFILE not in out:
            raise AssertionError("custom-operator profile should stay immutable")

    def assert_seed_qa_disk_matches_db(self, container: str, db_path: str) -> None:
        """After catalog seed + push, Hermes disk should reflect SQLite profile content."""
        dp = db_path.replace("'", "'\"'\"'")
        db_soul = self.docker_exec_capture(
            container,
            "cd /workspace && "
            f"export CH_HARNESS_DB='{dp}' && "
            "node -e \""
            "const Database=require('better-sqlite3');"
            "const db=new Database(process.env.CH_HARNESS_DB);"
            "const row=db.prepare(\\\"SELECT soul_md FROM agent_profiles WHERE slug='qa'\\\").get();"
            "if(!row||!row.soul_md) process.exit(2);"
            "process.stdout.write(row.soul_md);"
            "\"\n",
            workdir="/workspace",
        )
        disk_soul = self.docker_exec_capture(
            container,
            "cat /root/.hermes/profiles/qa/SOUL.md",
            workdir="/",
        )
        if db_soul != disk_soul:
            raise AssertionError(
                "qa SOUL.md on Hermes disk should match agent_profiles.soul_md after catalog push",
            )

    def assert_agent_profiles_seeded(self, container: str, db_path: str) -> None:
        dp = db_path.replace("'", "'\"'\"'")
        out = self.docker_exec_capture(
            container,
            "cd /workspace && "
            f"export CH_HARNESS_DB='{dp}' && "
            "node -e \""
            "const Database=require('better-sqlite3');"
            "const db=new Database(process.env.CH_HARNESS_DB);"
            "const row=db.prepare(\\\"SELECT COUNT(*) AS c FROM agent_profiles WHERE seed_key IS NOT NULL\\\").get();"
            "console.log(row?row.c:0);"
            "\"\n",
            workdir="/workspace",
        )
        count = int(out.strip() or "0")
        if count < 6:
            raise AssertionError(
                f"expected >= 6 seeded agent_profiles after seed-catalog, got {count}",
            )

    def assert_hermes_cli(self, container: str) -> None:
        self.docker_exec(
            container,
            r"""
set -e
export PATH="/usr/local/bin:/root/.local/bin:${PATH}"
command -v hermes
hermes --version
""",
        )

    def assert_bundled_hermes_profiles_installed(self, container: str) -> None:
        self.docker_exec(
            container,
            r"""
set -e
test -s /root/.hermes/profiles/qa/SOUL.md
test -s /root/.hermes/profiles/qa/AGENTS.md
""",
        )

    # ── Hermes upstream ─────────────────────────────────────────

    def run_hermes_upstream_install(self, container: str) -> None:
        url = self.hermes_install_url.replace("'", "'\"'\"'")
        script = f"""
set -euo pipefail
unset PYTHONPATH PYTHONHOME 2>/dev/null || true
export UV_NO_CONFIG=1
export DEBIAN_FRONTEND=noninteractive
export PATH="/usr/local/bin:/root/.local/bin:${{PATH}}"
rm -rf /root/.hermes /usr/local/lib/hermes-agent 2>/dev/null || true
curl -fsSL '{url}' | bash -s --
export PATH="/usr/local/bin:/root/.local/bin:${{PATH}}"
hash -r
command -v hermes
hermes --version
"""
        print("[harness] Hermes upstream install (long-running; needs network) …")
        self.docker_exec(container, script)

    def ensure_hermes_config_after_install(self, container: str) -> None:
        self.docker_exec(
            container,
            r"""
set -e
export PATH="/usr/local/bin:/root/.local/bin:${PATH}"
mkdir -p /root/.hermes
if [ -f /root/.hermes/config.yaml ]; then
  exit 0
fi
if command -v script >/dev/null 2>&1; then
  script -q -c "hermes setup || true" /dev/null || true
fi
if [ ! -f /root/.hermes/config.yaml ]; then
  printf '%s\n' 'version: 1' > /root/.hermes/config.yaml
fi
test -f /root/.hermes/config.yaml
""",
        )

    # ── HTTP smoke ─────────────────────────────────────────────

    def http_smoke(self, container: str, *, workspace: str = "/workspace") -> None:
        if self.skip_http:
            print("[harness] skipping HTTP smoke (--skip-http)")
            return
        ws = workspace.replace("'", "'\"'\"'")
        script = f"""
set -e
PORT=$(grep -E '^PORT=' {ws}/.env.local | tail -n1 | sed 's/^PORT=//' | tr -d '\\r')
export PORT="${{PORT:-3000}}"
cd {ws}
CH_ENABLE_DEPLOY_API=true NODE_OPTIONS= node node_modules/next/dist/bin/next start -p "$PORT" -H 127.0.0.1 >> /tmp/ch-http-smoke.log 2>&1 &
PID=$!
for i in $(seq 1 45); do
  if curl -sf -o /dev/null "http://127.0.0.1:${{PORT}}/"; then
    kill "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
    exit 0
  fi
  sleep 1
done
kill "$PID" 2>/dev/null || true
echo "HTTP smoke timeout" >&2
exit 1
"""
        self.docker_exec(container, script, workdir="/")

    # ── Git offline update ─────────────────────────────────────

    def configure_file_origin_and_push_dev(self, container: str) -> None:
        script = r"""
set -e
cd /workspace
git config user.email "harness@local"
git config user.name "harness"
if ! git rev-parse HEAD >/dev/null 2>&1; then
  git add -A
  git commit -m "harness initial" --allow-empty
fi
git add -A
if ! git diff --cached --quiet 2>/dev/null; then
  git commit -m "harness workspace snapshot"
fi
git checkout -B dev
rm -rf /tmp/ch-origin.git /tmp/ch-origin-wt
git clone --bare . /tmp/ch-origin.git
git remote remove origin 2>/dev/null || true
git remote add origin file:///tmp/ch-origin.git
git push -u origin dev --force
"""
        self.docker_exec(container, script)

    def bump_upstream_dev(self, container: str) -> None:
        script = r"""
set -e
rm -rf /tmp/ch-origin-wt
git clone file:///tmp/ch-origin.git /tmp/ch-origin-wt
cd /tmp/ch-origin-wt
git checkout dev
git config user.email "harness@local"
git config user.name "harness"
mkdir -p scripts
touch scripts/.harness-marker
git add scripts/.harness-marker
git commit -m "harness upstream bump"
git push origin dev
"""
        self.docker_exec(container, script)

    def append_env_local(self, container: str, lines: str) -> None:
        for line in lines.strip().split("\n"):
            if not line.strip():
                continue
            escaped = line.replace("'", "'\"'\"'")
            self.docker_exec(container, f"echo '{escaped}' >> /workspace/.env.local")

    def run_update(self, container: str) -> None:
        self.append_env_local(container, "\nCH_UPDATE_GIT_BRANCH=dev\n")
        self.docker_exec(
            container,
            "cd /workspace && bash scripts/application/ps-deploy.sh update",
            env={
                "CI": "1",
                "CH_INSTALL_NONINTERACTIVE": "1",
                "CH_UPDATE_GIT_BRANCH": "dev",
            },
        )

    def assert_updated_to_origin_dev(self, container: str) -> None:
        script = r"""
set -e
cd /workspace
git fetch origin dev
H=$(git rev-parse HEAD)
R=$(git rev-parse origin/dev)
test "$H" = "$R"
test -f scripts/.harness-marker
"""
        self.docker_exec(container, script)

    # ── scenario runners ──────────────────────────────────────

    def scenario_fresh(self) -> None:
        ws = self.temp_workspace()
        c = self.start_container("fresh")
        try:
            self.docker_cp_workspace(c, ws)
            self.seed_fresh(c)
            self.run_setup(c)
            self.assert_paths(c)
            self.http_smoke(c)
        finally:
            self._rm_container(c)

    def scenario_hermes(self) -> None:
        ws = self.temp_workspace()
        c = self.start_container("hermes")
        try:
            self.docker_cp_workspace(c, ws)
            self.seed_fresh(c)
            self.seed_hermes_existing(c)
            self.run_setup(c)
            self.assert_paths(c)
            self.assert_hermes_qa_marker(c)
            self.http_smoke(c)
        finally:
            self._rm_container(c)

    def scenario_dashboard(self) -> None:
        ws = self.temp_workspace()
        c = self.start_container("dashboard")
        try:
            self.docker_cp_workspace(c, ws)
            self.seed_fresh(c)
            self.seed_ch_data_rich(c, "/root/chdata-pre")
            self.precreate_env_local_ch_data_dir(c, "/root/chdata-pre")
            self.run_setup(c, extra_env={"CH_DATA_DIR": "/root/chdata-pre"})
            self.assert_paths(c)
            self.assert_dashboard_db(c, "/root/chdata-pre")
            self.assert_sentinel_ch_files(c, "/root/chdata-pre")
            self.http_smoke(c)
        finally:
            self._rm_container(c)

    def scenario_both(self) -> None:
        ws = self.temp_workspace()
        c = self.start_container("both")
        rich = self.profile == "release"
        try:
            self.docker_cp_workspace(c, ws)
            self.seed_fresh(c)
            self.seed_both(c, rich_hermes=rich)
            self.precreate_env_local_ch_data_dir(c, "/root/chdata-pre")
            self.run_setup(c, extra_env={"CH_DATA_DIR": "/root/chdata-pre"})
            self.assert_paths(c)
            self.assert_hermes_qa_marker(c)
            self.assert_dashboard_db(c, "/root/chdata-pre")
            self.assert_sentinel_ch_files(c, "/root/chdata-pre")
            if rich:
                self.assert_custom_profile_unchanged(c)
            self.http_smoke(c)
        finally:
            self._rm_container(c)

    def scenario_update(self) -> None:
        ws = self.temp_workspace()
        c = self.start_container("update")
        try:
            self.docker_cp_workspace(c, ws)
            self.seed_fresh(c)
            self.run_setup(c)
            self.assert_paths(c)
            self.configure_file_origin_and_push_dev(c)
            self.bump_upstream_dev(c)
            self.run_update(c)
            self.assert_updated_to_origin_dev(c)
        finally:
            self._rm_container(c)

    def run_deploy_lifecycle(self, container: str, action: str) -> None:
        """Run `ps-deploy.sh <restart|rebuild>` and assert the server came back.

        ps-deploy.mjs spawns a detached next-server then blocks on its own
        readiness probe (GET /api/health), exiting 0 only when the fresh server
        answers — so a 0 exit already proves the lifecycle. We additionally
        confirm the status file reports success for this action and the recorded
        server PID is alive + answering, then stop the detached server. HERMES_HOME
        is pinned to a clean container path so the status/PID files are isolated.
        """
        script = f"""
set -e
cd /workspace
export HERMES_HOME=/root/.hermes
mkdir -p "$HERMES_HOME/logs"
PORT=$(grep -E '^PORT=' /workspace/.env.local | tail -n1 | sed 's/^PORT=//' | tr -d '\\r')
export PORT="${{PORT:-42069}}"
bash scripts/application/ps-deploy.sh {action}
STATUS="$HERMES_HOME/logs/ps-deploy.status"
test -f "$STATUS" || {{ echo "no ps-deploy.status after {action}" >&2; exit 1; }}
grep -q 'state=success' "$STATUS" || {{ echo "deploy {action} not success:" >&2; cat "$STATUS" >&2; exit 1; }}
grep -q 'action={action}' "$STATUS" || {{ echo "status action mismatch:" >&2; cat "$STATUS" >&2; exit 1; }}
PIDFILE="$HERMES_HOME/logs/ps-server.pid"
test -f "$PIDFILE" || {{ echo "no ps-server.pid after {action}" >&2; exit 1; }}
SPID=$(cat "$PIDFILE")
kill -0 "$SPID" 2>/dev/null || {{ echo "spawned server pid $SPID not alive" >&2; exit 1; }}
curl -sf -o /dev/null "http://127.0.0.1:${{PORT}}/api/health" || {{ echo "server not answering /api/health" >&2; exit 1; }}
kill "$SPID" 2>/dev/null || true
echo "[harness] {action} lifecycle OK (pid $SPID on port $PORT)"
"""
        self.docker_exec(
            container,
            script,
            env={"CI": "1", "CH_INSTALL_NONINTERACTIVE": "1", "HERMES_HOME": "/root/.hermes"},
        )

    def scenario_restart(self) -> None:
        """setup → `ps-deploy restart` spawns a server that answers /api/health."""
        ws = self.temp_workspace()
        c = self.start_container("restart")
        try:
            self.docker_cp_workspace(c, ws)
            self.seed_fresh(c)
            self.run_setup(c)
            self.assert_paths(c)
            self.run_deploy_lifecycle(c, "restart")
        finally:
            self._rm_container(c)

    def scenario_rebuild(self) -> None:
        """setup → `ps-deploy rebuild` rebuilds + restarts; server answers."""
        ws = self.temp_workspace()
        c = self.start_container("rebuild")
        try:
            self.docker_cp_workspace(c, ws)
            self.seed_fresh(c)
            self.run_setup(c)
            self.assert_paths(c)
            self.run_deploy_lifecycle(c, "rebuild")
        finally:
            self._rm_container(c)

    def scenario_install_bootstrap(self) -> None:
        ws = self.temp_workspace()
        c = self.start_container("install-bootstrap")
        inst = "/tmp/ch-install-harness"
        try:
            self.docker_cp_workspace(c, ws)
            self.seed_fresh(c)
            self.run_install_bootstrap(c, inst)
            self.assert_paths_at(c, inst)
            self.http_smoke(c, workspace=inst)
        finally:
            self._rm_container(c)

    def scenario_install_in_repo(self) -> None:
        ws = self.temp_workspace()
        c = self.start_container("install-in-repo")
        try:
            self.docker_cp_workspace(c, ws)
            self.seed_fresh(c)
            self.run_install_in_repo(c)
            self.assert_paths(c)
            self.http_smoke(c)
        finally:
            self._rm_container(c)

    def scenario_update_preserves_user_data(self) -> None:
        """``ps-deploy update`` runs seed-catalog but must not wipe user CH_DATA_DIR or custom Hermes profiles."""
        ws = self.temp_workspace()
        c = self.start_container("update-preserves")
        data_root = "/root/chdata-pre"
        try:
            self.docker_cp_workspace(c, ws)
            self.seed_fresh(c)
            self.seed_ch_data_rich(c, data_root)
            self.seed_hermes_rich(c)
            self.precreate_env_local_ch_data_dir(c, data_root)
            self.run_setup(c, extra_env={"CH_DATA_DIR": data_root})
            self.assert_paths(c)

            manifest_before = self.manifest_data_dir(c, data_root)
            schema_before = self.sqlite_schema_version(c, f"{data_root}/control-hub.db")
            # Read rather than hashed, so the assertion after the update can say
            # whether it was ROTATED and not merely whether it differs.
            token_before = self.docker_exec_capture(
                c,
                f"cat '{data_root}/auth-token' 2>/dev/null || true\n",
                workdir="/",
            ).strip()

            self.configure_file_origin_and_push_dev(c)
            self.bump_upstream_dev(c)
            self.run_update(c)
            self.assert_updated_to_origin_dev(c)

            manifest_after = self.manifest_data_dir(c, data_root)
            # The update auto-migrates control-hub.db -> patterstage.db in place
            # and rewrites .env.local CH_* -> PS_* (idempotent, marker recorded).
            self.assert_rename_migrated(c, data_root)
            schema_after = self.sqlite_schema_version(c, f"{data_root}/patterstage.db")

            if manifest_before != manifest_after:
                raise AssertionError(
                    "data dir manifest changed after update; possible data loss\n"
                    + _describe_manifest_change(manifest_before, manifest_after),
                )
            if schema_after < schema_before:
                raise AssertionError("schema_version regressed")
            self.assert_auth_token_intact(c, data_root, token_before or None)
            self.assert_hermes_qa_marker(c)
            self.assert_custom_profile_unchanged(c)
            self.assert_sentinel_ch_files(c, data_root)
        finally:
            self._rm_container(c)

    def scenario_update_runs_seed_catalog(self) -> None:
        """``ps-deploy update`` merges catalog into SQLite and pushes seed profiles to Hermes."""
        ws = self.temp_workspace()
        c = self.start_container("update-seed-catalog")
        data_root = "/root/chdata-pre"
        try:
            self.docker_cp_workspace(c, ws)
            self.seed_fresh(c)
            self.seed_hermes_minimal_config(c)
            self.seed_ch_data_rich(c, data_root)
            self.precreate_env_local_ch_data_dir(c, data_root)
            self.run_setup(c, extra_env={"CH_DATA_DIR": data_root})
            self.assert_paths(c)

            manifest_before = self.manifest_data_dir(c, data_root)

            self.configure_file_origin_and_push_dev(c)
            self.bump_upstream_dev(c)
            self.run_update(c)
            self.assert_updated_to_origin_dev(c)

            manifest_after = self.manifest_data_dir(c, data_root)
            if manifest_before != manifest_after:
                raise AssertionError("CH_DATA_DIR user files changed after update")
            self.assert_agent_profiles_seeded(c, f"{data_root}/patterstage.db")
            self.assert_seed_qa_disk_matches_db(c, f"{data_root}/patterstage.db")
        finally:
            self._rm_container(c)

    def scenario_setup_interactive(self) -> None:
        """Interactive ``setup.sh``: port auto (Enter), Advanced no."""
        ws = self.temp_workspace()
        c = self.start_container("setup-interactive")
        try:
            self.docker_cp_workspace(c, ws)
            self.seed_fresh(c)
            exp = r"""
# setup.sh + ch-port.sh: Port [Enter = auto]: then Advanced: ... [y/N]:
log_user 1
set timeout -1
set cmd {cd /workspace && unset CI CH_INSTALL_NONINTERACTIVE && exec bash scripts/bootstrap/setup.sh}
spawn bash -lc $cmd
expect -re {Port \[Enter = auto\]:}
send "\r"
expect -re {Advanced:.*\[y/N\]:}
send "n\r"
expect eof
catch wait result
exit [lindex $result 3]
"""
            self.docker_exec_expect(c, exp, hint="setup_interactive")
            self.assert_paths(c)
            self.http_smoke(c)
        finally:
            self._rm_container(c)

    def scenario_install_in_repo_interactive_profiles_no(self) -> None:
        """``install.sh --in-repo``: interactive setup + decline bundled profile templates."""
        ws = self.temp_workspace()
        c = self.start_container("install-in-repo-int-no")
        try:
            self.docker_cp_workspace(c, ws)
            self.seed_fresh(c)
            exp = r"""
# install.sh --in-repo: setup.sh port + advanced, then profile templates [y/N]:
log_user 1
set timeout -1
set cmd {cd /workspace && unset CI CH_INSTALL_NONINTERACTIVE INSTALL_HERMES_PROFILE_TEMPLATES && mkdir -p /root/.hermes/logs && printf '%s\n' 'version: 1' > /root/.hermes/config.yaml && exec bash scripts/bootstrap/install.sh --in-repo}
spawn bash -lc $cmd
expect -re {Port \[Enter = auto\]:}
send "\r"
expect -re {Advanced:.*\[y/N\]:}
send "n\r"
expect -re {Install bundled profile templates now\? \[y/N\]:}
send "n\r"
expect eof
catch wait result
exit [lindex $result 3]
"""
            self.docker_exec_expect(c, exp, hint="install_in_repo_interactive_profiles_no")
            self.assert_paths(c)
            self.docker_exec(
                container=c,
                script="test ! -f /root/.hermes/profiles/qa/SOUL.md",
                workdir="/",
            )
            self.http_smoke(c)
        finally:
            self._rm_container(c)

    def scenario_install_in_repo_interactive_profiles_yes(self) -> None:
        """``install.sh --in-repo``: interactive setup + accept bundled profile templates."""
        ws = self.temp_workspace()
        c = self.start_container("install-in-repo-int-yes")
        try:
            self.docker_cp_workspace(c, ws)
            self.seed_fresh(c)
            exp = r"""
# install.sh --in-repo: setup.sh port + advanced, then profile templates [y/N]:
log_user 1
set timeout -1
set cmd {cd /workspace && unset CI CH_INSTALL_NONINTERACTIVE INSTALL_HERMES_PROFILE_TEMPLATES && mkdir -p /root/.hermes/logs && printf '%s\n' 'version: 1' > /root/.hermes/config.yaml && exec bash scripts/bootstrap/install.sh --in-repo}
spawn bash -lc $cmd
expect -re {Port \[Enter = auto\]:}
send "\r"
expect -re {Advanced:.*\[y/N\]:}
send "n\r"
expect -re {Install bundled profile templates now\? \[y/N\]:}
send "y\r"
expect eof
catch wait result
exit [lindex $result 3]
"""
            self.docker_exec_expect(c, exp, hint="install_in_repo_interactive_profiles_yes")
            self.assert_paths(c)
            self.docker_exec(
                container=c,
                script=r"""
set -e
test -s /root/.hermes/profiles/qa/SOUL.md
test -s /root/.hermes/profiles/qa/AGENTS.md
""",
            )
            self.http_smoke(c)
        finally:
            self._rm_container(c)

    def scenario_install_bootstrap_interactive(self) -> None:
        """Bootstrap ``install.sh``: decline Hermes; interactive setup + profiles + Hindsight."""
        ws = self.temp_workspace()
        c = self.start_container("install-bootstrap-interactive")
        inst = "/tmp/ch-install-harness"
        try:
            self.docker_cp_workspace(c, ws)
            self.seed_fresh(c)
            self.docker_exec(
                c,
                "mkdir -p /root/.hermes/logs && printf '%s\\n' 'version: 1' > "
                "/root/.hermes/config.yaml\n",
            )
            self.prepare_hub_bare_repo(c)
            exp = r"""
# install.sh bootstrap: Hermes [Y/n]; setup.sh port + advanced; profiles [y/N]; Hindsight [y/N] (-n1)
log_user 1
set timeout -1
set cmd {cd /workspace && unset CI CH_INSTALL_NONINTERACTIVE && export REPO_URL=file:///tmp/ch-hub-bare.git BRANCH=dev INSTALL_DIR=/tmp/ch-install-harness && rm -rf /tmp/ch-install-harness && exec bash scripts/bootstrap/install.sh}
spawn bash -lc $cmd
expect -re {Install Hermes now\? \[Y/n\]:}
send "n\r"
expect -re {Port \[Enter = auto\]:}
send "\r"
expect -re {Advanced:.*\[y/N\]:}
send "n\r"
expect -re {Install bundled profile templates now\? \[y/N\]:}
send "n\r"
expect -re {Set up Hindsight memory\? \[y/N\]:}
send "n"
expect eof
catch wait result
exit [lindex $result 3]
"""
            self.docker_exec_expect(c, exp, hint="install_bootstrap_interactive")
            self.assert_paths_at(c, inst)
            self.http_smoke(c, workspace=inst)
        finally:
            self._rm_container(c)

    def scenario_hermes_upstream(self) -> None:
        ws = self.temp_workspace()
        c = self.start_container("hermes-upstream")
        try:
            self.docker_cp_workspace(c, ws)
            self.seed_fresh(c)
            self.run_hermes_upstream_install(c)
            self.ensure_hermes_config_after_install(c)
            self.run_setup(c, install_profile_templates=True)
            self.assert_hermes_cli(c)
            self.assert_paths(c)
            self.assert_bundled_hermes_profiles_installed(c)
            self.http_smoke(c)
        finally:
            self._rm_container(c)

    def _rm_container(self, c: str) -> None:
        if not self.keep_artifacts:
            subprocess.run(
                ["docker", "rm", "-f", c],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            if c in self.containers:
                self.containers.remove(c)

    def scenario_fn_map(self) -> dict[str, Callable[[], None]]:
        return {
            "fresh": self.scenario_fresh,
            "hermes": self.scenario_hermes,
            "dashboard": self.scenario_dashboard,
            "both": self.scenario_both,
            "update": self.scenario_update,
            "restart": self.scenario_restart,
            "rebuild": self.scenario_rebuild,
            "install_bootstrap": self.scenario_install_bootstrap,
            "install_in_repo": self.scenario_install_in_repo,
            "update_preserves_user_data": self.scenario_update_preserves_user_data,
            "update_runs_seed_catalog": self.scenario_update_runs_seed_catalog,
            "setup_interactive": self.scenario_setup_interactive,
            "install_in_repo_interactive_profiles_no": (
                self.scenario_install_in_repo_interactive_profiles_no
            ),
            "install_in_repo_interactive_profiles_yes": (
                self.scenario_install_in_repo_interactive_profiles_yes
            ),
            "install_bootstrap_interactive": self.scenario_install_bootstrap_interactive,
            "hermes-upstream": self.scenario_hermes_upstream,
        }

    def run_scenarios(self, names: list[str]) -> bool:
        mapping = self.scenario_fn_map()
        fail_fast = self.fail_fast and not self.continue_on_failure
        all_ok = True
        for n in names:
            print(f"\n[harness] ========== scenario: {n} ==========")
            t0 = time.perf_counter()
            err: str | None = None
            ok = True
            try:
                mapping[n]()
            except (subprocess.CalledProcessError, AssertionError) as e:
                ok = False
                err = repr(e)
                print(f"[harness] scenario FAIL: {n}: {err}", file=sys.stderr)
                all_ok = False
                dur = time.perf_counter() - t0
                self.scenario_results.append((n, dur, False, err))
                if fail_fast:
                    break
                continue
            dur = time.perf_counter() - t0
            self.scenario_results.append((n, dur, True, None))
            print(f"[harness] scenario OK: {n} ({dur:.1f}s)")
        return all_ok

    def print_summary(self) -> None:
        total = time.perf_counter() - self._started_at
        line = "=" * 58
        print(f"\n{line}")
        print("HARNESS SUMMARY (local release-confidence)")
        print(line)
        for name, dur, ok, err in self.scenario_results:
            status = "PASS" if ok else "FAIL"
            print(f"  [{status}] {name:<32} {dur:8.1f}s")
            if err and not ok:
                print(f"         {err}")
        passed = sum(1 for _, _, ok, _ in self.scenario_results if ok)
        ran = len(self.scenario_results)
        print(line)
        print(f"  Total wall time: {total:.1f}s  |  Passed {passed}/{ran}")
        print(line)


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Local Docker harness: bootstrap install/setup + ps-deploy update release confidence",
    )
    p.add_argument(
        "--repo-root",
        type=Path,
        default=_repo_root_default(),
        help="Repository root (default: parents of tests/integration/<this file>)",
    )
    p.add_argument(
        "--profile",
        choices=("release", "smoke"),
        default="smoke",
        help=(
            "smoke (default): core personas + basic update; "
            "release: + install bootstrap/in-repo + update preserve/sync matrix"
        ),
    )
    p.add_argument(
        "--scenarios",
        type=str,
        default="all",
        help=(
            "Comma-separated scenario ids, or 'all' (default). Interactive ids: "
            "setup_interactive, install_in_repo_interactive_profiles_no|yes, "
            "install_bootstrap_interactive. "
            "See script docstring."
        ),
    )
    p.add_argument(
        "--skip-http",
        action="store_true",
        help="Skip Next.js start + curl smoke",
    )
    p.add_argument(
        "--keep-artifacts",
        action="store_true",
        help="Do not remove Docker containers / temp dirs",
    )
    p.add_argument(
        "--with-interactive",
        action="store_true",
        help=(
            "After ``all`` scenarios, append TTY/expect pack (rebuild image for ``expect``; "
            "slow). Does not auto-append when ``--scenarios`` lists explicit ids without ``all``."
        ),
    )
    p.add_argument(
        "--with-real-hermes-install",
        action="store_true",
        help="Append hermes-upstream (NousResearch installer; network, slow)",
    )
    p.add_argument(
        "--offline",
        action="store_true",
        help="Skip hermes-upstream even if --with-real-hermes-install (hub clone still uses npm)",
    )
    p.add_argument(
        "--continue-on-failure",
        action="store_true",
        help="Run all scenarios even after a failure (exit code still nonzero if any failed)",
    )
    p.add_argument(
        "--no-fail-fast",
        action="store_true",
        help="Alias for --continue-on-failure",
    )
    return p.parse_args(argv)


def _valid_scenario_ids() -> frozenset[str]:
    return frozenset(
        {
            "fresh",
            "hermes",
            "hermes-upstream",
            "dashboard",
            "both",
            "update",
            "restart",
            "rebuild",
            "install_bootstrap",
            "install_in_repo",
            "update_preserves_user_data",
            "update_runs_seed_catalog",
            "setup_interactive",
            "install_in_repo_interactive_profiles_no",
            "install_in_repo_interactive_profiles_yes",
            "install_bootstrap_interactive",
            "all",
            "update-all",
        }
    )


def expand_scenarios(
    spec: str,
    *,
    profile: str,
    include_hermes_upstream: bool,
    with_interactive: bool,
) -> list[str]:
    spec_l = spec.strip().lower()
    if spec_l in ("all", "update-all"):
        if profile == "smoke":
            names = _smoke_scenarios(include_hermes_upstream=include_hermes_upstream)
        else:
            names = _release_scenarios(include_hermes_upstream=include_hermes_upstream)
        if with_interactive:
            names = names + _interactive_scenarios_tail()
        return names

    parts = [x.strip() for x in spec.split(",") if x.strip()]
    valid = _valid_scenario_ids()
    for x in parts:
        if x not in valid:
            raise SystemExit(f"unknown scenario: {x}")
    if "all" in parts or "update-all" in parts:
        if profile == "smoke":
            names = _smoke_scenarios(include_hermes_upstream=include_hermes_upstream)
        else:
            names = _release_scenarios(include_hermes_upstream=include_hermes_upstream)
        if with_interactive:
            names = names + _interactive_scenarios_tail()
        return names
    return parts


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    hermes_url = os.environ.get("HERMES_INSTALL_URL", DEFAULT_HERMES_INSTALL_URL).strip()
    if not hermes_url:
        print("ERROR: HERMES_INSTALL_URL is empty", file=sys.stderr)
        return 2

    include_upstream = args.with_real_hermes_install and not args.offline
    names = expand_scenarios(
        args.scenarios,
        profile=args.profile,
        include_hermes_upstream=include_upstream,
        with_interactive=args.with_interactive,
    )

    continue_on = args.continue_on_failure or args.no_fail_fast
    h = Harness(
        repo_root=args.repo_root,
        skip_http=args.skip_http,
        keep_artifacts=args.keep_artifacts,
        with_real_hermes_install=include_upstream,
        hermes_install_url=hermes_url,
        profile=args.profile,
        fail_fast=True,
        continue_on_failure=continue_on,
    )
    h.register_cleanup()
    exit_ok = False
    try:
        print(
            f"[harness] profile={args.profile} scenarios={','.join(names)} "
            f"skip_http={args.skip_http} with_interactive={args.with_interactive}",
        )
        h.check_docker()
        h.build_image()
        exit_ok = h.run_scenarios(names)
        if exit_ok:
            print("\n[harness] ALL SCENARIOS PASSED")
    except subprocess.CalledProcessError as e:
        print(f"\n[harness] FAILED: {e}", file=sys.stderr)
        exit_ok = False
    except AssertionError as e:
        print(f"\n[harness] ASSERTION FAILED: {e}", file=sys.stderr)
        exit_ok = False
    finally:
        h.print_summary()
        h.cleanup()

    return 0 if exit_ok else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
