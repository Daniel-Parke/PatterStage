# Repository guide

The working detail that used to live in `AGENTS.md`. The router is capped at 40
lines so it stays read; this file carries the rest.

Statements here are corrected against the code as of 2026-07. Where a convention
is being retired by the rebuild, it says so rather than pretending.

## Development environment

```bash
npm run dev     # dev server (PORT from .env.local)
npm run build   # production build
npm run start   # production server
npm run lint    # eslint --max-warnings 0 + the repo's own checks
npm test        # jest
```

On first boot an access token is minted into `PS_DATA_DIR/auth-token` and the
sign-in URL is printed to the log. See [SECURITY.md](SECURITY.md).

## Architecture in one paragraph

PatterStage owns orchestration and scheduling; the agent (Hermes) only executes
runs over HTTP. The orchestration core (`src/lib/orchestration/`) reaches the
agent through the `AgentRuntime` port (`src/lib/runtime/types.ts`), implemented by
`HermesRuntime.ts`. A PatterStage-owned scheduler (`src/lib/orchestration/scheduler/`)
boots from `src/instrumentation.ts` and fires due schedules on a 15s tick,
independent of HTTP traffic. State is SQLite (`src/lib/db.ts`, migrations in
`src/lib/db/migrations/*.sql`) behind hand-written repositories. Full detail:
[RUNTIME_ARCHITECTURE.md](RUNTIME_ARCHITECTURE.md).

> **Known gap.** The "one seam to the agent" claim is not yet true: four HTTP
> clients reach the gateway and ~244 of 608 source files mention Hermes. Treat the
> port as the direction of travel, not the current state, and do not add a fifth.

## Layout

| Path | Holds |
|------|-------|
| `src/app/api/` | REST routes, `{ data?, error? }` envelope |
| `src/app/` | Pages: dashboard, `(main)/` sessions·memory·logs, `orchestration/`, `operations/`, `laboratory/`, `config/`, `recroom/` |
| `src/proxy.ts` | **The** authentication / CSRF / read-only boundary |
| `src/components/layout/` | Sidebar, `PageHeader`, `AppPageShell`, `MobileHeader` |
| `src/components/ui/field/` | The Field Kit form primitives |
| `src/components/viz/` | Hand-rolled SVG charts |
| `src/lib/runtime/` | `AgentRuntime` port + `HermesRuntime` adapter + gateway manager |
| `src/lib/orchestration/` | dispatch, run-reconcile, `scheduler/` |
| `src/lib/sync/` | `SyncSource` implementations + `SyncScheduler` |
| `src/lib/*-repository.ts` | Data access, one module per aggregate |
| `tests/unit` · `tests/e2e` · `tests/integration` | Jest · Playwright · Docker + runtime harnesses |
| `scripts/` | `bootstrap/`, `application/`, `tooling/`, `hardware/`, `maintenance/` |

Next.js static files go in `public/` at the repo root; the Dockerfile runs
`mkdir -p public` before build, so the folder is not committed empty.

## Conventions

- **TypeScript strict** — no `any`, no `@ts-ignore`.
- **API routes return `{ data?, error? }`** via the status-code-locked factories in
  `src/lib/api-response.ts`. Do not add overloads to those factories.
- **Every catch calls `logApiError(route, context, error)`** (`src/lib/api-logger.ts`).
- **Authentication is not a route's job.** `src/proxy.ts` enforces it for every
  request. `requireAuth()` only checks the read-only flag despite its name.
- **Whitelist body fields in PUT handlers** (no mass assignment) and validate any
  path built from input — `resolveScriptPath()` in `src/lib/scripts-manager.ts` is
  the reference implementation.
- **Never validate an attacker-controlled command string — regenerate it.** See
  `canonicaliseScriptsCommand` in `src/app/api/cron/hardware/route.ts` for why.
- **Agent integration goes through the `AgentRuntime` port.** Add a capability to
  `types.ts` and implement it in `HermesRuntime.ts`; never reach into agent
  internals from orchestration code.
- **Large action-router routes split into per-action modules** — a thin `route.ts`
  dispatches on `action` to `src/lib/{mission,story}-handlers/*`.
- **Read-only data hooks wrap `useApiResource`** (`src/hooks/useApiResource.ts`).
  Hooks with mutations or multi-query bundles stay bespoke; don't force them onto
  the generic.
- **Big page = page-core hook + render shell.** Past ~600 lines, lift the stateful
  core into a `use<Page>` hook and leave the `.tsx` as a shell. Move logic verbatim.
- **Prefer composable helpers over wrappers/base classes.** No `withApiRoute` HOF,
  no base-repository class — the routes are too heterogeneous.
- **Form inputs use the Field Kit** (`src/components/ui/field/`): `Field`, `Input`,
  `Textarea`, `Select`, `Toggle`, `ChipGroup`. Don't reach for raw `<input>`.
- **Use `js-yaml` for YAML.**
- **String concatenation for paths in code traced by Turbopack NFT**, not
  `path.join`. This is a real constraint in module scope; `join` is fine inside
  request handlers, where several routes already use it.

## Design tokens

Single source: `src/app/globals.css` (`@theme`) plus `src/lib/theme.ts`,
documented in [design-tokens.md](design-tokens.md). Use theme colours; do not
introduce raw hex or ad-hoc `purple-500` / `rgba(...)` in TSX.

The shell/effect custom properties are **`--ps-*`** (`--ps-rgb-neon-*`,
`--ps-shell-header-min-height`, `--ps-mobile-header-min-height`). There are no
`--ch-*` variables — this file told contributors to write them for months and the
resulting CSS silently did nothing.

- **Page chrome:** `PageHeader` for sticky top bars; `shellHeaderBarClasses` only
  when extending the shell outside it.
- **Page frame:** `AppPageShell` instead of repeating `min-h-screen bg-dark-950 grid-bg`.
- **Data viz:** hand-rolled SVG only, primitives in `@/components/viz`. Entrance via
  `.viz-draw`, gated on `prefers-reduced-motion`. Scale/path maths goes in
  `viz/geometry.ts` so it is unit-testable.
- **Motion:** the reduced-motion-safe wrappers in `@/components/motion`. Keep motion
  off dense, frequently-repolling surfaces.

> **Being replaced.** The estate's design system is `@pattertech/ui` (Cherenkov
> tokens + typed primitives), already used by PatterStudio's app. PatterStage
> hand-ported those tokens and drifted: different surface ramp, different
> success/danger, four extra accents, three different cyans hardcoded in
> `globals.css`. Do not add tokens; the rebuild vendors the shared kit.

## Git workflow

Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).
Run the gate before pushing. Never merge your own PR. On a merge conflict, stop and
report.

`gh` is the tool for GitHub operations — never the browser, which blocks with
CAPTCHAs.

## Deployment

Entrypoint `scripts/application/ps-deploy.sh` (thin wrapper over
`scripts/tooling/ps-deploy.mjs`), also driven by `POST /api/update`:

- **`restart`** — stop the port, restart next-server. No git, no build.
- **`rebuild`** — build the current tree + restart.
- **`update`** — pull, install if needed, build, seed, restart.

Readiness is probed at `GET /api/health` — the one unauthenticated route. Status
goes to `ps-deploy.status`; logs to `ps-update.log` / `ps-build.log` /
`ps-restart.log`. Layout and flags: [DEPLOY.md](DEPLOY.md).

## Product intent

PatterStage is a command centre, not a file manager: the operator opens it and
knows what is running, what needs attention, and can dispatch in one or two clicks.

The rebuild sharpens that to four verbs — **found, commission, gate, watch** — over
Organisation → Venture → Project. See [docs/adr/](adr/).
