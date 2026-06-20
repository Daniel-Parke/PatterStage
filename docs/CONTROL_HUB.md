# PatterStage — this repository

PatterStage is the **Next.js control plane** in this repo: a command-centre UI for [Hermes Agent](https://github.com/NousResearch/hermes-agent). One codebase—dashboard analytics, missions + scheduling, host scripts, sessions, memory tools, model registry, and REST APIs under `src/app/api/`. Agent execution is handed to Hermes over its HTTP API Server through a single runtime adapter (`src/lib/runtime/`); the PatterStage-owned scheduler (`src/lib/orchestration/`) owns "when does this run". If you want screenshots and "what do I click?", start with [USER_WALKTHROUGH_GUIDE.md](USER_WALKTHROUGH_GUIDE.md); this page is the map of technical docs.

## Where to read next

| Topic | Doc |
|--------|-----|
| Environment variables | [ENV_REFERENCE.md](ENV_REFERENCE.md) |
| Run in production, TLS, Docker | [DEPLOY.md](DEPLOY.md) |
| Professional catalog (profiles + templates) | [CATALOG_AND_PROFILES.md](CATALOG_AND_PROFILES.md) · Config → Seed (`/config/seed`) |
| Missions (dispatch, cancel, templates) | [MISSIONS.md](MISSIONS.md) |
| UI design tokens | [design-tokens.md](design-tokens.md) |
| REST API shapes | [API.md](API.md) |
| Data directory and upgrades | [MIGRATION.md](MIGRATION.md) |
| Hermes `config.yaml` checklist | [HERMES_CONFIG_INTEGRATION.md](HERMES_CONFIG_INTEGRATION.md) |
| Design direction | [PLATFORM_VISION.md](PLATFORM_VISION.md) |
| Contributing | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Testing (Jest + Playwright) | [TESTING.md](TESTING.md) |
| Schema / mission & template types | [schema/SCHEMA_VERSIONING.md](schema/SCHEMA_VERSIONING.md) and [schema/CHANGELOG.md](schema/CHANGELOG.md) (`src/lib/schema/`) |

PatterStage data lives under **`CH_DATA_DIR`** (`src/lib/paths.ts`). The local Hermes install is resolved from **`HERMES_HOME`** / **`AGENT_HOME`** (default `~/.hermes`) via `getActiveHermesPaths()` / `getActiveHermesHome()` in `src/lib/hermes-agent-runtime.ts`. System cron uses **`CH_SCRIPTS_DIR`** / **`CH_HARDWARE_LOG_DIR`** (defaults under `CH_DATA_DIR`). Bootstrap and deploy shells live under **`scripts/`** (`bootstrap/`, `application/ch-deploy.sh`, `tooling/`, …) — see **[DEPLOY.md](DEPLOY.md)**.

**Browser E2E:** Playwright specs under `tests/e2e/` include a navigation matrix aligned with the sidebar (`tests/e2e/app-routes.ts`—keep in sync when `src/components/layout/sidebar-config.ts` changes). See [TESTING.md](TESTING.md).
