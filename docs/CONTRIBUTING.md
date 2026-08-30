---
summary: The quick path to a merged pull request, the code standards and the checks CI runs
type: policy
tags: [community, process]
compiled_from: normalised
---

# Contributing

If you've got this far thank you for considering to pitch in.

## Quick path to a merged PR

1. **Branch from `dev`** (not `main`).
2. **Build the thing:** fix, feature, or doc; match existing patterns in the tree you touched.
3. **Prove it** before you open the PR:

   ```bash
   npm run lint
   npm run canary:check
   npm run lint:knip
   npx tsc --noEmit -p tsconfig.json
   npm test
   npm run test:coverage
   npm run build
   ```

   `npm run lint` is nine gates chained, not just eslint: agent files, doc links,
   derived views, read-only guards, design lint, contrast, coverage floors,
   `eslint --max-warnings 0`, then `typecheck:tests`. `canary:check` (the output
   canary, see [OUTPUT_CANARY.md](OUTPUT_CANARY.md)) and `lint:knip` are **not**
   in that chain and block CI separately, which is why they are listed here.

4. **Open a PR into `dev`** with a clear title and what/why in the description.
5. **`main` only moves through reviewed PRs.** I merge `dev` → `main` when it is release-ready.

That is it. No secret handshake.

## Code standards (the boring but important bit)

- **TypeScript strict:** no `any`, no `@ts-ignore` without a fight.
- **API shape:** routes return `{ data?, error? }`.
- **Mutating routes:** respect `PS_READ_ONLY`, deploy gates (`PS_ENABLE_DEPLOY_API`), and signing where implemented (`src/lib/api-auth.ts`). Authentication and read-only are enforced globally in `src/proxy.ts`, by method, for every route -- do NOT add either check to a route handler. That is the whole point of the boundary, and a lint gate (`scripts/tooling/check-read-only-guards.mjs`) fails the build if a read-only guard reappears in a GET.
- **Paths:** validate filesystem writes under allowed roots; do not bypass the API to poke Hermes disk by hand from new code.
- **Do not commit junk:** `.next`, `coverage`, `test-results`, SQLite DBs, logs, `.env` with real keys.

If your change touches behaviour or config, **update docs in the same PR**. Stale docs are bugs.

## Where UI lives

- **`src/app/`**: App Router pages, layouts, and thin page shells only.
- **`src/components/`**: Shared and cross-cutting UI (`layout/`, `missions/`, `models/`, `schedule/`, `composer/`, `config/`, `viz/`, and the `ui/` primitives, among others).
- **`src/modules/<module>/components/`**: UI owned by one feature module, and the first place to look when a surface is not in `src/components/`. Story Weaver lives in `src/modules/rec-room/components/`; the Hermes surfaces in `src/modules/hermes/components/`.
- **`src/hooks/`**: Page data hooks and shared client hooks (e.g. `useModelsPage`, `useMissionsPage`, `useSchedules`).
- **Route groups and dynamic segments**: Parentheses and brackets in `src/app/` mean different things in the Next.js App Router:

| Folder pattern | Appears in URL? | Example |
|----------------|-----------------|---------|
| `(main)` | **No**, organizational only | `src/app/(main)/sessions/page.tsx` → **`/sessions`** |
| `orchestration` | **Yes** | `src/app/orchestration/missions/page.tsx` → **`/orchestration/missions`** |
| `[id]`, `[key]`, `[name]` | **Yes** (dynamic segment) | `src/app/api/models/[id]/route.ts` → `/api/models/:id` |
| `[...path]` | **Yes** (catch-all) | `src/app/api/skills/[...path]/route.ts` → `/api/skills/a/b/c` |

The **`(main)`** group keeps Dashboard at `/` ([`src/app/page.tsx`](../src/app/page.tsx)) while grouping Sessions, Memory, and Logs in one folder without a `/main/` prefix. This is standard Next.js behaviour. See [Route Groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups).

To add or change a sidebar surface, edit [`src/lib/modules/registry.ts`](../src/lib/modules/registry.ts) -- and only that. Both
[`src/components/layout/sidebar-config.ts`](../src/components/layout/sidebar-config.ts) and
[`tests/e2e/app-routes.ts`](../tests/e2e/app-routes.ts) are DERIVED from the registry (ADR-0005) and
say so in their own headers. They were once hand-mirrored, drifted apart, and silently dropped a whole
page from the navigation matrix; deriving them removed the class of bug. Do not hand-sync them.

## Local dev and tests

- First-time setup: `bash scripts/bootstrap/setup.sh` (writes `.env.local`, picks a free **PORT** in **42069–42100**, sets LAN dev origins).
- `npm run dev` / `npm run start` read `PORT` from the environment; the UI uses same-origin `/api/...` so it does not hardcode a port.
- **Playwright:** the 3000 pin is in the npm script, not in CI. `npm run test:e2e` is `cross-env PORT=3000 playwright test`, so it forces 3000 locally and in CI alike, over any `PORT` you exported. `.env.local`'s `PORT` never reaches the E2E suite: nothing in that chain loads it, and `playwright.config.ts` additionally passes `-p` to the server it starts so the `next start` child cannot pick up a different one either. To use another port, run `npx playwright test` directly with `PORT` set.
- Fresh DB before E2E: `npm run prebuild`. Full detail: **[TESTING.md](TESTING.md)** (Jest layout, smoke flag, and why `tests/e2e/app-routes.ts` needs no syncing).

## Git hooks and CI

- Optional **pre-push hook** ([`scripts/git-hooks/pre-push`](../scripts/git-hooks/pre-push)): blocks direct pushes to `main`. Install with `git config core.hooksPath scripts/git-hooks` from the repo root.
- **Branch protection on `main`** is the real gate (PR + checks).
- **[`ci.yml`](../.github/workflows/ci.yml)**, on a PR into `dev`: lint, **output canary**, **knip**, the Hermes-path gate, types, tests + coverage, build, E2E smoke (Ubuntu), build+test (macOS), `boot-smoke` (Ubuntu + macOS), shell script tests, the Docker **install harness**, and the Docker deploy smoke. The canary, knip and install-harness are the ones people trip on, because none of them is reachable from `npm run lint`.
- **Main only.** `e2e-full` (the whole Playwright suite) and `acceptance-gate` run on PRs targeting `main` and on manual dispatch; `real-hermes-integration` also runs on every push. They will not fire on your `dev` PR. Full detail in [TESTING.md](TESTING.md).
- **[`gitleaks.yml`](../.github/workflows/gitleaks.yml)**: please do not commit API keys. I will be grumpy.

## License

By contributing, you agree your contributions are licensed under the [Apache License 2.0](../LICENSE) (see [NOTICE](../NOTICE)). The Patter names and the visual identity under [`branding/`](../branding/) are reserved trademarks. They are **not** covered by that license. See [TRADEMARK.md](../TRADEMARK.md).

## Where to look

| Topic | Doc |
|-------|-----|
| Operator install | [README.md](../README.md) |
| UI walkthrough | [USER_WALKTHROUGH_GUIDE.md](USER_WALKTHROUGH_GUIDE.md) |
| Deploy / `ps-deploy` | [DEPLOY.md](DEPLOY.md) |
| API reference | [API.md](API.md) |
| Doc index | [README.md](README.md) |

Questions? Open an issue or ask in the PR. Concrete repro steps beat "it broke."
