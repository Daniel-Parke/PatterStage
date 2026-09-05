---
title: Host scheduling
summary: The host-level cron scripts PatterStage ships, the Hindsight backup in detail, and how the Scripts page registers jobs
section: running
nav: 60
audience: operator
concepts: [schedule]
type: reference
tags: [product, ops]
compiled_from: normalised
---
# System cron: Hindsight backup

PatterStage's host-level cron scripts live in `scripts/hardware/`. During [`scripts/bootstrap/setup.sh`](../../scripts/bootstrap/setup.sh) (or its Node twin `setup.mjs`), **every** `.sh` and `.mjs` in that directory is copied into **`PS_DATA_DIR/scripts`** when no file of that name is there yet (see [`getPsScriptsDir()`](../../src/lib/paths.ts)). That is `ps-backup.sh`, an `.sh`/`.mjs` pair each for DB backup, disk report, health check, log rotate and system report, the `reconnect-hindsight.sh` recovery helper, and six pre-rename `ch-*.sh` shims. Register jobs from the **Work → Scripts** page; each crontab line must invoke a script under that directory ([`POST /api/cron/hardware`](../../src/app/api/cron/hardware/route.ts)).

This page documents **`ps-backup.sh`** (the Hindsight snapshot) in detail. For the rest, and for which version of a pair to schedule, see [CROSS_PLATFORM.md](cross-platform.md).

What the Scripts page lists is not a curated preset list: it is every file with a runnable extension found in the scripts directory, via `listScriptFiles()` in [`src/lib/scripts-manager.ts`](../../src/lib/scripts-manager.ts). The gallery's starter cards are in [`src/components/scripts/script-templates.ts`](../../src/components/scripts/script-templates.ts): two cross-platform `.mjs` starters first, then the three bash skeletons. `HARDWARE_CRON_UI_PRESETS` in [`src/lib/hardware-cron.ts`](../../src/lib/hardware-cron.ts) is **not** wired to any surface: only unit tests import it, so editing it changes nothing a user sees. Log output defaults to **`PS_HARDWARE_LOG_DIR`** (`PS_DATA_DIR/logs`).

> **Platforms:** the host backend is the user `crontab`
> ([`src/lib/host-scheduler.ts`](../../src/lib/host-scheduler.ts)), on Linux and
> macOS. There is **no** native-Windows Task Scheduler backend: the `schtasks`
> path an earlier version of this page described was dropped with the rest of
> the native-Windows operational layer, and no translation table exists. Where
> there is no host scheduler, the Schedule button writes a PatterStage
> `schedules` row (`kind = 'script'`) and PatterStage's own timer runs it while
> PatterStage is up; the row says so. WSL2 (Ubuntu) still gives you the Linux
> path and its stronger guarantee. `ps-backup.sh` needs bash and a running
> Hindsight server, so it is Unix-only rather than Linux-only: macOS is fine.
> See [CROSS_PLATFORM.md](cross-platform.md).

| Script | File | Purpose |
|--------|------|---------|
| Hindsight backup | `ps-backup.sh` | Hindsight snapshot via [`hindsight_bridge.py`](https://github.com/NousResearch/hermes-agent/blob/main/scripts/hindsight_bridge.py) (`list`, `directives`, `mental-models`), merged with **`jq`**, written under `HINDSIGHT_BACKUP_DIR`, rotated by age. Requires a running Hindsight HTTP server ([Hermes Memory / Hindsight](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory)). |

## `ps-backup.sh` environment

| Variable | Default | Description |
|----------|---------|-------------|
| `HERMES_HOME` | `$HOME/.hermes` | Hermes install root; must contain `scripts/hindsight_bridge.py` and `hermes-agent/` for `PYTHONPATH`. |
| `HINDSIGHT_BACKUP_DIR` | `$HERMES_HOME/backups/hindsight` | Output directory for `<bank>-<timestamp>.json` files. |
| `HINDSIGHT_BACKUP_BANK` | `hermes` | Hindsight bank name passed to `--bank`. |
| `HINDSIGHT_BACKUP_RETENTION_DAYS` | `30` | `find -mtime` rotation. |
| `HINDSIGHT_BACKUP_LIMIT` | `999999` | `--limit` for `list`. |
| `HINDSIGHT_API_KEY` | (optional) | If unset, `llm_api_key` from `$HERMES_HOME/hindsight/config.json` when present. |

**Dependencies:** `bash`, `jq`, and Hermes venv Python at `$HERMES_HOME/hermes-agent/venv/bin/python3` (or `.venv`).

**Suggested schedule:** `0 1 * * *` (daily 01:00) with stdout and stderr appended under `PS_HARDWARE_LOG_DIR`:

```cron
0 1 * * * $HOME/patterstage/data/scripts/ps-backup.sh >> $HOME/patterstage/data/logs/ps-backup.log 2>&1
```

Replace paths with your `PS_DATA_DIR` if set. The script reads only the six variables in the table above, so do not bother prefixing others: an earlier version of this example set `LOG_DIR=…`, which `ps-backup.sh` never reads (that variable belongs to `ps-log-rotate`), and the `>> …log 2>&1` redirect is what actually places the output.

Scheduling through the UI rather than by hand is stricter still. `canonicaliseScriptsCommand()` in [`src/lib/hardware-cron-handlers/crontab-command.ts`](../../src/lib/hardware-cron-handlers/crontab-command.ts) takes **only the script's basename** out of what you submit, resolves it under the scripts directory, and rebuilds the command from the interpreter map. Any env prefix, path or extra argument you paste alongside it is discarded, not approved. The `>> …log 2>&1` suffix is then appended when the line is written ([`crontab-store.ts`](../../src/lib/hardware-cron-handlers/crontab-store.ts)), from a log name constrained to a plain `*.log` basename inside `PS_HARDWARE_LOG_DIR`.
