# Testing

I expect PRs to pass the same checks CI runs. This page is the map of Jest, Playwright, shell harnesses, and the gotchas that wasted my time once already.

## Layout

| Path | Runner | Role |
|------|--------|------|
| `tests/unit/` | Jest | API contracts, parsers, security, repositories (heavy use of `jest.mock` for `fs`, `@/lib/hermes-agent-runtime`, DB). |
| `tests/e2e/` | Playwright | Browser flows against a real `next start` server (see `playwright.config.ts`). |
| `tests/jest.setup.ts` | Jest | Global setup and shared mocks (`jest.config.js` → `setupFilesAfterEnv`). |
| `tests/__mocks__/better-sqlite3.cjs` | Jest | CJS shim so the native `better-sqlite3` addon is never loaded in unit tests. |
| [`tests/scripts/run-shell-custom-tests.sh`](../tests/scripts/run-shell-custom-tests.sh) | Bash | Validates [`scripts/lib/ps-dotenv-local.sh`](../scripts/lib/ps-dotenv-local.sh), [`scripts/lib/ps-hermes-profile-templates.sh`](../scripts/lib/ps-hermes-profile-templates.sh) (install-only profile copy from `data/seed/`), and a **mocked** run of [`scripts/hardware/ps-backup.sh`](../scripts/hardware/ps-backup.sh) (requires `jq` on the runner). Uses temp dirs under `/tmp` only. CI: **`shell-custom-scripts`** job. |

## Shell helper tests (bash)

```bash
bash tests/scripts/run-shell-custom-tests.sh
```

Docker (optional): `docker run --rm -v "$(pwd)":/work -w /work bash:5 bash tests/scripts/run-shell-custom-tests.sh`

## Unit tests (Jest)

```bash
npm test
npm run test:coverage
```

Config: [`jest.config.js`](../jest.config.js) at repo root. Coverage thresholds apply globally and with a higher bar for **`src/lib/**`** (pages and `src/app/**` routes are excluded from `collectCoverageFrom`).

### Hermes pathing (unit)

- [`tests/unit/hermes-package-path.test.ts`](../tests/unit/hermes-package-path.test.ts) — canonical `{HERMES_HOME}/hermes-agent` resolution and venv path errors.
- [`tests/unit/hermes-profile-paths.test.ts`](../tests/unit/hermes-profile-paths.test.ts) — `getHermesDefaultRoot()`, `resolveProfileHermesHome()` (standard, profile subdir, profile-as-home, Docker root).
- [`tests/unit/dispatch-mission-cli.test.ts`](../tests/unit/dispatch-mission-cli.test.ts) — mission dispatch sets `HERMES_HOME` on subprocess env for non-default profiles.

### SQLite baseline upgrade tests

- [`tests/unit/db-baseline.test.ts`](../tests/unit/db-baseline.test.ts) — in-memory schema smoke.
- [`tests/unit/db-upgrade.integration.test.ts`](../tests/unit/db-upgrade.integration.test.ts) — on-disk legacy DB → `rebuildToBaseline` preserves credentials, models, cron, sessions.

**Dual DB paths:** `npm run prebuild` writes `{repo}/data/patterstage.db`; runtime uses `{PS_DATA_DIR}/patterstage.db` (default `~/patterstage/data/patterstage.db`). Prebuild rebuilds the repo DB when `schema_version` is not the current baseline (**v3**).

### Bootstrap test gate

[`scripts/bootstrap/setup.sh`](../scripts/bootstrap/setup.sh) runs `npm test` when **`PS_SETUP_RUN_TESTS=1`** or **`CI=true`**. Omit on slow laptops; use CI or set the env var before release checks.

## End-to-end tests (Playwright)

Playwright starts the app with **`npm run start`** (production server), not `next dev`, so behaviour matches deployable builds.

```bash
# Recommended on a fresh clone or after schema changes (SQLite migrations):
npm run prebuild
npm run build
npm run test:e2e
```

- **`PORT`:** `playwright.config.ts` uses `process.env.PORT` (default `3000`). CI sets `PORT=3000`.
- **`PLAYWRIGHT_SMOKE=1`:** When set, only [`tests/e2e/smoke.spec.ts`](../tests/e2e/smoke.spec.ts) runs (used in CI for speed). Omit it for the **full** E2E suite (navigation matrix, config sections, Story Weaver, etc.).
- **Pre-release:** Run the full navigation matrix locally (`npm run test:e2e` without `PLAYWRIGHT_SMOKE`) before merging `dev` → `main`. CI does not run the full matrix on every push.

### Navigation matrix and sidebar

[`tests/e2e/app-routes.ts`](../tests/e2e/app-routes.ts) lists every path exercised by the navigation matrix. **`src/components/layout/sidebar-config.ts`** includes a comment: when you add or change sidebar `href` values, update `app-routes.ts` so E2E stays aligned.

## Local release-confidence harness (Docker)

**Local-only** heavy integration: [`tests/integration/test_full_install_update_process.py`](../tests/integration/test_full_install_update_process.py) builds an ephemeral image, runs scenarios in throwaway containers, and deletes them afterward. It exercises [`scripts/bootstrap/install.sh`](../scripts/bootstrap/install.sh) (bootstrap clone via `file://` bare repo + [`scripts/bootstrap/setup.sh`](../scripts/bootstrap/setup.sh)), [`scripts/bootstrap/install.sh --in-repo`](../scripts/bootstrap/install.sh), [`scripts/bootstrap/setup.sh`](../scripts/bootstrap/setup.sh), and [`scripts/application/ps-deploy.sh update`](../scripts/application/ps-deploy.sh), with runtime-generated markers under `PS_DATA_DIR` and `HERMES_HOME`. This is **not** part of CI—run it manually before releases. Complements [`tests/scripts/run-shell-custom-tests.sh`](tests/scripts/run-shell-custom-tests.sh).

**Prerequisites:** Docker daemon running; Python 3 (stdlib only).

Default **`--profile smoke`** (core personas + basic update). Use **`--profile release`** for the full matrix (install bootstrap / `bootstrap/install.sh --in-repo`, update preserving user data + seed-catalog assertions).

```bash
python tests/integration/test_full_install_update_process.py --skip-http

python tests/integration/test_full_install_update_process.py --profile release --skip-http
```

npm: `npm run test:full-install` (smoke + `--skip-http`), `npm run test:full-install-release` (release profile).

**Flags:** `--with-real-hermes-install` appends **`hermes-upstream`** (network). **`--with-interactive`** appends a slow **TTY / expect** pack after **`--scenarios all`** (same ordering as non-interactive scenarios, then interactive ones). Rebuild the harness image after pulling changes so **`expect`** is present (`docker/TestHarness.dockerfile`). Use `--continue-on-failure` for a full matrix run; interactive scenarios complement non-interactive env-driven paths—they do not replace them.

**Interactive pack:** Runs only inside the container (`expect -f` via `docker exec -t`); the host stays cross-platform (no Windows `pty`). Longer wall time (`npm install` / `npm run build`). You can also run a single id explicitly, e.g. `--scenarios setup_interactive`.

**Non-interactive default:** Plain `docker exec` still uses env vars (`INSTALL_HINDSIGHT=no`, `PS_INSTALL_NONINTERACTIVE=1`, etc.). Base image: [`docker/TestHarness.dockerfile`](../docker/TestHarness.dockerfile). CRLF in `*.sh` is normalized on the copied workspace for Linux bash.

## Continuous integration

Primary pipeline: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — Ubuntu (`shell-custom-scripts`, install, `prebuild`, ESLint with **`--max-warnings 0`**, Hermes-path grep gate, `tsc`, Jest coverage, build, Playwright smoke with `PLAYWRIGHT_SMOKE=1`) plus macOS build/test, E2E smoke on Ubuntu, and a **`docker-image`** job that runs **`docker build -f Dockerfile .`** then **`tests/scripts/docker-deploy-api-smoke.sh`** (GET version check + POST restart + HTTP still up) so the production image and dashboard deploy path do not silently rot. The **`build-test-*`** jobs use separate named steps (ESLint, TypeScript, unit tests, build) so the first failing step is obvious in the Actions UI. Actions use **`actions/checkout@v5`** and **`actions/setup-node@v5`** (action runtime on Node 24 per upstream; app build still uses `node-version: "20"` in the workflow).

[`tests/scripts/run-shell-custom-tests.sh`](../tests/scripts/run-shell-custom-tests.sh) covers dotenv, profile sync gates, and **`bash -n`** on key scripts. For **`ps-deploy.sh`** restart/stop loops on a real host, run manual checks on staging (see [DEPLOY.md](DEPLOY.md)).

Other workflows: **gitleaks** (secret scan).

## Auth in route tests

Many Jest suites mock **`@/lib/api-auth`** (`requireAuth` returns `null` when allowed). Mirror that pattern when adding new mutating API route tests.

## Hermes pathing — manual verification matrix

Run before merging Hermes multi-profile changes (complements unit tests above):

| Scenario | Setup | Expected |
|----------|--------|----------|
| Standard install | `HERMES_HOME=~/.hermes`, profile `coder` | Per-profile files under `profiles/coder/`; cron sync finds `hermes-agent` |
| Profile-as-home | `HERMES_HOME=~/.hermes/profiles/coder` | No double `profiles/` in API paths; `hermes-detection.json` has `isProfileHome: true` |
| Custom Docker root | `HERMES_HOME=/opt/data` | Profiles under `/opt/data/profiles/*`; `defaultRoot` matches |
| Mission + cron | Dispatch mission; Hermes updates `PS_DATA_DIR/missions/*.json` | Status visible in UI |
| Gateway override | `HERMES_GATEWAY_URL` set | Health/chat use custom URL |

After `setup.sh`, inspect `PS_DATA_DIR/hermes-detection.json` for `valid`, `hermesAgentPath`, and `defaultRoot` (debug artifact only—the app does not read it at runtime; see [ENV_REFERENCE.md](ENV_REFERENCE.md)).
