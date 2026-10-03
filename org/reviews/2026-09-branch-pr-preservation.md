---
summary: Current branch, worktree and pull-request preservation ledger before consolidation
type: review
tags: [eos, git, release]
inspected_revision: cf43a4f75fc2d600b0b1a10a2ef06d649c91a701
inspected_at: 2026-09-27T12:28:00Z
---

# Branch and PR preservation, 27 September 2026

## Scope and method

This is the T-0171 evidence snapshot of `dev@cf43a4f7`, before any branch or
PR disposition. It covers 16 registered worktrees and two sibling validation
clones that are not in Git's worktree registry. It supersedes the
ref-containment and clean-worktree claims in
T-0003 and `org/plans/2026-08-consolidation.md` section 3 where the current
tree disagrees. It does not replace that task's historical record or authorise
a release. The primary checkout was clean at the inspected revision. Its later
T-0171 record commit is outside this snapshot.

Re-run `git worktree list --porcelain`, `git branch -vv`, `git status
--porcelain=v1` in each checkout, `git cherry dev HEAD`, and compare changed
file blob IDs with `git rev-parse dev:<path>`. Query remote heads with `git
ls-remote --heads origin`; query the PRs with `gh pr list --state open --json
number,headRefName,headRefOid,baseRefName,mergeable,url` and `gh pr view
<number> --json statusCheckRollup`. The three independent read-only passes
checked local state, remote PRs and #234's changed paths. A separate sceptic
checked for omissions. Counts and mergeability are time-bound observations;
repeat them before acting on a ref.

All four hosted workflows for the inspected `dev` SHA completed successfully:
push and PR CI, plus push and PR Gitleaks. PR CI included successful Ubuntu
and macOS builds, the full browser suite, real Hermes, install harness and
`acceptance-gate`. This establishes the T-0170 landing, not release acceptance
or the safety of another PR head.

## Local branches and registered worktrees

The shorthand `W/name` means
`C:/Users/Daniel/.codex/worktrees/name/PatterStage`. `P` means the primary
checkout. `M` is a tracked modification and `U` is a non-ignored untracked
file. No worktree had staged changes. A blob match compares a working file
with the same path on `dev@cf43a4f7`; it does not make the entire checkout
equivalent. Each worktree in this table must stay until its owner, ignored
state and all differing files are accounted for.

| Worktree and branch | HEAD | State at inspection | Preservation disposition |
| --- | --- | --- | --- |
| `P`, `dev` | `cf43a4f75fc2d600b0b1a10a2ef06d649c91a701` | clean; primary ignored data and credentials | Keep. Never use its live data for a validation build. |
| `W/refactor-foundations`, detached | `f3d81ccb6a366cebbaa11f2ee2b8e36b5e6bbf26` | 4 M, 3 U; 6 of 7 files differ from dev | Keep distinct review and tooling work. Attached to the active chat. |
| `W/t0152-oracle-readiness`, detached | `4af356d38cf1409bfd450a4acebae1cd4488295e` | 1 M; blob matches dev | Candidate only after owner and ignored-state check. |
| `W/t0157-oracle`, `feature/t0157-framework-auth-oracle` | `886c8c0e60085a6a9d4984352f06436d5696ebaf` | clean; one outside-dev commit has the same changed test blob on dev | Keep until its ignored database and seed state are classified. |
| `W/t0160-fixture-amendment`, detached | `5dddc23420cfb0e4b92a2854213706dcb5383707` | 3 M; one file differs | Keep the differing runner-contract test. |
| `W/t0160-independent-oracle`, detached | `40bfab866cd1bf6f4cf9c22dc97f45146e5c038c` | 1 U; blob matches dev | Candidate only after owner and ignored-state check. |
| `W/t0160-kill-attribution-oracle`, detached | `e9d10d05661c12c728ddf40d2ca73866629677bf` | 2 U; one file differs | Keep the differing oracle. |
| `W/t0160-negated-throw-oracle`, detached | `8ba9ba72bbb3cea9f04f067f897114b5e7686fe7` | clean; one patch-equivalent commit | Candidate for a managed snapshot after owner check. |
| `W/t0160-nested-stack-oracle`, `feature/t0160-nested-stack-oracle` | `54317ef46f9e31b27232a6481ef5dcccbfaf5fda` | clean; one patch-equivalent commit | Candidate after owner check; keep the branch until worktree disposition. |
| `W/t0160-oracle-amendment`, detached | `e383485880c56a0ac73b5e16a11fcca990fbef5d` | 2 M, 1 U; all three differ | Keep all three tests. |
| `W/t0161-final-seed-oracles`, detached | `ccb8c177c179d338472e5fc3c63c375fa1329aee` | clean; one patch-equivalent commit | Candidate after owner check; ignored `node_modules` only. |
| `W/t0161-hosted-recheck`, detached | `980dfdc3152f503549f971d49f800ab0d44e98bb` | 8 M, 3 U; four files differ | Keep differing work and `.gate/` evidence. Attached to the active chat. |
| `W/t0161-oracle`, detached | `0a5bb025bd5751329e44c7890084bb2c369abd2d` | clean; five patch-equivalent commits | Keep until ignored database, seed state and generated help are classified. |
| `W/t0161-review-oracle`, `feature/t0161-c8-shrink-oracle` | `87220821925191e3934546990a93c471a7917d73` | clean; two patch-equivalent commits | Candidate after owner check; retain the branch. |
| `W/t0166-models-oracle`, detached | `2fb9824e45b6b75165eace3487eefb6f903389d5` | clean; outside-dev commit has the same changed test blob on dev | Candidate for a managed snapshot after owner check. |
| `C:/Users/Daniel/.cursor/worktrees/hermes-control-hub/flkr`, `cursor/f7b69026` | `1d8eb52f0c037c5ab31297f79112dd72f868773e` | 13 M, 2 U; all 15 differ; ignored database | Keep. The old ancestor proof says nothing about these working files. |

The remaining local branch, `main@9b786b765160095d918ce09d8bcca47520bf5312`,
has no linked checkout. The three `feature/*` branches above and the Cursor
branch account for the other non-`dev` local branches. Ten outside-dev commits
were patch-equivalent by `git cherry`. The T-0157 and T-0166 oracle commits
were not patch-equivalent, but their changed test files had the same Git blob
IDs on `dev`; this is a content check, not a claim that their commit ancestry
is merged. No branch is removed by T-0171.

The exact working paths that differed from `dev@8537d364` in a follow-up
blob comparison were:

| Worktree | Differing relative paths |
| --- | --- |
| `W/refactor-foundations` | `org/QUESTIONS.md`, `org/STATE.md`, `org/TASKS.md`, `org/reviews/2026-09-decision-register.md`, `org/reviews/2026-09-refactor-addendum.md`, `scripts/tooling/review-ledger.mjs` |
| `W/t0160-fixture-amendment` | `tests/unit/t0160-runner-contracts.test.ts` |
| `W/t0160-kill-attribution-oracle` | `tests/unit/t0160-kill-attribution-amendment.test.ts` |
| `W/t0160-oracle-amendment` | `tests/unit/t0160-kill-attribution-amendment.test.ts`, `tests/unit/t0160-runner-contracts.test.ts`, `tests/unit/t0160-structured-kill-amendment.test.ts` |
| `W/t0161-hosted-recheck` | `docs/SECURITY.md`, `org/STATE.md`, `org/TASKS.md`, `scripts/tooling/line-census.baseline.json` |
| Cursor checkout | `src/app/agent/agents/page.tsx`, `src/app/agent/tools/page.tsx`, `src/app/gateway/page.tsx`, `src/app/globals.css`, `src/app/logs/page.tsx`, `src/app/memory/page.tsx`, `src/app/missions/page.tsx`, `src/app/sessions/page.tsx`, `src/app/skills/[...path]/page.tsx`, `src/components/ui/Card.tsx`, `src/components/ui/GlowSurface.tsx`, `src/components/ui/TemplateCard.tsx`, `src/lib/theme.ts`, `src/components/ui/ElectricPlasmaBorder.tsx`, `tests/unit/theme-accent-surfaces.test.ts` |

The remaining 13 modified or untracked entries in registered worktrees had
working blobs identical to `dev` at that follow-up. The primary checkout's
new T-0171 report also differed, as intended. The follow-up's 31 differing
paths therefore comprise 30 preserved worktree files plus this report. The
Cursor files predate the later C7 paths, so a matching name is not enough to
apply them to the current tree.

The primary checkout has ignored `.env.local`, database and backup files,
`data/auth-token`, `.gate/`, `.claude/` and generated `public/help`. The
T-0157 and T-0161 oracle checkouts have ignored databases, and the latter
also has `public/help`. The Cursor checkout has ignored
`data/control-hub.db`. These are presence classifications only: credential
and database contents were neither read nor copied into this report. Other
ignored paths are mainly dependencies, coverage, build output and TypeScript
cache. No exact worktree path appeared in a running process command line;
that cannot prove an editor or paused chat has released it.

### Independent sibling clones

Two directories beside the primary repository are separate Git clones, not
entries in `git worktree list`. `PatterStage-gate-8d98` is detached at
`980dfdc3152f503549f971d49f800ab0d44e98bb` with 17 changed paths and
ten ignored entries. Its independent Git store also holds
`checkpoint/t0156-validation@c6b80a36` and `stash@{0}` at `d1fcaa5e`, named
`T-0169 validation snapshot before T-0170 gate`. Preserving only its working
files would lose both the checkpoint ref and stash.

`PatterStage-validation` has a `dev` checkout at
`f3d81ccb6a366cebbaa11f2ee2b8e36b5e6bbf26`, 85 commits behind its
configured upstream and 155 behind primary `dev@8537d364`. Its dirty tree
has 185 default status lines, expanding to 201 changed paths when untracked
files are listed individually, plus 15 ignored entries and no stash. Neither
clone has a commit outside primary dev's ancestry. This does not establish
that their working files are contained.

The follow-up working-blob comparison against primary `dev@8537d364` found
four differing files of 17 in the gate clone: `org/STATE.md`, `org/TASKS.md`,
`org/claims.json` and `org/tasks/T-0170.json`. It found 15 differing paths
among the validation clone's 201: `docs/contributing/testing.md`,
`org/HANDOVER.md`, `org/STATE.md`, `org/TASKS.md`, `org/claims.json`,
`package.json`, `scripts/bootstrap/setup.mjs`, `scripts/bootstrap/setup.sh`,
`scripts/tooling/line-census.baseline.json`,
`src/app/help/[[...slug]]/page.tsx`, `src/lib/fs/fs-helpers.ts`,
`tests/unit/c8-the-programme-is-closed.test.ts`, `org/tasks/T-0161.json`,
`tests/unit/t0161-discovery-errors.test.ts` and
`tests/unit/t0161-state-import-completeness.test.ts`. Two other paths,
`.npmrc` and `test-harness/hermes-home/hermes.env`, were left unverified to
avoid inspecting potentially sensitive contents. The other 184 validation
file blobs matched primary dev. These are file-content comparisons, not a
reason to remove old test results, databases or the Git stores.

The gate clone also has 239 ignored `.gate/` files and 48 ignored `tmp/`
files; validation has 42 `.gate/` files, 92 `tmp/` files, an ignored database
with WAL/SHM, seed state and an audit log. Both have generated help and build
outputs. Status and stash checks ran inside each clone without changing Git
configuration. Both are retained; their objects, refs, working files and
necessary ignored state require explicit preservation before closure.

## Remote heads and open PRs

`git ls-remote --heads origin` returned exactly 15 heads: `main`, `dev` and
the 13 non-base heads below. `gh pr list` returned 14 open PRs, one for each
of those 13 heads plus #157 from `dev` to `main`. The exact remote head SHA
matched each PR's `headRefOid` at inspection.

| PR | Remote branch and head SHA | Current disposition |
| --- | --- | --- |
| [#157](https://github.com/Daniel-Parke/PatterStage/pull/157) | `dev` `cf43a4f75fc2d600b0b1a10a2ef06d649c91a701` | Keep for the operator's release promotion. Merge and release remain operator actions under Q-011. |
| [#234](https://github.com/Daniel-Parke/PatterStage/pull/234) | `feature/healthz-liveness-endpoint` `5435cbe8ab6eab31f810c9fc5d37e33db28238b6` | Conflicting old head; T-0170 on dev carries its behaviour. Candidate to close as superseded, retaining provenance. |
| [#236](https://github.com/Daniel-Parke/PatterStage/pull/236) | `dependabot/github_actions/dev/actions/deploy-pages-5` `a54a1e0fddcb4b09e25c1ef98bff8505b0f13ed8` | Keep with #235 until the matched Pages action update is gated. |
| [#235](https://github.com/Daniel-Parke/PatterStage/pull/235) | `dependabot/github_actions/dev/actions/upload-pages-artifact-5` `c708426c983c0ca5f3ae38da588a9e368adb1337` | Keep with #236. Neither Pages version change is on dev. |
| [#233](https://github.com/Daniel-Parke/PatterStage/pull/233) | `dependabot/npm_and_yarn/dev/multi-9b1536b8cd` `5e03124f785471d7ad6919437ebd1fc0a02048db` | Do not merge as-is: React 19.2.8 is proposed without matching `react-dom`. Retain the version intent for a paired update. |
| [#232](https://github.com/Daniel-Parke/PatterStage/pull/232) | `dependabot/npm_and_yarn/dev/lucide-react-1.33.0` `2e42c6bccb1cc7ab2c6dd94fdbb16e95b31be6b3` | Unique lucide version proposal; gate on current dev before closure. |
| [#231](https://github.com/Daniel-Parke/PatterStage/pull/231) | `dependabot/npm_and_yarn/dev/eslint-config-next-16.3.2` `2c2a47c3aa2fa705ab7f8895dc376640d84f7c17` | Superseded: proposes 16.3.4; dev already pairs Next and eslint-config-next 16.3.6. Candidate to close. |
| [#230](https://github.com/Daniel-Parke/PatterStage/pull/230) | `dependabot/npm_and_yarn/dev/tailwindcss/postcss-4.3.3` `ee44a429e7c3272459db7f07fdb153bc011ab456` | Unique PostCSS version proposal; gate on current dev. |
| [#229](https://github.com/Daniel-Parke/PatterStage/pull/229) | `dependabot/npm_and_yarn/dev/dagrejs/dagre-3.1.1` `4463dfbf71b09f11d4902f24b7c99df5ee66e886` | Unique Dagre version proposal; gate on current dev. |
| [#228](https://github.com/Daniel-Parke/PatterStage/pull/228) | `dependabot/npm_and_yarn/dev/playwright/test-1.62.1` `96d917150ca142c4e222678cd9da09fa15a83b56` | Unique Playwright proposal; may move census and screenshots. Gate separately. |
| [#227](https://github.com/Daniel-Parke/PatterStage/pull/227) | `dependabot/npm_and_yarn/dev/knip-6.32.2` `8ecfe3d76266bcf4abb79b817e9684682f8e8200` | Unique Knip proposal; gate separately because findings may change. |
| [#226](https://github.com/Daniel-Parke/PatterStage/pull/226) | `dependabot/npm_and_yarn/dev/tsx-4.23.12` `d86fe8509145d6607e6432a9e154e073cfa1b8e1` | Unique tsx version proposal; gate on current dev. |
| [#225](https://github.com/Daniel-Parke/PatterStage/pull/225) | `dependabot/npm_and_yarn/dev/xyflow/react-12.11.3` `62f4b74d81d0518b446c37cfdc34bf5b10d5c6f4` | Unique xyflow version proposal; gate on current dev. |
| [#224](https://github.com/Daniel-Parke/PatterStage/pull/224) | `dependabot/npm_and_yarn/dev/tanstack/react-query-5.102.2` `a0670968c31a29d612e1be3c897cb2b50011b35b` | Unique React Query version proposal; gate on current dev. |

All 12 Dependabot PR patches change only dependency versions in the manifest
and lockfile, or one Pages workflow action reference. Their last completed
Ubuntu and macOS builds failed on old heads in early September; the failure
does not prove a defect in each proposed dependency. All old npm heads include
Next 16.2.9, so merging an old branch cannot substitute for a version update
and full gate against current `dev`. Do not close a unique-version PR until
its proposed update is landed or deliberately deferred with a recorded reason.

## PR #234 contribution check

The [public comment](https://github.com/Daniel-Parke/PatterStage/pull/234#issuecomment-5813898783)
identified moved `docs/API.md` and `docs/TESTING.md` paths and supplied a
rebased fork. T-0170 resolved the current paths in `docs/reference/api.md` and
`docs/contributing/testing.md`. An independent seven-path comparison found
equivalent liveness handlers and the same three-entry proxy `PUBLIC_PATHS`.
The PR's proxy-auth assertion is covered in the separate five-test T-0170
oracle, including an additional read-only case. Its header-stringification
assertion was not copied verbatim; the exact `ok` body and no-store response
are asserted. The independent check reran three focused suites, 60/60 pass,
and the document-link checker found all links valid. This is behavioural
equivalence, not a byte-identical merge or a claim that every PR test name
was moved. The PR remains open at this snapshot.

## Safe sequence and unresolved authority

1. Keep PR #157, `main` and `dev`. The current green acceptance gate does
   not itself merge #157, enable required checks, run the operator's real
   installation matrix, or cut a release.
2. Close #234 as superseded by T-0170 after recording its contribution and
   exact head. Close #231 as superseded by the paired 16.3.6 update. Do not
   delete their remote branches until the ref-retention and external-action
   authority is settled. #233 cannot merge without a matching React DOM
   version; a paired replacement preserves the upgrade intent.
3. Carry the remaining unique dependency changes onto current `dev` in
   coherent gated batches. Pair the Pages actions. Keep Knip and Playwright
   distinct because each can change a gate's evidence. Close each old PR only
   after its replacement has passed the full gate and hosted checks.
4. Preserve every dirty or unclassified checkout. For any candidate archive,
   check owner use, ignored data and exact changed files immediately before
   using the managed snapshot path. A merged or patch-equivalent tip alone is
   insufficient. Do not force-remove a worktree or delete a branch to make
   the list look shorter.
5. Continue T-0158 security and the remaining reconnaissance. Q-011 places
   structural cleanup after the operator's release. The old T-0003 target of
   only `dev` and `main` cannot honestly be declared met by this snapshot.

No branch, worktree, PR, release or repository setting was changed in T-0171.
