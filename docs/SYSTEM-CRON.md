# System cron presets

Control Hub ships POSIX shell stubs under [`scripts/hardware/`](../scripts/hardware/). During [`scripts/bootstrap/setup.sh`](../scripts/bootstrap/setup.sh), any missing `*.sh` files are copied into **`CH_DATA_DIR/scripts`** (see [`getChScriptsDir()`](../src/lib/paths.ts)). The **Cron** page → **System** tab registers jobs in the **system crontab**; each line must invoke a script under that directory (validated by [`POST /api/cron/hardware`](../src/app/api/cron/hardware/route.ts)).

Preset labels and filenames are defined in [`src/lib/hardware-cron.ts`](../src/lib/hardware-cron.ts) (`HARDWARE_CRON_UI_PRESETS`). Log output defaults to **`CH_HARDWARE_LOG_DIR`** (`CH_DATA_DIR/logs`).

| Preset | File | Purpose |
|--------|------|---------|
| Watchdog | `ch-watchdog.sh` | Placeholder for host watchdog checks. |
| System Monitor | `ch-sysmon.sh` | Placeholder for system metrics. |
| Backup | `ch-backup.sh` | **Hindsight snapshot** — runs [`hindsight_bridge.py`](https://github.com/NousResearch/hermes-agent/blob/main/scripts/hindsight_bridge.py) `list`, `directives`, and `mental-models`, merges JSON with **`jq`**, writes under `HINDSIGHT_BACKUP_DIR`, rotates by age. Requires a running Hindsight HTTP server (see Hermes [Memory / Hindsight](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory)). |
| Health Check | `ch-health.sh` | Placeholder for service health. |
| Log Rotate | `ch-logrotate.sh` | Placeholder for log rotation. |
| Network Monitor | `ch-netmon.sh` | Placeholder for network checks. |

## `ch-backup.sh` environment

| Variable | Default | Description |
|----------|---------|-------------|
| `HERMES_HOME` | `$HOME/.hermes` | Hermes install root; must contain `scripts/hindsight_bridge.py` and `hermes-agent/` for `PYTHONPATH`. |
| `HINDSIGHT_BACKUP_DIR` | `$HERMES_HOME/backups/hindsight` | Output directory for `\<bank\>-\<timestamp\>.json` files. |
| `HINDSIGHT_BACKUP_BANK` | `hermes` | Hindsight bank name passed to `--bank`. |
| `HINDSIGHT_BACKUP_RETENTION_DAYS` | `30` | `find -mtime` rotation; files older than this many days are deleted. |
| `HINDSIGHT_BACKUP_LIMIT` | `999999` | `--limit` for `list` (full bank dump for typical sizes). |
| `HINDSIGHT_API_KEY` | (optional) | If unset, `llm_api_key` is read from `$HERMES_HOME/hindsight/config.json` when present (same idea as [`/api/memory/hindsight`](../src/app/api/memory/hindsight/route.ts)). |

**Dependencies:** `bash`, `jq`, and `python3` (prefers `$HERMES_HOME/hermes-agent/venv/bin/python3` when executable).

**Suggested schedule:** `0 1 * * *` (daily 01:00) with stderr appended to a file under `CH_HARDWARE_LOG_DIR`, matching the pattern enforced by the System Cron UI.
