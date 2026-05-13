# hermes-config repository integration

The separate **`hermes-config`** repository (operator-specific automation and dotfiles) is **not vendored inside Control Hub**. When that repo is present on a machine, use this checklist so paths stay consistent with Control Hub and Hermes.

## Environment variables

| Variable | Role |
|----------|------|
| `HERMES_HOME` / `AGENT_HOME` | Hermes install root used to **seed** `agents-registry.json` when it is first created; also used when resolving defaults. Control Hub’s **active** Hermes tree for APIs/UI comes from the registry entry selected in the app (see [CONTROL_HUB.md](CONTROL_HUB.md)). |
| `CH_DATA_DIR` / `CONTROL_HUB_DATA_DIR` | Control Hub data root (default `~/control-hub/data`). Holds missions, templates, SQLite, and hardware-cron defaults unless overridden. Mission files must live here for nested Hermes `mark_job_run` updates. |

## What to verify in hermes-config scripts

1. **No hard-coded `~/.hermes/control-hub/data`** unless you intentionally set `CH_DATA_DIR` to that path (legacy layout).

2. **Backup/sync jobs** should include `~/control-hub/data` (or your explicit `CH_DATA_DIR`) alongside the local Hermes install root (`~/.hermes` or `HERMES_HOME`).

3. **CI or deploy hooks** that invoke `curl` against Control Hub should target the real host/port; add signature headers if you configure `CH_REQUEST_SIGNING_SECRET`.

4. **Config and behaviour files** that Hermes reads from disk must exist at the local Hermes install root configured via `HERMES_HOME`.

## Control Hub scripts in this repo

| Script | Notes |
|--------|-------|
| `scripts/bootstrap/setup.sh` | Creates `CH_DATA_DIR` directories (default `~/control-hub/data`). |
| `scripts/bootstrap/backup-hermes-config.sh` | Backs up `CH_DATA_DIR` when present, else legacy `HERMES_HOME/control-hub/data`. |

When you add or clone `hermes-config`, inventory its shell scripts and align any data paths with the table above.
