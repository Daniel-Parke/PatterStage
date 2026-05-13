# Control Hub — this repository

Control Hub is a **Next.js web application**: a command-centre UI for [Hermes Agent](https://github.com/NousResearch/hermes-agent). It ships as a single codebase—dashboard, missions, cron, sessions, memory tools, and REST APIs under `src/app/api/`.

## Where to read next

| Topic | Doc |
|--------|-----|
| Run in production, TLS, Docker | [DEPLOY.md](DEPLOY.md) |
| REST API shapes | [API.md](API.md) |
| Data directory and upgrades | [MIGRATION.md](MIGRATION.md) |
| Hermes `config.yaml` checklist | [HERMES_CONFIG_INTEGRATION.md](HERMES_CONFIG_INTEGRATION.md) |
| Design direction | [PLATFORM_VISION.md](PLATFORM_VISION.md) |
| Contributing | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Testing (Jest + Playwright) | [TESTING.md](TESTING.md) |
| Schema / mission & template types | [schema/SCHEMA_VERSIONING.md](schema/SCHEMA_VERSIONING.md) and [schema/CHANGELOG.md](schema/CHANGELOG.md) (`src/lib/schema/`) |

Control Hub data lives under **`CH_DATA_DIR`** (`src/lib/paths.ts`). The local Hermes install is resolved from **`HERMES_HOME`** / **`AGENT_HOME`** (default `~/.hermes`) via `getActiveHermesPaths()` / `getActiveHermesHome()` in `src/lib/hermes-agent-runtime.ts`. Hardware cron uses **`CH_SCRIPTS_DIR`** / **`CH_HARDWARE_LOG_DIR`** (defaults under `CH_DATA_DIR`). Bootstrap and deploy shells live under **`scripts/`** (`bootstrap/`, `application/ch-deploy.sh`, `tooling/`, …) — see **[DEPLOY.md](DEPLOY.md)**.

**Browser E2E:** Playwright specs under `tests/e2e/` include a navigation matrix aligned with the sidebar (`tests/e2e/app-routes.ts`—keep in sync when `src/components/layout/sidebar-config.ts` changes). See [TESTING.md](TESTING.md).
