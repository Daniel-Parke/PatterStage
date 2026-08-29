---
summary: Index of the technical documentation for PatterStage, one row per document
type: index
tags: [product, docs]
compiled_from: normalised
---

# Documentation index

Technical reference for PatterStage. Tone elsewhere in this folder is deliberately plain: I maintain the project solo and would rather you get accurate answers than corporate filler.

| Document | Description |
|----------|-------------|
| [adr/](adr/) | **Decisions, pointer.** The ADRs live in `org/decisions/`; this page forwards to them. A recorded decision wins over anything you infer from the code |
| [REPO_GUIDE.md](REPO_GUIDE.md) | Repo layout, conventions, shared utilities, design tokens, deploy |
| [PATTERSTAGE.md](PATTERSTAGE.md) | What this repo is and where to read next |
| [USER_WALKTHROUGH_GUIDE.md](USER_WALKTHROUGH_GUIDE.md) | Operator guide: every sidebar page, every common action (dashboard, missions + scheduling, scripts, chat, agents + performance, skills, tools, personalities, sessions, memory, logs, all Config pages, Story Weaver) |
| [MISSIONS.md](MISSIONS.md) | Mission board, dispatch, cancellation, templates (simple single/recurring runs) |
| [COMPOSER.md](COMPOSER.md) | Composer: the graph orchestrator for multi-stage workflows with loops + HIL gates |
| [LABORATORY.md](LABORATORY.md) | Laboratory section: Insights, Deep Research, Artifacts |
| [DEEP_RESEARCH.md](DEEP_RESEARCH.md) | Native iterative web research (provider-flexible, free/local-first search) |
| [CHAT.md](CHAT.md) | Agent chat: server-persisted conversations, run-event streaming, tools + HITL approvals, Agent/Fast modes |
| [MEMORY.md](MEMORY.md) | Agent long-term memory (Hindsight): how it connects, the mock, Docker + native setup |
| [design-tokens.md](design-tokens.md) | UI colour tokens and theme conventions |
| [API.md](API.md) | REST endpoints |
| [ANALYTICS.md](ANALYTICS.md) | Interaction event log, `/api/analytics`, achievements, and the Insights page |
| [SPEND.md](SPEND.md) | Provider spend: how it is estimated, the optional budget, and the hard stop that ships off |
| [CATALOG_AND_PROFILES.md](CATALOG_AND_PROFILES.md) | Seed pack, SQLite catalog, Hermes profile sync |
| [TOOLS_AND_MISSIONS.md](TOOLS_AND_MISSIONS.md) | Profile `platform_toolsets`, Tools UI, mission tool hints |
| [ENV_REFERENCE.md](ENV_REFERENCE.md) | Environment variables, dual DB paths, install flags |
| [DEPLOY.md](DEPLOY.md) | Deploy, **`ps-deploy`**, TLS, Docker, ports, scripts layout |
| [CROSS_PLATFORM.md](CROSS_PLATFORM.md) | Windows · macOS · Linux: support matrix, Windows install/update, host scheduling (cron vs Task Scheduler), bundled `.mjs` scripts |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development workflow and standards |
| [TESTING.md](TESTING.md) | Jest, Playwright, CI, and navigation-matrix upkeep |
| [OUTPUT_CANARY.md](OUTPUT_CANARY.md) | The output canary: what it hashes, proving a move neutral, re-blessing the golden |
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

- [SCHEMA_VERSIONING.md](schema/SCHEMA_VERSIONING.md): versioning and bump policy
- [CHANGELOG.md](schema/CHANGELOG.md): schema contract history

After changing Zod definitions, regenerate JSON from the repo root (runs [`scripts/tooling/generate-json-schema.ts`](../scripts/tooling/generate-json-schema.ts) via npm):

```bash
npm run generate:schema-json
```

## Scripts and deploy

- **`scripts/bootstrap/`**: install, setup, stop, Hindsight bootstrap.
- **`scripts/application/ps-deploy.sh`**: unified **`update`** / **`restart`** / **`rebuild`** for CLI and **`POST /api/update`** (backs up + migrates the DB on update/rebuild).
- **`scripts/maintenance/ps-migrate.sh`**: backup + full DB migration (schema + legacy data); interactive, `--yes` to skip prompts.
- **`scripts/tooling/`**: DB migrate (`migrate-db.ts` → `runMigrations`), runtime data migration, agent discovery, JSON Schema emit.
- **`scripts/lib/`** (shared bash incl. `ps-log.sh` logging/prompt helpers + `ps-migrate.sh`), **`scripts/hardware/`** (host cron presets), **`data/seed/`** (catalog).

Details: **[DEPLOY.md](DEPLOY.md)**.
