# Documentation index

Technical reference for PatterStage. Tone elsewhere in this folder is deliberately plain—I maintain the project solo and would rather you get accurate answers than corporate filler.

| Document | Description |
|----------|-------------|
| [CONTROL_HUB.md](CONTROL_HUB.md) | What this repo is and where to read next |
| [USER_WALKTHROUGH_GUIDE.md](USER_WALKTHROUGH_GUIDE.md) | Operator guide: every sidebar page, every common action (dashboard, missions + scheduling, scripts, chat, agents + performance, skills, tools, personalities, sessions, memory, logs, all Config pages, Story Weaver) |
| [MISSIONS.md](MISSIONS.md) | Mission board, dispatch, cancellation, templates |
| [CHAT.md](CHAT.md) | Agent chat: server-persisted conversations, run-event streaming, tools + HITL approvals, Agent/Fast modes |
| [design-tokens.md](design-tokens.md) | UI colour tokens and theme conventions |
| [API.md](API.md) | REST endpoints |
| [ANALYTICS.md](ANALYTICS.md) | Interaction event log, `/api/analytics`, achievements, and the Insights page |
| [CATALOG_AND_PROFILES.md](CATALOG_AND_PROFILES.md) | Seed pack, SQLite catalog, Hermes profile sync |
| [TOOLS_AND_MISSIONS.md](TOOLS_AND_MISSIONS.md) | Profile `platform_toolsets`, Tools UI, mission tool hints |
| [ENV_REFERENCE.md](ENV_REFERENCE.md) | Environment variables, dual DB paths, install flags |
| [DEPLOY.md](DEPLOY.md) | Deploy, **`ch-deploy`**, TLS, Docker, ports, scripts layout |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development workflow and standards |
| [TESTING.md](TESTING.md) | Jest, Playwright, CI, and navigation-matrix upkeep |
| [SYSTEM-CRON.md](SYSTEM-CRON.md) | Scripts page + host cron presets (`scripts/hardware/`), including Hindsight backup |
| [SUPPORT.md](SUPPORT.md) | Where to get help; upstream vs this repo |
| [SECURITY.md](SECURITY.md) | Vulnerability reporting |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | How collaboration works here (people-wise) |
| [MIGRATION.md](MIGRATION.md) | Migrations, backups, and the runtime upgrade path for existing installs |
| [HERMES_CONFIG_INTEGRATION.md](HERMES_CONFIG_INTEGRATION.md) | Hermes `config.yaml` integration |
| [PLATFORM_VISION.md](PLATFORM_VISION.md) | Architecture and product direction |
| [Pull request template](../.github/pull_request_template.md) | PR checklist (GitHub prefill) |
## Mission and template schemas

Versioned Zod schemas live under [`src/lib/schema/`](../src/lib/schema/). JSON Schema mirrors live in `src/lib/schema/json/`. Maintainer notes:

- [SCHEMA_VERSIONING.md](schema/SCHEMA_VERSIONING.md) — versioning and bump policy
- [CHANGELOG.md](schema/CHANGELOG.md) — schema contract history

After changing Zod definitions, regenerate JSON from the repo root (runs [`scripts/tooling/generate-json-schema.ts`](../scripts/tooling/generate-json-schema.ts) via npm):

```bash
npm run generate:schema-json
```

## Scripts and deploy

- **`scripts/bootstrap/`** — install, setup, stop, Hindsight bootstrap.
- **`scripts/application/ch-deploy.sh`** — unified **`update`** / **`restart`** / **`rebuild`** for CLI and **`POST /api/update`** (backs up + migrates the DB on update/rebuild).
- **`scripts/maintenance/ch-migrate.sh`** — backup + full DB migration (schema + legacy data); interactive, `--yes` to skip prompts.
- **`scripts/tooling/`** — DB migrate (`migrate-db.ts` → `runMigrations`), runtime data migration, agent discovery, JSON Schema emit.
- **`scripts/lib/`** (shared bash incl. `ch-log.sh` logging/prompt helpers + `ch-migrate.sh`), **`scripts/hardware/`** (host cron presets), **`data/seed/`** (catalog).

Details: **[DEPLOY.md](DEPLOY.md)**.
