---
summary: The map of Jest, Playwright and shell harnesses, and the gotchas each one hides
type: guide
tags: [product, testing]
compiled_from: normalised
---

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

- [`tests/unit/hermes-profile-paths.test.ts`](../tests/unit/hermes-profile-paths.test.ts): `getHermesDefaultRoot()`, `resolveProfileHermesHome()` (standard, profile subdir, profile-as-home, Docker root).

### SQLite baseline upgrade tests

- [`tests/unit/db-baseline.test.ts`](../tests/unit/db-baseline.test.ts): in-memory schema smoke.
- [`tests/unit/db-upgrade.integration.test.ts`](../tests/unit/db-upgrade.integration.test.ts): on-disk legacy DB → `rebuildToBaseline` preserves credentials, models, cron, sessions.

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
- **`PLAYWRIGHT_SMOKE=1`:** When set, only [`tests/e2e/smoke.spec.ts`](../tests/e2e/smoke.spec.ts) runs (5 of the suite's 97 tests). Omit it for the **full** E2E suite (navigation matrix, config sections, Story Weaver, the missions journeys, etc.).
- **Where each one runs.** The `e2e-smoke` job keeps `PLAYWRIGHT_SMOKE=1` and runs on every push and pull request. The `e2e-full` job runs the same command **without** it, on pull requests targeting `main` and on manual dispatch (WO-0012, WG-DEL-002 ruled B). The two jobs differ by exactly that one environment variable, so they cannot drift into different suites. Before this, 92 of the 97 tests ran on no branch in CI at all.
- **Pre-release:** running `npm run test:e2e` locally without `PLAYWRIGHT_SMOKE` before a `dev` → `main` merge is still the fastest way to find a failure, but it is no longer the only thing standing between the suite and main.

### Navigation matrix and sidebar

[`tests/e2e/app-routes.ts`](../tests/e2e/app-routes.ts) lists every path exercised by the navigation
matrix, and it is DERIVED: `export const APP_NAV_ROUTES = allModuleRoutes()`. Nothing to keep in sync.
Add the surface to [`src/lib/modules/registry.ts`](../src/lib/modules/registry.ts) and both the sidebar
and the matrix follow. This used to be a hand-mirrored list with a "keep in sync" comment, and it had
already drifted -- `/laboratory/artifacts` was missing, so the matrix silently stopped covering a page.

## Install harness (Docker): a gate, not a ritual

**Runs in CI.** The `install-harness` job runs `--profile smoke --skip-http` on every push and pull request. WG-OPS-002 ruled the native host install the one supported deployment model, and a stranger's first install failing is death #1 in the venture brief, so this is gated rather than remembered (WO-0011). It was marked "not part of CI" while `setup.sh`'s build fetched fonts over the network; WO-0002 vendored them, so it is deterministic now.

Locally it is also the release-confidence run: [`tests/integration/test_full_install_update_process.py`](../tests/integration/test_full_install_update_process.py) builds an ephemeral image, runs scenarios in throwaway containers, and deletes them afterward. It exercises [`scripts/bootstrap/install.sh`](../scripts/bootstrap/install.sh) (bootstrap clone via `file://` bare repo + [`scripts/bootstrap/setup.sh`](../scripts/bootstrap/setup.sh)), [`scripts/bootstrap/install.sh --in-repo`](../scripts/bootstrap/install.sh), [`scripts/bootstrap/setup.sh`](../scripts/bootstrap/setup.sh), and [`scripts/application/ps-deploy.sh update`](../scripts/application/ps-deploy.sh), with runtime-generated markers under `PS_DATA_DIR` and `HERMES_HOME`. Complements [`tests/scripts/run-shell-custom-tests.sh`](../tests/scripts/run-shell-custom-tests.sh).

**Prerequisites:** Docker daemon running; Python 3 (stdlib only).

Default **`--profile smoke`** (core personas + basic update). Use **`--profile release`** for the full matrix (install bootstrap / `bootstrap/install.sh --in-repo`, update preserving user data + seed-catalog assertions).

```bash
python tests/integration/test_full_install_update_process.py --skip-http

python tests/integration/test_full_install_update_process.py --profile release --skip-http
```

npm: `npm run test:full-install` (smoke + `--skip-http`), `npm run test:full-install-release` (release profile).

**Flags:** `--with-real-hermes-install` appends **`hermes-upstream`** (network). **`--with-interactive`** appends a slow **TTY / expect** pack after **`--scenarios all`** (same ordering as non-interactive scenarios, then interactive ones). Rebuild the harness image after pulling changes so **`expect`** is present (`docker/TestHarness.dockerfile`). Use `--continue-on-failure` for a full matrix run; interactive scenarios complement non-interactive env-driven paths. They do not replace them.

**Interactive pack:** Runs only inside the container (`expect -f` via `docker exec -t`); the host stays cross-platform (no Windows `pty`). Longer wall time (`npm install` / `npm run build`). You can also run a single id explicitly, e.g. `--scenarios setup_interactive`.

**Non-interactive default:** Plain `docker exec` still uses env vars (`INSTALL_HINDSIGHT=no`, `PS_INSTALL_NONINTERACTIVE=1`, etc.). Base image: [`docker/TestHarness.dockerfile`](../docker/TestHarness.dockerfile). CRLF in `*.sh` is normalized on the copied workspace for Linux bash.

## Cross-platform live smoke against a Hermes (mock or real)

Two zero-dependency Node runners drive PatterStage's real HTTP surface against a running stack. They work the same on **Linux, macOS, and Windows** (pure `fetch`):

| Runner | npm | Covers |
|--------|-----|--------|
| [`full-stack-smoke.mjs`](../tests/integration/runtime/full-stack-smoke.mjs) | `test:e2e-runtime` | Missions, schedules, cancel, chat, analytics, benchmarks |
| [`composer-smoke.mjs`](../tests/integration/runtime/composer-smoke.mjs) | `test:smoke-composer` | Composer (dispatch → HIL gate → approve → advance) + Deep Research |

### Against the mock Hermes (offline, any OS)

```bash
npm run mock-hermes                       # terminal 1: stand-in API server on :8642
HERMES_GATEWAY_URL=http://127.0.0.1:8642 PS_SEARCH_PROVIDER=none npm run dev   # terminal 2
PS_URL=http://127.0.0.1:3000 npm run test:smoke-composer   # terminal 3
```

`PS_SEARCH_PROVIDER=none` keeps Deep Research fully offline (no live web search). On a **fresh** `PS_DATA_DIR`, run `PS_DATA_DIR=<dir> npm run db:migrate` once before starting the server (the boot-time Composer seed needs the schema present).

### Against a real local Hermes

PatterStage talks to Hermes **only** through its HTTP API Server (the gateway) + a bearer key, so enable that first:

1. In the Hermes agent's `.env` (e.g. `~/.hermes/.env`), set `API_SERVER_ENABLED=true` and an `API_SERVER_KEY=<key>`, and start the gateway (it listens on `:8642`). Verify: `curl http://127.0.0.1:8642/health`.
2. Point PatterStage at it via `HERMES_GATEWAY_URL` + `API_SERVER_KEY` (must match), then run a smoke:

**bash (Linux/macOS/WSL):**
```bash
export HERMES_GATEWAY_URL=http://127.0.0.1:8642 API_SERVER_KEY=<key>
npm run dev
PS_URL=http://127.0.0.1:3000 npm run test:smoke-composer
```

**PowerShell (Windows):**
```powershell
$env:HERMES_GATEWAY_URL = "http://127.0.0.1:8642"; $env:API_SERVER_KEY = "<key>"
npm run dev
$env:PS_URL = "http://127.0.0.1:3000"; npm run test:smoke-composer
```

The runners exit non-zero on any failed assertion. CI is unchanged: it runs the mock smoke on all three OSes plus the Ubuntu Docker real-Hermes job; the runners above are the manual path for validating a real (or Windows) Hermes.

## Continuous integration

Primary pipeline: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml), which runs Ubuntu (`shell-custom-scripts`, install, `prebuild`, ESLint with **`--max-warnings 0`**, Hermes-path grep gate, `tsc`, Jest coverage, build, Playwright smoke with `PLAYWRIGHT_SMOKE=1`) plus macOS build/test, E2E smoke on Ubuntu, and a **`docker-image`** job that runs **`docker build -f Dockerfile .`** then **`tests/scripts/docker-deploy-api-smoke.sh`** (GET version check + POST restart + HTTP still up) so the production image and dashboard deploy path do not silently rot. The **`build-test-*`** jobs use separate named steps (ESLint, TypeScript, unit tests, build) so the first failing step is obvious in the Actions UI. Actions use **`actions/checkout@v5`** and **`actions/setup-node@v5`** (action runtime on Node 24 per upstream; app build still uses `node-version: "20"` in the workflow).

### The main-blocking acceptance set

Three jobs run only for pull requests targeting `main` (and on manual dispatch), because that is where WG-DEL-002 (ruled B) puts the assembled proof: **`e2e-full`** (the whole Playwright suite), **`install-harness`** (the install journey, which also runs on every push and pull request), and **`real-hermes-integration`** (which used to be push-only, so a red gate stayed invisible in PR views). **`acceptance-gate`** aggregates the three into one check that fails unless all three succeeded.

A workflow file can only decide which jobs run. Which ones *block* a merge is a branch-protection setting, and branch protection on `main` currently requires zero checks, so `acceptance-gate` reports and blocks nothing until the operator makes it a required check (the remaining half of WO-0011).

[`tests/scripts/run-shell-custom-tests.sh`](../tests/scripts/run-shell-custom-tests.sh) covers dotenv, profile sync gates, and **`bash -n`** on key scripts. For **`ps-deploy.sh`** restart/stop loops on a real host, run manual checks on staging (see [DEPLOY.md](DEPLOY.md)).

Other workflows: **gitleaks** (secret scan).

## Auth in route tests

Route tests use the shared helper in `tests/helpers/api-test-helpers.ts`, which
mocks **`@/lib/api-auth`** by spreading the REAL module and stubbing only the
signing check:

```ts
jest.mock("@/lib/api-auth", () => ({
  ...jest.requireActual("@/lib/api-auth"),
  requireSignedRequest: jest.fn(() => null),
}));
```

Do NOT replace the whole module. It used to, including `isReadOnly: () => false`,
and that is how a read-only defect reached 34 route handlers with the suite green
throughout: every route test ran with the mode hard-wired off, so no test could
observe the bug even in principle (T-0048, T-0049). Spreading the real module means
a test that sets `PS_READ_ONLY` actually gets read-only behaviour.

A mock factory naming an export the module does not have is now a build failure, so
mocking the long-deleted `requireAuth` fails rather than silently passing.

## Hermes pathing: manual verification matrix

Run before merging Hermes multi-profile changes (complements unit tests above):

| Scenario | Setup | Expected |
|----------|--------|----------|
| Standard install | `HERMES_HOME=~/.hermes`, profile `coder` | Per-profile files under `profiles/coder/`; cron sync finds `hermes-agent` |
| Profile-as-home | `HERMES_HOME=~/.hermes/profiles/coder` | No double `profiles/` in API paths; `hermes-detection.json` has `isProfileHome: true` |
| Custom Docker root | `HERMES_HOME=/opt/data` | Profiles under `/opt/data/profiles/*`; `defaultRoot` matches |
| Mission + cron | Dispatch mission; Hermes updates `PS_DATA_DIR/missions/*.json` | Status visible in UI |
| Gateway override | `HERMES_GATEWAY_URL` set | Health/chat use custom URL |

After `setup.sh`, inspect `PS_DATA_DIR/hermes-detection.json` for `valid`, `hermesAgentPath`, and `defaultRoot`. That file is a debug artifact only; the app does not read it at runtime (see [ENV_REFERENCE.md](ENV_REFERENCE.md)).
