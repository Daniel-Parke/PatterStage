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
| [RUNTIME_ARCHITECTURE.md](RUNTIME_ARCHITECTURE.md) | How a dispatch becomes a run: the runtime adapter, the scheduler, and who owns "when" |
| [DATA_STORAGE.md](DATA_STORAGE.md) | What is stored where: SQLite tables, the data directory, and what is on disk vs in the DB |
| [QA_NOTES.md](QA_NOTES.md) | **Read this before a QA pass.** Known-deliberate behaviour, so a tester does not re-file it as a bug |
| [UX_AUDIT.md](UX_AUDIT.md) | A point-in-time UI/UX audit and its findings |
| [Pull request template](../.github/pull_request_template.md) | PR checklist (GitHub prefill) |
## Governance (EOS)

These are compiled seed artefacts of the PatterTech EOS, not product documentation.
Their **paths are set by an external scale matrix** (`PatterTech_EOS/kernel/SCALE_MATRIX.md`)
and rewritten by `scripts/tooling/eos-compile.mjs` on every compile, so they cannot be
moved or renamed from this repo. They are listed here so the corpus is reachable in one
hop, not because a reader of the product docs needs them. The human's door into this
layer is [OPERATORS_GUIDE.md](../OPERATORS_GUIDE.md); an agent's is [org/START.md](../org/START.md).

| Document | Description |
|----------|-------------|
| [LOCKBOOK.md](LOCKBOOK.md) | The stack decision and its ratchets; load-bearing, cited by several live docs |
| [RULINGS.json](RULINGS.json) | Recorded rulings, machine-readable |
| [VENTURE_BRIEF.md](VENTURE_BRIEF.md) | What this venture is for |
| [ACCEPTANCE_SPINE.md](ACCEPTANCE_SPINE.md) | The acceptance spine the seed was compiled against |
| [PRODUCT_MAP.md](PRODUCT_MAP.md) | **A blank form until Genesis runs**, as it says of itself. Not an oversight; not yet filled in |
| [COMPILE_REPORT.md](COMPILE_REPORT.md) | Provenance record proving what the seed compiled from. Contains no links; it is a manifest, not an index |
| [EOS_FEEDBACK.md](EOS_FEEDBACK.md) | Append-only channel back to the EOS pack. Friction found in the tooling itself |
| [genesis/](genesis/) | Genesis form templates (`LENS`, `RESEARCH_PACKET`, `WORK_PACKAGE`); their paths are placeholders by design |

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
