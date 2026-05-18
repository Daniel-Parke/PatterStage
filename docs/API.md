# API Reference

All API routes return the envelope:

```typescript
{ data?: T; error?: string }
```

All error handlers must call `logApiError(route, context, error)` from `@/lib/api-logger`.

## Route Inventory

| Route | Methods | Purpose |
|---|---|---|
| `/api/agent/profiles` | `GET`, `POST`, `PUT`, `DELETE` | Hermes profile management. |
| `/api/agent/files` | `GET` | List agent behavior files. |
| `/api/agent/files/[key]` | `GET`, `PUT` | Read/update one behavior file. |
| `/api/agent/personality` | `PUT` | Update selected personality config. |
| `/api/agent/profiles` | `GET` | List available Hermes profiles. |
| `/api/agents` | `GET` | Inspect running Hermes agent processes (implementation uses host process listing; behaviour differs by OS). |
| `/api/config` | `GET`, `PUT` | Read/update parsed config content. |
| `/api/models` | `GET`, `POST` | Models registry (SQLite); list / create. |
| `/api/models/[id]` | `GET`, `PUT`, `DELETE` | One model row. |
| `/api/models/defaults` | `GET`, `PUT` | Default model per task slot (`agent`, `hindsight`, …). |
| `/api/credentials` | `GET`, `POST` | API key credentials (masked list). |
| `/api/credentials/[id]` | `GET`, `PUT`, `DELETE` | One credential. |
| `/api/cron` | `GET`, `POST`, `PUT`, `DELETE` | Manage **agent** cron jobs (Hermes `jobs.json` for the active install). |
| `/api/cron/hardware` | `GET`, `POST`, `PUT`, `DELETE` | **System** cron (system crontab): scripts/logs under `CH_SCRIPTS_DIR` / `CH_HARDWARE_LOG_DIR`; separate from agent `jobs.json`. |
| `/api/cron/hardware/meta` | `GET` | `{ scriptsDir, logDir }` from [`getChScriptsDir()`](../src/lib/paths.ts) / [`getChHardwareLogDir()`](../src/lib/paths.ts). The System Cron UI builds script paths only from `scriptsDir`. |
| `/api/gateway` | `GET` | Read gateway/platform status. |
| `/api/logs` | `GET` | Read recent Hermes logs. |
| `/api/memory` | `GET`, `POST`, `PUT`, `DELETE` | Manage holographic memory facts. |
| `/api/memory/hindsight` | `GET`, `POST` | Query/retain hindsight memory records. |
| `/api/missions` | `GET`, `POST` | List and dispatch missions. |
| `/api/missions/health` | `GET` | Mission subsystem health view. |
| `/api/monitor` | `GET` | Aggregated system monitoring snapshot. |
| `/api/personalities` | `GET`, `POST`, `PUT`, `DELETE` | Manage personality records. |
| `/api/profiles` | `GET`, `POST` | List and create Control Hub profiles. |
| `/api/sessions` | `GET` | List sessions with filters. |
| `/api/sessions/[id]` | `GET` | Read one session transcript. |
| `/api/skills` | `GET` | List skills inventory. |
| `/api/skills/[name]` | `GET` | Read one skill document. |
| `/api/skills/[name]/toggle` | `PUT` | Enable/disable a skill for a profile. |
| `/api/skills/[...path]` | `GET` | Read files under a skill tree. |
| `/api/status` | `GET` | Basic readiness endpoint. |
| `/api/stories` | `POST` | Create/update Story Weaver data. |
| `/api/teams` | `GET`, `POST`, `PUT`, `DELETE` | Manage teams. |
| `/api/templates` | `GET`, `POST` | List and create mission templates. |
| `/api/tools` | `GET`, `PUT` | Read/update toolset configuration. |
| `/api/update` | `GET`, `POST` | Check release status (`?branch=`, `?branches=1`). `POST` body: `action` = `restart` \| `rebuild` \| `update`; optional `branch` for `rebuild` and `update`. Spawns `scripts/application/ch-deploy.sh` in the background. |

## System cron notes

Managed crontab lines must run a script **under** `scriptsDir` (default `CH_DATA_DIR/scripts`). `POST`/`PUT` reject any other command path. Preset scripts ship in repo **`scripts/hardware/`**; **`scripts/bootstrap/setup.sh`** copies any missing `*.sh` into `CH_DATA_DIR/scripts` during setup. Older crontab lines pointing elsewhere are ignored until edited or removed. See **[SYSTEM-CRON.md](SYSTEM-CRON.md)** for preset behaviour (including **`ch-backup.sh`** Hindsight snapshots via `hindsight_bridge.py`).

## Auth and Safety Notes

- **`CH_READ_ONLY`** blocks writes (503) when enabled.
- Deploy actions (`/api/update` `POST`) are gated by `CH_ENABLE_DEPLOY_API`.
- Signed request support can be enabled with `CH_REQUEST_SIGNING_SECRET`.
- Correlation IDs are accepted via `x-correlation-id` or `x-request-id`.
