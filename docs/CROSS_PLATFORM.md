# Cross-platform (Windows · macOS · Linux)

PatterStage runs on **Windows, macOS, and Linux**. This is a core requirement,
not a best-effort: [Hermes](https://hermes-agent.nousresearch.com/docs/getting-started/installation)
and [Hermes Desktop](https://hermes-agent.nousresearch.com/docs) are themselves
cross-platform and expose the **same HTTP API server on `127.0.0.1:8642`** on
every OS, so the PatterStage ↔ Hermes link is pure HTTP and platform-agnostic by
construction. The only OS-specific code is PatterStage's own *operational* layer
(self-update, host-script scheduling, install), which has one Node implementation
behind a single seam, [`src/lib/platform.ts`](../src/lib/platform.ts).

## Support matrix

| Capability | Linux | macOS | Windows |
|------------|:-----:|:-----:|:-------:|
| Dashboard, Missions, Chat, Sessions, Models, config editing | ✅ | ✅ | ✅ |
| Talk to Hermes (HTTP API server) | ✅ | ✅ | ✅ |
| Recurring **missions** (app's own DB scheduler) | ✅ | ✅ | ✅ |
| In-app **self-update / rebuild / restart** | ✅ | ✅ | ✅ |
| **Host-script** scheduling | ✅ `crontab` | ✅ `crontab` | ✅ Task Scheduler (`schtasks`) |
| Bundled host scripts (`.mjs`) | ✅ | ✅ | ✅ |
| Hindsight memory provider (backup, `ps-backup.sh`) | ✅ | ⚠️ partial | ❌ Unix-only |
| LAN exposure relay (`socat`) | ✅ | ✅ | ❌ not needed/used |

Everything in the app UI is identical across OSes; the differences are confined
to the host-integration features above.

## Install

### Linux / macOS

```bash
git clone https://github.com/Daniel-Parke/PatterStage.git
cd PatterStage
bash scripts/bootstrap/install.sh --in-repo   # or omit --in-repo to clone to ~/patterstage
npm run start:network
```

### Windows (PowerShell)

Requires **Node.js 20+** and **Git** on `PATH`.

```powershell
# Fresh machine (clones to %USERPROFILE%\patterstage, then sets up):
iex (irm https://raw.githubusercontent.com/Daniel-Parke/PatterStage/dev/install.ps1)

# Or from an existing clone:
powershell -ExecutionPolicy Bypass -File install.ps1 -InRepo
# install.ps1 only bootstraps (verify node+git, clone/update) then hands off to:
node scripts\bootstrap\setup.mjs
```

`setup.mjs` is the portable, non-interactive setup used on all OSes by Windows
and available everywhere: it checks Node ≥ 20, picks a free `PORT` (42069–42100),
writes `.env.local` (`PORT`, `PS_ALLOWED_DEV_ORIGINS` from your network
interfaces, `HERMES_HOME`), wires the Hermes `API_SERVER_KEY` when a
`config.yaml` exists, creates the data dirs + copies the bundled host scripts,
then runs `npm install` / `npm run build` / migrate / seed. Start with
`npm run start:network`.

> The Linux/macOS bash `install.sh` / `setup.sh` remain the interactive path on
> Unix (with Hermes install, Hindsight, profile templates). `setup.mjs` covers
> the cross-platform core and is the Windows path.

## How the operational layer is cross-platform

| Concern | Unix | Windows |
|---------|------|---------|
| Detached survivor process | `spawn` detached + `unref()` | same — `stdio:"ignore"` + `unref()` + `windowsHide:true` (no `nohup`/`systemd`) |
| Is a PID alive | `process.kill(pid,0)` | same |
| Kill a process (tree) | `process.kill(SIGKILL)` | `taskkill /PID … /F /T` |
| Who owns a TCP port | `ss` / `lsof` | `netstat -ano` |
| Run a script by extension | `.sh`→bash, `.mjs/.js`→node, `.ps1`→pwsh | `.mjs/.js`→node, `.ps1`→`powershell -File`, `.bat/.cmd`→`cmd /c` |
| Package manager | `npm` / `npx` | `npm.cmd` / `npx.cmd` (`shell:true`) |
| `.ts` tooling | `node --import tsx <script>` | same |

Self-update (`scripts/tooling/ps-deploy.mjs`) is one Node program: a lock (atomic
`mkdir`), `git pull`, conditional `npm install`, `npm run build`, DB migrate, then
restart (`killByPort` + kill old PID + detached `next start` + `/api/status`
readiness poll). The bash `ps-deploy.sh` is now a thin `exec node …` wrapper, so
the Unix CLI and shims keep working. The LAN `socat` relay step is Unix-only.

## Host-script scheduling: cron vs. Task Scheduler

On Linux/macOS, schedules live in the user `crontab`. On Windows there is no
crontab, so PatterStage uses **Task Scheduler** (`schtasks`) under a
`PatterStage\` task folder, with a per-task launcher `.cmd` (which redirects to
the log) and a `PS_DATA_DIR\.schtasks-cron.json` sidecar that preserves the
human-readable cron for the UI. The Scripts-page API and UI are identical; only
the backend differs.

Task Scheduler can't express every cron, so the SchedulePicker's common set is
translated and anything else returns a clear error
([`src/lib/cron-to-schtasks.ts`](../src/lib/cron-to-schtasks.ts)):

| Cron form | Example | Windows result |
|-----------|---------|----------------|
| Every N minutes | `*/15 * * * *` | ✅ `/SC MINUTE /MO 15` |
| Every N hours (at minute M) | `5 */2 * * *` | ✅ `/SC HOURLY /MO 2 /ST 00:05` |
| Hourly at minute M | `30 * * * *` | ✅ `/SC HOURLY /MO 1 /ST 00:30` |
| Daily at H:M | `0 3 * * *` | ✅ `/SC DAILY /ST 03:00` |
| Weekly on weekday(s) | `0 9 * * 1,3,5` | ✅ `/SC WEEKLY /D MON,WED,FRI /ST 09:00` |
| Monthly on day-of-month | `0 2 15 * *` | ✅ `/SC MONTHLY /D 15 /ST 02:00` |
| Minute/hour **ranges or lists** | `0 9-17 * * *` | ❌ clear error |
| Day-of-month **and** weekday | `0 2 1 * 1` | ❌ clear error |
| Specific **month** | `0 2 1 6 *` | ❌ clear error |

When unsupported, the schedule is rejected with guidance ("Use a daily, weekly,
or monthly time, or 'every N minutes/hours'") rather than silently mis-scheduling.

## Bundled host scripts

The bundled hardware scripts are cross-platform Node (`.mjs`) so the default
Scripts experience needs no bash on Windows: `ps-db-backup.mjs`,
`ps-health-check.mjs`, `ps-log-rotate.mjs`, `ps-disk-report.mjs`,
`ps-system-report.mjs`. `ps-db-backup.mjs` uses the `sqlite3` CLI `.backup` when
present (a consistent online copy) and falls back to a plain file copy. The
legacy `.sh` versions stay for existing Unix schedules; `ps-backup.sh` (Hindsight)
is Linux-only and is hidden from the Windows presets.

## CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) gates cross-platform
support: `build-test-ubuntu`, `build-test-macos`, and `build-test-windows` each
run lint + `tsc` + the full unit suite + production build, and a `boot-smoke`
matrix (`ubuntu` · `macos` · `windows`) runs
[`tests/scripts/boot-smoke.mjs`](../tests/scripts/boot-smoke.mjs), which exercises
the OS-seam primitives (detached-spawn survival, port probing, process kill) plus
a bundled `.mjs` on each OS. Docker, e2e (Playwright), and real-Hermes jobs remain
Linux-only.

## Troubleshooting (Windows)

- **`running scripts is disabled on this system`** — run via
  `powershell -ExecutionPolicy Bypass -File install.ps1` (the flag applies to that
  session only); `setup.mjs` itself is plain `node` and needs no policy change.
- **`sqlite3` not found** — optional. `ps-db-backup.mjs` falls back to a file
  copy; install the SQLite CLI for a consistent online `.backup`.
- **A scheduled task didn't appear** — check Task Scheduler under the
  `PatterStage\` folder; the human cron is mirrored in
  `%PS_DATA_DIR%\.schtasks-cron.json`.
- **SmartScreen / antivirus** — PatterStage only invokes the built-in signed
  tools `taskkill` and `schtasks`; no third-party helpers are downloaded.
