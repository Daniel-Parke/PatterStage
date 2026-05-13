# Documentation index

| Document | Description |
|----------|-------------|
| [CONTROL_HUB.md](CONTROL_HUB.md) | What this repo is and where to read next |
| [API.md](API.md) | REST endpoints |
| [DEPLOY.md](DEPLOY.md) | Deploy, **`ch-deploy`**, TLS, Docker, ports, scripts layout |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development workflow and standards |
| [TESTING.md](TESTING.md) | Jest, Playwright, CI, and navigation-matrix upkeep |
| [HARDWARE-CRON.md](HARDWARE-CRON.md) | Hardware cron presets (`scripts/hardware/`), including Hindsight backup |
| [SUPPORT.md](SUPPORT.md) | Where to get help; upstream vs this repo |
| [SECURITY.md](SECURITY.md) | Vulnerability reporting |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Community standards |
| [MIGRATION.md](MIGRATION.md) | Data directory and migrations |
| [HERMES_CONFIG_INTEGRATION.md](HERMES_CONFIG_INTEGRATION.md) | Hermes `config.yaml` integration |
| [PLATFORM_VISION.md](PLATFORM_VISION.md) | Architecture and product direction |
| [Pull request template](../.github/pull_request_template.md) | PR checklist (GitHub prefill) |
| [internal/README.md](internal/README.md) | Internal / scratch notes |

## Mission and template schemas

Versioned Zod schemas live under [`src/lib/schema/`](../src/lib/schema/). JSON Schema mirrors live in `src/lib/schema/json/`. Maintainer notes:

- [SCHEMA_VERSIONING.md](schema/SCHEMA_VERSIONING.md) — versioning and bump policy
- [CHANGELOG.md](schema/CHANGELOG.md) — schema contract history

After changing Zod definitions, regenerate JSON from the repo root (runs [`scripts/tooling/generate-json-schema.ts`](../scripts/tooling/generate-json-schema.ts) via npm):

```bash
npm run generate:schema-json
```

## Scripts and deploy

- **`scripts/bootstrap/`** — install, setup, stop, backup, Hindsight bootstrap.
- **`scripts/application/ch-deploy.sh`** — unified **`update`** / **`restart`** / **`rebuild`** for CLI and **`POST /api/update`**.
- **`scripts/tooling/`** — DB prep, agent discovery, JSON Schema emit (`npm run prebuild`, `discover-hermes`, `generate:schema-json`).
- **`scripts/lib/`**, **`scripts/hardware/`**, **`scripts/bundled-profiles/`** — shared bash, hardware cron presets, Hermes templates.

Details: **[DEPLOY.md](DEPLOY.md)**.
