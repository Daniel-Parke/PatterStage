---
summary: The one host-level cron script PatterStage ships, and how the Scripts page registers jobs
type: reference
tags: [product, ops]
compiled_from: normalised
---

# System cron: Hindsight backup

PatterStage ships one host-level cron script: **`ps-backup.sh`** (Hindsight snapshot). During [`scripts/bootstrap/setup.sh`](../scripts/bootstrap/setup.sh), the script is copied into **`PS_DATA_DIR/scripts`** when missing (see [`getPsScriptsDir()`](../src/lib/paths.ts)). Register jobs from the **Orchestration → Scripts** page; each crontab line must invoke a script under that directory ([`POST /api/cron/hardware`](../src/app/api/cron/hardware/route.ts)).

Preset label and filename: [`src/lib/hardware-cron.ts`](../src/lib/hardware-cron.ts) (`HARDWARE_CRON_UI_PRESETS`). Log output defaults to **`PS_HARDWARE_LOG_DIR`** (`PS_DATA_DIR/logs`).

> **Cross-platform:** the Scripts page works on Windows too. Schedules go to **Task Scheduler** (`schtasks`) instead of `crontab`, and the bundled scripts are cross-platform Node (`.mjs`: `ps-db-backup`, `ps-health-check`, `ps-log-rotate`, `ps-disk-report`, `ps-system-report`). `ps-backup.sh` (Hindsight, below) is **Linux-only** and hidden from the Windows presets. See [CROSS_PLATFORM.md](CROSS_PLATFORM.md) for the cron → `schtasks` translation table and which schedules are supported on Windows.

| Preset | File | Purpose |
|--------|------|---------|
| Backup | `ps-backup.sh` | Hindsight snapshot via [`hindsight_bridge.py`](https://github.com/NousResearch/hermes-agent/blob/main/scripts/hindsight_bridge.py) (`list`, `directives`, `mental-models`), merged with **`jq`**, written under `HINDSIGHT_BACKUP_DIR`, rotated by age. Requires a running Hindsight HTTP server ([Hermes Memory / Hindsight](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory)). |

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

**Suggested schedule:** `0 1 * * *` (daily 01:00) with stderr appended under `PS_HARDWARE_LOG_DIR`:

```cron
0 1 * * * LOG_DIR=$HOME/patterstage/data/logs $HOME/patterstage/data/scripts/ps-backup.sh >> $HOME/patterstage/data/logs/ps-backup.log 2>&1
```

Replace paths with your `PS_DATA_DIR` if set. The System Cron UI builds the same `>> …log 2>&1` suffix.
