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
   npx tsc --noEmit -p tsconfig.json
   npm test
   npm run test:coverage
   npm run build
   ```

4. **Open a PR into `dev`** with a clear title and what/why in the description.
5. **`main` only moves through reviewed PRs.** I merge `dev` → `main` when it is release-ready.

That is it. No secret handshake.

## Code standards (the boring but important bit)

- **TypeScript strict:** no `any`, no `@ts-ignore` without a fight.
- **API shape:** routes return `{ data?, error? }`.
- **Mutating routes:** respect `PS_READ_ONLY`, deploy gates (`PS_ENABLE_DEPLOY_API`), and signing where implemented (`src/lib/api-auth.ts`). There is no global API-key wall; run PatterStage on a network you trust or put your own proxy in front.
- **Paths:** validate filesystem writes under allowed roots; do not bypass the API to poke Hermes disk by hand from new code.
- **Do not commit junk:** `.next`, `coverage`, `test-results`, SQLite DBs, logs, `.env` with real keys.

If your change touches behaviour or config, **update docs in the same PR**. Stale docs are bugs.

## Where UI lives

- **`src/app/`**: App Router pages, layouts, and thin page shells only.
- **`src/components/`**: Reusable UI (layout, missions, models, cron, story-weaver, `ui/` primitives).
- **`src/hooks/`**: Page data hooks and shared client hooks (e.g. `useModelsPage`, `useMissionsPage`, `useCronJobs`).
- **Route groups and dynamic segments**: Parentheses and brackets in `src/app/` mean different things in the Next.js App Router:

| Folder pattern | Appears in URL? | Example |
|----------------|-----------------|---------|
| `(main)` | **No**, organizational only | `src/app/(main)/sessions/page.tsx` → **`/sessions`** |
| `orchestration` | **Yes** | `src/app/orchestration/missions/page.tsx` → **`/orchestration/missions`** |
| `[id]`, `[key]`, `[name]` | **Yes** (dynamic segment) | `src/app/api/models/[id]/route.ts` → `/api/models/:id` |
| `[...path]` | **Yes** (catch-all) | `src/app/api/skills/[...path]/route.ts` → `/api/skills/a/b/c` |

The **`(main)`** group keeps Dashboard at `/` ([`src/app/page.tsx`](../src/app/page.tsx)) while grouping Sessions, Memory, and Logs in one folder without a `/main/` prefix. This is standard Next.js behaviour. See [Route Groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups).

When you add or change sidebar links in [`src/components/layout/sidebar-config.ts`](../src/components/layout/sidebar-config.ts), update [`tests/e2e/app-routes.ts`](../tests/e2e/app-routes.ts) so Playwright navigation-matrix tests stay aligned.

## Local dev and tests

- First-time setup: `bash scripts/bootstrap/setup.sh` (writes `.env.local`, picks a free **PORT** in **42069–42100**, sets LAN dev origins).
- `npm run dev` / `npm run start` read `PORT` from the environment; the UI uses same-origin `/api/...` so it does not hardcode a port.
- **Playwright:** CI pins `PORT=3000`; locally follow `.env.local` unless you export `PORT` yourself.
- Fresh DB before E2E: `npm run prebuild`. Full detail: **[TESTING.md](TESTING.md)** (Jest layout, smoke flag, keeping `tests/e2e/app-routes.ts` in sync with the sidebar).

## Git hooks and CI

- Optional **pre-push hook** ([`scripts/git-hooks/pre-push`](../scripts/git-hooks/pre-push)): blocks direct pushes to `main`. Install with `git config core.hooksPath scripts/git-hooks` from the repo root.
- **Branch protection on `main`** is the real gate (PR + checks).
- **[`ci.yml`](../.github/workflows/ci.yml)**: lint, types, tests + coverage, build, E2E smoke (Ubuntu), build+test (macOS), shell script tests, Docker deploy smoke.
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
