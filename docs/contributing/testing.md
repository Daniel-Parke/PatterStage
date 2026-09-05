---
title: Testing
summary: The map of Jest, Playwright and shell harnesses, and the gotchas each one hides
section: contributing
nav: 30
audience: contributor
type: guide
tags: [product, testing]
compiled_from: normalised
---
# Testing

I expect PRs to pass the same checks CI runs. This page is the map of Jest, Playwright, shell harnesses, and the gotchas that wasted my time once already.

## Layout

| Path | Runner | Role |
|------|--------|------|
| `tests/unit/` | Jest | API contracts, parsers, security, repositories (heavy use of `jest.mock` for `@/lib/db`, `@/lib/api-logger`, `@/modules/hermes/lib/agent-runtime`, `fs`). |
| `tests/e2e/` | Playwright | Browser flows against a real `next start` server (see `playwright.config.ts`). |
| `tests/jest.setup.ts` | Jest | Global setup and shared mocks (`jest.config.js` → `setupFilesAfterEnv`). |
| `tests/__mocks__/better-sqlite3.cjs` | Jest | CJS shim so the native `better-sqlite3` addon is never loaded in unit tests. |
| [`tests/scripts/run-shell-custom-tests.sh`](../../tests/scripts/run-shell-custom-tests.sh) | Bash | Validates [`scripts/lib/ps-dotenv-local.sh`](../../scripts/lib/ps-dotenv-local.sh), [`scripts/lib/ps-hermes-profile-templates.sh`](../../scripts/lib/ps-hermes-profile-templates.sh) (install-only profile copy from `data/seed/`), and a **mocked** run of [`scripts/hardware/ps-backup.sh`](../../scripts/hardware/ps-backup.sh) (requires `jq` on the runner). Uses temp dirs under `/tmp` only. CI: **`shell-custom-scripts`** job. |

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

Config: [`jest.config.js`](../../jest.config.js) at repo root. Coverage is collected from every `src/**/*.{ts,tsx}` except `.d.ts` files and `layout.tsx`. Pages and `src/app/**` route handlers **are** measured: `!src/app/**` and `!src/**/page.tsx` used to sit in `collectCoverageFrom` and were deliberately removed in T-0044, because the wiring defects a live QA pass found were exactly the code no floor could see.

Three floor bands apply, engine above service above UI: `src/lib/` carries the highest, `src/app/api/` a middle one, and the global group is the remainder (overwhelmingly UI). The numbers live in [`scripts/tooling/coverage-floors.cjs`](../../scripts/tooling/coverage-floors.cjs), not in `jest.config.js`, and they ratchet: `npm run lint:coverage-floors` (also chained into `npm run lint`) fails the build if a floor goes down. Raise one by writing tests, never by editing the number alone.

### Hermes pathing (unit)

- [`tests/unit/hermes-profile-paths.test.ts`](../../tests/unit/hermes-profile-paths.test.ts): `getHermesDefaultRoot()`, `resolveProfileHermesHome()` (standard, profile subdir, profile-as-home, Docker root).

### SQLite baseline upgrade tests

- [`tests/unit/db-baseline.test.ts`](../../tests/unit/db-baseline.test.ts): in-memory schema smoke.
- [`tests/unit/db-upgrade.integration.test.ts`](../../tests/unit/db-upgrade.integration.test.ts): on-disk legacy DB → `rebuildToBaseline` preserves credentials, models, cron, sessions.

**Dual DB paths:** `npm run prebuild` writes `{repo}/data/patterstage.db`; runtime uses `{PS_DATA_DIR}/patterstage.db` (default `~/patterstage/data/patterstage.db`). Prebuild rebuilds the repo DB from `001_baseline.sql` when `schema_version` is **below** the baseline (**v3**), then applies the migrations on top; a DB already at or above the baseline is upgraded in place, not rebuilt.

### Bootstrap test gate

[`scripts/bootstrap/setup.sh`](../../scripts/bootstrap/setup.sh) runs `npm test` when **`PS_SETUP_RUN_TESTS=1`** or **`CI=true`**. Omit on slow laptops; use CI or set the env var before release checks.

## End-to-end tests (Playwright)

Playwright starts the app with **`npm run start`** (production server), not `next dev`, so behaviour matches deployable builds.

```bash
# Recommended on a fresh clone or after schema changes (SQLite migrations):
npm run prebuild
npm run build
npm run test:e2e
```

- **`PORT`:** pinned by the npm script, not by CI. `npm run test:e2e` is `cross-env PORT=3000 playwright test`, so 3000 wins locally and in CI alike, over any `PORT` you exported and over `.env.local` (which nothing in this chain reads). `playwright.config.ts` also passes `-p` to the server it starts, so the `next start` child cannot drift onto another port. For a different port, run `npx playwright test` directly with `PORT` set.
- **`PLAYWRIGHT_SMOKE=1`:** When set, `testMatch` narrows to [`tests/e2e/smoke.spec.ts`](../../tests/e2e/smoke.spec.ts), which holds 5 tests. Omit it for the **full** E2E suite (navigation matrix, config sections, Story Weaver, the missions journeys, etc.). Do not go looking for a fixed total here: the navigation matrix generates one test per route and the routes are derived from the module registry, so the count moves whenever a surface is added. Run `npx playwright test --list` for the number today, and `CAPTURE_SCREENSHOTS=1` for the doc-screenshot tests, which skip themselves otherwise.
- **Where each one runs.** The `e2e-smoke` job keeps `PLAYWRIGHT_SMOKE=1` and runs on every push and pull request. The `e2e-full` job runs the same command **without** it, on pull requests targeting `main` and on manual dispatch (WO-0012, WG-DEL-002 ruled B). The two jobs differ by exactly that one environment variable, so they cannot drift into different suites. Before this, everything outside `smoke.spec.ts` ran on no branch in CI at all.
- **Pre-release:** running `npm run test:e2e` locally without `PLAYWRIGHT_SMOKE` before a `dev` → `main` merge is still the fastest way to find a failure, but it is no longer the only thing standing between the suite and main.

### Navigation matrix and sidebar

[`tests/e2e/app-routes.ts`](../../tests/e2e/app-routes.ts) lists every path exercised by the navigation
matrix, and it is DERIVED: `export const APP_NAV_ROUTES = allModuleRoutes()`. Nothing to keep in sync.
Add the surface to [`src/lib/modules/registry.ts`](../../src/lib/modules/registry.ts) and both the sidebar
and the matrix follow. This used to be a hand-mirrored list with a "keep in sync" comment, and it had
already drifted -- `/results/artifacts` was missing, so the matrix silently stopped covering a page.

## Install harness (Docker): a gate, not a ritual

**Runs in CI.** The `install-harness` job runs `--profile smoke --skip-http` on every push and pull request. WG-OPS-002 ruled the native host install the one supported deployment model, and a stranger's first install failing is death #1 in the venture brief, so this is gated rather than remembered (WO-0011). It was marked "not part of CI" while `setup.sh`'s build fetched fonts over the network; WO-0002 vendored them, so it is deterministic now.

Locally it is also the release-confidence run: [`tests/integration/test_full_install_update_process.py`](../../tests/integration/test_full_install_update_process.py) builds an ephemeral image, runs scenarios in throwaway containers, and deletes them afterward. It exercises [`scripts/bootstrap/install.sh`](../../scripts/bootstrap/install.sh) (bootstrap clone via `file://` bare repo + [`scripts/bootstrap/setup.sh`](../../scripts/bootstrap/setup.sh)), [`scripts/bootstrap/install.sh --in-repo`](../../scripts/bootstrap/install.sh), [`scripts/bootstrap/setup.sh`](../../scripts/bootstrap/setup.sh), and [`scripts/application/ps-deploy.sh update`](../../scripts/application/ps-deploy.sh), with runtime-generated markers under `PS_DATA_DIR` and `HERMES_HOME`. Complements [`tests/scripts/run-shell-custom-tests.sh`](../../tests/scripts/run-shell-custom-tests.sh).

**Prerequisites:** Docker daemon running; Python 3 (stdlib only).

Default **`--profile smoke`** (core personas + basic update). Use **`--profile release`** for the full matrix (install bootstrap / `bootstrap/install.sh --in-repo`, update preserving user data + seed-catalog assertions).

```bash
python tests/integration/test_full_install_update_process.py --skip-http

python tests/integration/test_full_install_update_process.py --profile release --skip-http
```

npm: `npm run test:full-install` (smoke + `--skip-http`), `npm run test:full-install-release` (release profile).

**Flags:** `--with-real-hermes-install` appends **`hermes-upstream`** (network). **`--with-interactive`** appends a slow **TTY / expect** pack after **`--scenarios all`** (same ordering as non-interactive scenarios, then interactive ones). Rebuild the harness image after pulling changes so **`expect`** is present (`docker/TestHarness.dockerfile`). Use `--continue-on-failure` for a full matrix run; interactive scenarios complement non-interactive env-driven paths. They do not replace them.

**Interactive pack:** Runs only inside the container (`expect -f` via `docker exec -t`); the host stays cross-platform (no Windows `pty`). Longer wall time (`npm install` / `npm run build`). You can also run a single id explicitly, e.g. `--scenarios setup_interactive`.

**Non-interactive default:** Plain `docker exec` still uses env vars (`INSTALL_HINDSIGHT=no`, `PS_INSTALL_NONINTERACTIVE=1`, etc.). Base image: [`docker/TestHarness.dockerfile`](../../docker/TestHarness.dockerfile). CRLF in `*.sh` is normalized on the copied workspace for Linux bash.

## Cross-platform live smoke against a Hermes (mock or real)

Two zero-dependency Node runners drive PatterStage's real HTTP surface against a running stack. They work the same on **Linux, macOS, and Windows** (pure `fetch`):

| Runner | npm | Covers | Auth |
|--------|-----|--------|------|
| [`full-stack-smoke.mjs`](../../tests/integration/runtime/full-stack-smoke.mjs) | `test:e2e-runtime` | Gateway reachability, missions, dispatch and reconcile, schedules, cancel, legacy now-dispatch, analytics + achievements, chat | Sends `PS_AUTH_TOKEN` as a Bearer when set |
| [`composer-smoke.mjs`](../../tests/integration/runtime/composer-smoke.mjs) | `test:smoke-composer` | Composer (dispatch → HIL gate → approve → advance) + Deep Research | None. Needs a server started with `PS_AUTH_MODE=none` |

The benchmark section of `full-stack-smoke.mjs` was deleted with the rest of the benchmark subsystem (commit 4935ac31); `/api/benchmarks/*` 404s by decision, and a tombstone at the foot of the runner records it.

**Both recipes below have to deal with auth.** [`src/proxy.ts`](../../src/proxy.ts) authenticates every request except a safe-method `GET /api/health`, and `PS_AUTH_MODE` defaults to `token`, so a server started with a bare `npm run dev` refuses these runners. `full-stack-smoke.mjs` can present a token; `composer-smoke.mjs` sends no `Authorization` header at all, so the only way to run it is with auth off. Turning auth off is fine for a local smoke against a throwaway data dir and is not fine anywhere else.

### Against the mock Hermes (offline, any OS)

```bash
npm run mock-hermes                       # terminal 1: stand-in API server on :8642
PS_AUTH_MODE=none HERMES_GATEWAY_URL=http://127.0.0.1:8642 PS_SEARCH_PROVIDER=none npm run dev   # terminal 2
PS_URL=http://127.0.0.1:3000 npm run test:smoke-composer   # terminal 3
```

The mock defaults to **:8642, the real gateway's own port**, because it impersonates it. On a machine running the real Hermes API Server that collides: set `MOCK_HERMES_PORT` to a free port, or stop the agent's server first. The mock exits with that advice rather than a stack trace. It binds loopback by default; the compose stack overrides that in its Dockerfile.


`PS_SEARCH_PROVIDER=none` keeps Deep Research fully offline (no live web search). On a **fresh** `PS_DATA_DIR`, run `PS_DATA_DIR=<dir> npm run db:migrate` once before starting the server (the boot-time Composer seed needs the schema present).

For `test:e2e-runtime` you can keep auth on instead: start the server normally and pass the same value in `PS_AUTH_TOKEN` to both sides.

### Against a real local Hermes

PatterStage talks to Hermes **only** through its HTTP API Server (the gateway) + a bearer key, so enable that first:

1. In the Hermes agent's `.env` (e.g. `~/.hermes/.env`), set `API_SERVER_ENABLED=true` and an `API_SERVER_KEY=<key>`, and start the gateway (it listens on `:8642`). Verify: `curl http://127.0.0.1:8642/health`.
2. Point PatterStage at it via `HERMES_GATEWAY_URL` + `API_SERVER_KEY` (must match), then run a smoke:

**bash (Linux/macOS/WSL):**
```bash
export HERMES_GATEWAY_URL=http://127.0.0.1:8642 API_SERVER_KEY=<key> PS_AUTH_MODE=none
npm run dev
PS_URL=http://127.0.0.1:3000 npm run test:smoke-composer
```

**PowerShell (Windows):**
```powershell
$env:HERMES_GATEWAY_URL = "http://127.0.0.1:8642"; $env:API_SERVER_KEY = "<key>"; $env:PS_AUTH_MODE = "none"
npm run dev
$env:PS_URL = "http://127.0.0.1:3000"; npm run test:smoke-composer
```

`API_SERVER_KEY` is the key PatterStage presents to Hermes. It is not PatterStage's own token, and it does not satisfy `src/proxy.ts`.

The runners exit non-zero on any failed assertion. **Neither runner is wired into CI**; both are manual. What CI does run cross-OS is `boot-smoke` (OS-seam primitives: detached spawn survival, port probing, process kill), on Ubuntu and macOS only, plus the Ubuntu Docker `real-hermes-integration` job, which drives `full-stack-smoke.mjs` against a real Hermes image. There is no Windows runner in `ci.yml`, so a Windows stack is validated only by running the two runners above by hand.

## Continuous integration

Primary pipeline: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). The `build-test-ubuntu` job runs, in order: install, `prebuild`, the step **labelled ESLint**, the **output canary** (`npm run canary:check`), **knip** (`npm run lint:knip`), the Hermes-path grep gate, `tsc --noEmit`, Jest coverage, the production build, then a second recorded canary run over the rendered surfaces. Alongside it: `shell-custom-scripts`, `build-test-macos` (build + test), `boot-smoke` (Ubuntu and macOS), `e2e-smoke` (Playwright with `PLAYWRIGHT_SMOKE=1`), `install-harness`, and a **`docker-image`** job that runs **`docker build -f Dockerfile .`** then **`tests/scripts/docker-deploy-api-smoke.sh`** (GET version check + POST restart + HTTP still up) so the production image and dashboard deploy path do not silently rot. Separate named steps mean the first failing one is obvious in the Actions UI. Actions use **`actions/checkout@v5`** and **`actions/setup-node@v5`** (action runtime on Node 24 per upstream; app build still uses `node-version: "20"` in the workflow).

**The step named "ESLint" is not eslint.** It runs `npm run lint`, which chains nine gates: `check-agent-files`, `check-doc-links`, `check-derived-views`, `check-read-only-guards`, `design-lint`, `contrast-check`, `coverage-floor-check`, then `eslint . --max-warnings 0`, then `typecheck:tests`. A broken relative link in `docs/`, a colour literal, a coverage floor or a type error in a test file all fail that step. `canary:check` and `lint:knip` are **not** in that chain and are separate blocking steps, so a green local `npm run lint` is not by itself a green CI.

### The main-blocking acceptance set

Three jobs make up the assembled proof WG-DEL-002 (ruled B) puts on `main`. Only one of them is restricted to that branch; the other two also run more widely, so read the trigger column rather than the heading:

| Job | What it proves | When it runs |
|-----|----------------|--------------|
| **`e2e-full`** | The whole Playwright suite | PRs targeting `main`, and manual dispatch. Nothing else. |
| **`install-harness`** | The install journey | Every push and every pull request, `dev` included. A fresh install breaking is death #1, so a branch hears about it early. |
| **`real-hermes-integration`** | The stack against a real Hermes image | Every push to `main` or `dev`, plus manual dispatch, plus PRs targeting `main`. It was once push-only, which is how a red gate stayed invisible in PR views for four weeks; the PR trigger was added without removing the push one. |

**`acceptance-gate`** aggregates the three into one check that fails unless all three succeeded, and it alone is gated to PRs targeting `main` and manual dispatch.

A workflow file can only decide which jobs run. Which ones *block* a merge is a branch-protection setting, and branch protection on `main` currently requires zero checks, so `acceptance-gate` reports and blocks nothing until the operator makes it a required check (the remaining half of WO-0011).

[`tests/scripts/run-shell-custom-tests.sh`](../../tests/scripts/run-shell-custom-tests.sh) covers dotenv, profile sync gates, and **`bash -n`** on key scripts. For **`ps-deploy.sh`** restart/stop loops on a real host, run manual checks on staging (see [DEPLOY.md](../running/deploy.md)).

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

`requireAuth` is gone. T-0048 deleted it because it authenticated nothing and only
checked the read-only flag; authentication and read-only now live once in
[`src/proxy.ts`](../../src/proxy.ts), enforced by HTTP method. Mocking it grants a route
test nothing. Worse, a factory without `requireActual` replaces the whole module, so
the name the handler really imports (`requireNotReadOnly`, `isReadOnly`,
`requireAuthenticatedHostWrites`) comes back undefined and the handler throws.

`tests/unit/read-only-is-testable.test.ts` fails the build on a factory that names an
export `@/lib/api-auth` does not have. Know its limit before you lean on it: it reads
names off their own indented line, so a **single-line** factory such as
`jest.mock("@/lib/api-auth", () => ({ requireAuth: () => null }))` slips past. Nine
of those survive in `tests/unit/`, green only because the routes they exercise import
nothing from `api-auth` at all, which makes the mock dead weight rather than harmless
precedent. They are vestigial. Do not copy them.

## Hermes pathing: manual verification matrix

Run before merging Hermes multi-profile changes (complements unit tests above):

| Scenario | Setup | Expected |
|----------|--------|----------|
| Standard install | `HERMES_HOME=~/.hermes`, profile `coder` | Per-profile files under `profiles/coder/`; cron sync finds `hermes-agent` |
| Profile-as-home | `HERMES_HOME=~/.hermes/profiles/coder` | No double `profiles/` in API paths; `hermes-detection.json` has `isProfileHome: true` |
| Custom Docker root | `HERMES_HOME=/opt/data` | Profiles under `/opt/data/profiles/*`; `defaultRoot` matches |
| Mission + cron | Dispatch mission; Hermes updates `PS_DATA_DIR/missions/*.json` | Status visible in UI |
| Gateway override | `HERMES_GATEWAY_URL` set | Health/chat use custom URL |

After `setup.sh`, inspect `PS_DATA_DIR/hermes-detection.json` for `valid`, `hermesAgentPath`, and `defaultRoot`. That file is a debug artifact only; the app does not read it at runtime (see [ENV_REFERENCE.md](../running/env-reference.md)).
