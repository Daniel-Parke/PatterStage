---
title: Platforms
summary: The Linux-first platform ruling, and what Linux, macOS and Windows under WSL2 each get
section: running
nav: 70
audience: operator
type: reference
tags: [product, platform]
compiled_from: normalised
---
# Platforms (Linux · macOS · Windows/WSL2)

PatterStage is a **Linux-first** application: Linux is the only supported,
tested production target, in line with the [PatterTech](https://pattertech.com)
local-first vision and **[PatterOS](https://github.com/Daniel-Parke/PatterOS)**
(the Ubuntu/Mint AI-workstation setup PatterStage folds into). It also runs on
**macOS** as a best-effort developer environment (macOS is Unix: bash, cron,
`better-sqlite3`, the same scripts). On **Windows**, run it under **WSL2
(Ubuntu)**, which *is* Linux, so you get the fully-supported path.

There is no native-Windows operational layer (Task Scheduler, PowerShell
installer). This keeps the codebase focused on one OS family and removes the
most fragile, highest-maintenance code.

## Support tiers

| Tier | Platform | Status |
|------|----------|--------|
| **1** | **Linux** (Ubuntu/Debian/Mint) | Supported + tested in CI. The production + PatterOS target. |
| **2** | **macOS** | Best-effort developer environment (Unix); built + unit-tested in CI. |
| n/a | **Windows** | Via **WSL2 (Ubuntu)**, a Tier-1 Linux environment. No native-Windows support. |

The app UI + the PatterStage ↔ Hermes link are pure HTTP and identical
everywhere; the OS-specific code is PatterStage's *operational* layer
(self-update, host-script scheduling), which is Unix (Linux + macOS) behind
**two** seams:

| Seam | Used by |
|------|---------|
| [`src/lib/platform.ts`](../../src/lib/platform.ts) | everything inside the Next app: host-script scheduling and interpreter choice, the deploy spawn, port probes |
| [`scripts/tooling/_platform.mjs`](../../scripts/tooling/_platform.mjs) | the standalone deploy runner only |

The runner ([`ps-deploy.mjs`](../../scripts/tooling/ps-deploy.mjs)) executes in bare
`node`, outside the Next build, so it cannot import the first seam and carries
its own copy of the same primitives (`isWindows`, `detachedSpawn`, `isPidAlive`,
`killByPort`, `killPid`, `portInUse`). Change one and change the other: looking
for the self-update OS coupling in `src/lib/platform.ts` alone will not find it.

## Install

### Linux (Tier 1) / macOS (Tier 2)

```bash
git clone https://github.com/Daniel-Parke/PatterStage.git
cd PatterStage
bash scripts/bootstrap/install.sh --in-repo   # or omit --in-repo to clone to ~/patterstage
npm run start:network
```

### Windows → WSL2 (Ubuntu)

```powershell
# One-time, from an elevated PowerShell:
wsl --install -d Ubuntu
# Reboot if prompted, then open the "Ubuntu" app and follow the Linux steps above.
```

WSL2 forwards `localhost`, so the dashboard is reachable from a Windows browser
at the URL setup prints (e.g. `http://127.0.0.1:42069/`). Running under WSL2 also
gives you the Linux paths the rest of the stack expects. The Hermes gateway,
Hindsight memory (Postgres + the systemd/Docker server), and host-script cron all
"just work" as on a Linux box. (`install.ps1` is only a pointer to these steps.)

## How the operational layer works (Unix)

| Concern | Implementation |
|---------|----------------|
| Detached survivor process | `spawn` detached + `unref()` (no `nohup`/`systemd` needed) |
| Is a PID alive | `process.kill(pid, 0)` |
| Kill a process | `process.kill(SIGKILL)` |
| Who owns a TCP port | `ss` / `lsof` |
| Run a script by extension | `.sh`→bash, `.mjs/.js`→node, `.ps1`→pwsh |

Self-update ([`scripts/tooling/ps-deploy.mjs`](../../scripts/tooling/ps-deploy.mjs))
is one Node program: a lock (atomic `mkdir`), `git fetch`/`reset`, conditional
`npm install`, `npm run build`, DB migrate, then restart (`killByPort` + kill old
PID + detached `next start` + a readiness poll on **`/api/health`**). The poll
targets `/api/health` deliberately: it is the one endpoint
[`src/proxy.ts`](../../src/proxy.ts) leaves unauthenticated, so it is the only one a
token-less restart can reach. `ps-deploy.sh` is a thin `exec node …` wrapper.

The `PS_SOCAT_RELAY` LAN relay no longer exists. Its launcher went with the bash
deploy implementation; nothing in the repo starts `socat` now, so the
`PS_SOCAT_*` variables are inert. See [DEPLOY.md](DEPLOY.md).

> `src/lib/platform.ts` still carries thin Windows fallbacks for its primitives,
> so the dev server (`npm run dev`) incidentally runs on a native-Windows box,
> but that path is **not** tested or supported; use WSL2.

## Host-script scheduling

Host scripts (the **Scripts** page) are scheduled in the user **crontab** on
Linux + macOS, and under WSL2 the Ubuntu crontab is used like any Linux host.
Those rows fire whether PatterStage is running or not, which is what a host
scheduler buys you.

Native Windows has no crontab, and there is still no Task Scheduler backend. It
is no longer a dead end: the Schedule button writes a PatterStage `schedules`
row instead and PatterStage's own timer runs the script, at the honest cost that
it only fires while PatterStage is running. The page says which of the two it
wrote, on the row and in the modal, so the difference is met before it is relied
on. `GET /api/scripts` carries the answer as `scheduler: { available, reason }`.

Schedule the cross-platform Node versions of the bundled hardware scripts:
`ps-db-backup.mjs`, `ps-health-check.mjs`, `ps-log-rotate.mjs`,
`ps-disk-report.mjs`, `ps-system-report.mjs`. What ships and what gets installed
is not Node-only, though: `scripts/hardware/` also holds a bash sibling of each
of those five, the Hindsight backup `ps-backup.sh`, and six pre-rename `ch-*.sh`
shims, and setup copies **every** `.sh` and `.mjs` into `PS_DATA_DIR/scripts`. So
the Scripts page will list the `.sh` files too. `ps-backup.sh` needs bash and a
running Hindsight server, which makes it Unix-only rather than Linux-only: it
works on macOS.

## CI

[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) runs `build-test-ubuntu`
and `build-test-macos` (lint + `tsc` + the full unit suite + production build),
plus a `boot-smoke` matrix (`ubuntu` · `macos`) running
[`tests/scripts/boot-smoke.mjs`](../../tests/scripts/boot-smoke.mjs), which covers the OS-seam
primitives (detached-spawn survival, port probing, process kill) + a bundled
`.mjs`. Docker, e2e (Playwright), and real-Hermes jobs are Linux-only. There is
no Windows CI job.
