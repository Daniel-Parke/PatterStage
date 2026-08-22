---
summary: The approved 2026-08 consolidation programme, phases 0-7 plus release, rows WO-0020 to WO-0029, rulings D1-D14
type: venture
tags: [plan]
status: approved
approved_by: Daniel Parke (operator), 2026-08-22, at plan approval
session: S-0002 (PLAN)
compiled_from: preserved
---

# PatterStage Consolidation Programme · approved plan

> Produced by PLAN session S-0002, verified against the tree at `d36eb817`
> (dev, clean) by 8 parallel read-only verifiers, then hardened by two
> independent critique passes (governance compliance; execution risk).
> **Approved by the operator 2026-08-22**, with four direct rulings folded in
> (D1, D3, D13, D14 in §9). Sessions read this file from disk; it outranks any
> memory of the conversation that produced it.
> Precedence: `org/CONSTITUTION.md` > repo governing files > this plan.

## 1 · Context

PatterStage (public, Apache-2.0-on-dev, Next.js + embedded SQLite control plane
for Hermes) is a standalone product with outside users. The commissioned
programme: fix the few real bugs, delete dead weight, group the flat `src/lib`,
split god files, pull SQL through the repository seam, restore doc truth, land
shrink-only ratchets — behaviour-preserving except where a row sanctions change.
Plus the consolidation order: everything still required lands on `dev`, **no
branches except `dev` and `main`**, and a clean, fresh `dev` → `main` PR.

## 2 · Inventory reconciliation — where the tree corrects the brief

**Confirmed exactly, no drift:** src/lib 109 files + 19 dirs; all 18 god-file
line counts; useMissionsPage 16 useState (9 bare/7 generic) + 3 useEffect; all
six domain groupings (`dashboard-model-subscribe.ts` does not exist); design-lint
baseline sum **918** (188 entries; `sql-outside-repository` 19 files/57 sites;
`hermes-outside-adapter` 13 files/21 crossings); knip 38/18/2/1/11 (the 2
unresolved are exactly the broken script imports; the duplicate is `db`/`getDb`);
one migration chain, 29 `.sql` (010 absent by design), 26 appliers to v30;
MIGRATION.md stale at :57/:79/:104; ch-shim reference map as briefed;
`session-sync.ts:240` self-heal + `lastOrphanCloseCount` real.

**Drift found (tree wins; each recorded on the governing row/QUESTIONS at approval):**

| # | Brief said | Tree says |
| --- | --- | --- |
| D-1 | CI red = e2e-smoke + docker-image | **Three** red jobs: also `real-hermes-integration` ("SMOKE FAILED (2 assertions)"), push-only (`ci.yml:291`) so PR-check views miss it → new row WO-0020 in Phase 0. |
| D-2 | docker-image "undiagnosed" | Diagnosable from its log: harness probes `PS_DOCKER_TEST_PORT=42090`; the containerised app boots healthy on **42069** (token minted fine) → readiness loop can never pass. Harness/env port plumbing, not the image. |
| D-3 | WO-0011: add install-harness, **remove docker-image** from required checks | Branch protection on main has `required_status_checks.contexts = []` — **zero** required checks. Nothing to remove; the click is add-only. (Also: 1 approving review + code-owner review; `enforce_admins=false`.) Lock-book §WG-OPS-002 body (:188-190) says otherwise and gets a sanctioned correction. |
| D-4 | STATE says baseline 919 | Actual 918 → STATE corrected at first touch citing START's "code and tests outrank notes". |
| D-5 | 19 appliers exec `.sql`, "a few" embed TS | 19 via `execMigrationFile`, **4 `readFileSync` numbered `.sql` directly** (002-scan/003/004/015), 3 pure-TS (v7/v9/v30). Ladder quirks: no v6, no v10; 007/008 inert markers. |
| D-6 | Upgrade test asserts v30 | As a **hardcoded literal ×3** (:128/:169/:192); no head constant exists. `tests/jest.setup.ts:116-133` mocks `@/lib/db`, so the constant must live in **`src/lib/db-schema.ts`** (unmocked, lint-exempt by name) — not db.ts. |
| D-7 | 19 `{ db }` callers | **40 import lines** pull `db` (19 via `@/lib/db` + 21 via relative `./db`/`../db`), 3 pull `getDb`; internal `db()` call at `db.ts:113` too. Instruction stands; scope doubles. |
| D-8 | Blast radius of broken imports | Larger: 5 docs + `data/seed/README.md` print the broken `db:seed` command; `tests/scripts/README.md:12` also stale on `ch-hermes-profile-templates.sh`. |
| D-9 | fieldkit branch "remote-only" | Already deleted on origin; only a **stale local remote-tracking ref** remains → `git fetch --prune`. |
| D-10 | — | **PR #157 dev→main ("promote… rename + relicense") is already open**, head `d36eb817`, red on the Phase 0 jobs. It is the mission's dev→main PR. |
| D-11 | — | Origin carries **13 `dependabot/*` branches** + 12 open Dependabot PRs → decision Q-D14. |
| D-12 | — | Lock-book frontmatter: five ruling notes are literally "undefined" (WG-DEL-001/002/003, WG-OPS-002/004); full texts recoverable from `docs/eos-session0/WALK_RAW.json`/`CORRECTIVE_RAW.json` → QUESTIONS. |
| D-13 | — | `org/logs/` empty (no session log ever written), `org/plans/` absent, `org/decisions/` empty while 5 ADRs live in `docs/adr/` → QUESTIONS + ADR-0007 (§10). |
| D-14 | — | `design-lint --update-baseline` is shrink-only by doctrine, not mechanism (would grow after a regression) → suggestion filed: refuse-to-grow guard. |
| D-15 | — | No CI run on dev since 2026-07-27; public `main` is 203 commits behind, MIT, **pre-S1-security-hotfix**. RULED (D13, 2026-08-22): one release at programme end — the operator accepts main staying pre-hotfix for the duration; recorded in STATE so no session re-litigates. |
| D-16 | db.ts residual sites | The 6 baselined sites include `db.ts:303` (`SELECT COUNT(*) FROM mission_categories` in `getSchemaHealth`) — neither probe nor migration plumbing. Disposition table §6 accounts for it. |
| D-17 | — | The Cursor worktree's gitdir back-pointer targets the **pre-rename repo path** (`…/hermes-control-hub/.git/worktrees/flkr`), which no longer exists — git dies inside it, so dirtiness is unknowable until `git worktree repair`. WO-0028 sequences repair → clean-check → remove, `--force` forbidden. |

## 3 · Branch and worktree consolidation (mission addition)

Every stray ref's content is already contained in `dev`. **Nothing needs merging;
consolidation is pure deletion**, proven per-ref:

| Ref | Proof | Disposition |
| --- | --- | --- |
| `cleanup/consolidation-ux` (local; tip `e00b9934`; upstream gone) | Tip tree **byte-identical** to the PR #189 squash commit `bef00ba7` on dev (`git diff bef00ba7 e00b9934` empty) | `git branch -D` |
| `origin/feat/benchmarks-trustworthy-fieldkit` (stale tracking ref; tip `9761d313`) | 100% of its 34-file diff landed as the PR #201 squash `8e989084`; sole tree delta is one dev-side file it never touched. Its benchmark subsystem was **later deliberately deleted from dev** (`4935ac31`) — nothing may be re-merged | `git fetch --prune` (already gone on origin) |
| `cursor/f7b69026` (local; tip `1d8eb52f`; in Cursor worktree) | True ancestor of dev; never pushed; no PR | `git worktree repair` → prove clean → `git worktree remove` → `git branch -d` (D-17; no `--force`) |
| `dependabot/*` ×13 on origin (+12 open PRs) | Dependency bumps; out of programme scope | Per Q-D14 |
| `main` | dev..main = 0 | Stays; receives the releases |
| Stashes / tags / dangling commits | none / none / 32 May-2026 Dependabot remnants | Nothing to do |

End state: heads = `dev`, `main` (+ whatever Q-D14 leaves); the live dev→main PR
is #157 or its successor.

## 4 · Programme structure

Phases in order; a phase closes when its done-when holds, its gate suite is
green, and a VERIFY session closes the row. WIP is 1.

```
Phase 0   WO-0018 + WO-0020            green line (three red jobs, not two)
Phase 0b  WO-0028                      branch/worktree consolidation (independent, cheap)
Phase 1   WO-0021 → WO-0022 → WO-0023  bugs, dead weight, shims
Phase 2   WO-0008                      the move canary
Phase 3   WO-0024                      domain folders (six domains + scoped 3b)
Phase 4   WO-0025                      god-file decomposition
Phase 5   WO-0026                      repository-seam pull-through (hosts D8 move)
Phase 6   WO-0027                      migration truth + going-forward rule
Phase 7   WO-0004 → WO-0007 → WO-0010 → WO-0009 → WO-0013   (strict order)
Release   ONE release, at programme end (D13 ruling): full local Playwright
          matrix + real-Hermes gate + upgrade test, results recorded; then the
          operator merges the refreshed PR #157 dev→main
Anytime   WO-0029 (protected-set amendment WO; only after ADR-0006 is signed)
```

Surfaced, not taken: WO-0001 (per Q-D1), WO-0011 operator half (per D-3:
add-only click), WO-0012, WO-0014 (needs rewrite), WO-0019 (independent; its
diagnostic is already on the row; any WORK session after Phase 0),
WO-0015/0016/0017. Done rows sitting in Ready → operator formatting question.

## 5 · New queue rows (written into `org/QUEUE.md` at approval)

Every row below carries `plan: org/plans/2026-08-consolidation.md` and has the
operator's D-rulings folded in as inline lines at approval, so a cold session
resolves everything from the queue and the committed plan alone (the committed
plan includes Appendix A's file lists verbatim). The queue's Ready preamble
gains one sanctioned line admitting approved-plan warrants (PLAN owns the text).

### WO-0020 · real-hermes-integration is red on dev push runs
- type: FIX · tier: T2 · priority: P0 · status: ready
- warrant: WG-DEL-004 + Part II Art. 6; found by this plan's CI verification
  (run 30226692050, job 89857954990, "SMOKE FAILED (2 assertion(s))");
  push-only per `ci.yml:291`, hence invisible in PR views and absent from WO-0018.
- acceptance: [ ] the two failing assertions identified from the job log and the
  cause diagnosed from evidence · [ ] fixed without weakening the smoke (no
  assertion deleted, no retry added) · [ ] row note records why a push-only job
  hid it and puts the "also run on pull_request?" choice to the operator
- done when: the dev push run is green on real-hermes-integration.

### WO-0021 · Fix the two broken script imports and close both gates behind them
- type: FIX · tier: T2 · priority: P0 · status: ready
- warrant: WG-OPS-002 (`setup.sh:248/:283`, `setup.mjs:158/:161`,
  `ps-deploy.mjs:426/:428`, `db:seed` all reach the broken imports).
- behaviour change sanctioned: yes — bug fixes, flagged in commits.
- acceptance: [ ] `ensure-hermes-model-sync.ts:55` →
  `../../src/modules/hermes/lib/config-sync`; `import-hermes-state.ts:56` →
  `../../src/modules/hermes/lib/state-import` (modules do NOT move) ·
  [ ] `npm run db:seed` completes; deploy path smoke-tested; the 6 doc files
  printing the command re-checked (D-8) · [ ] `lint:knip` gate gains
  `unresolved` AFTER the fix (widening first reddens CI) · [ ] `db` alias
  deleted (`db.ts:82`); **all 40 `db`-importing lines** (19 `@/lib/db` + 21
  relative) migrated to `getDb`, plus the internal `db()` call at `db.ts:113`;
  design-lint `.exec(` receiver list confirmed unchanged · [ ] proof a future
  unresolved import fails CI
- done when: both scripts run against real homes, the gate catches recurrence,
  `getDb` is the single name.
- merge gate: real-Hermes suite (touches the Hermes config/state path).

### WO-0022 · Delete the dead exports and make the full knip report clean signal
- type: MAINT · tier: T2 · priority: P1 · status: ready
- warrant: approved-plan warrant (sanctioned at approval per Q-D2).
- input: the full knip report photographed verbatim into **WO-0018's row notes**
  (an acceptance box added to WO-0018 by this plan's amendment).
- acceptance: [ ] the 38 unused exports + 18 unused types deleted per D5's
  ruling, **except `NEUTRAL_COLUMN_NAMES_SCHEMA_VERSION`
  (`apply-neutral-column-names.ts:35`) — reserved for WO-0027's head-constant
  tie** · [ ] any export D5 keeps gets a knip suppression (`/** @public */` or
  `knip.json` ignore) with a reason, so the widened gate still lands at zero ·
  [ ] `LevelBadge` (+ baseline key :84) and `ChipGroup` (+ :145) deleted in the
  same commits · [ ] the 7 OS binaries added to `ignoreBinaries` (5 entries
  exist) · [ ] gate widened to
  `files,dependencies,unlisted,unresolved,exports,types,duplicates,binaries`
  at zero · [ ] `engines` field added to package.json per D9 (Node >=20; CI
  pins 20 in five places) · [ ] baseline keys for deleted files removed in the
  same commits
- done when: the full report is empty or every surviving line carries a
  recorded sanction, and none of it can regrow silently.

### WO-0023 · Retire the ch-* shim references the repo still exercises
- type: OPS · tier: T2 · priority: P1 · status: ready
- warrant: WG-OPS-002 (CI's install proof executes a file marked "Remove later").
- acceptance: [ ] `test_full_install_update_process.py:826/:942` invoke
  `ps-deploy.sh` directly · [ ] its line-27 docstring (nonexistent
  `ch-deploy-impl.sh`) and ch-deploy mentions at lines 6, 418, 926, 1013, 1053,
  1315 swept · [ ] `tests/scripts/README.md:12` updated incl. stale
  `ch-hermes-profile-templates.sh` (real: `scripts/lib/ps-hermes-profile-templates.sh`) ·
  [ ] shims per D4's ruling (recorded on the row at approval; default: keep
  `ch-deploy.sh` through v1.0 with a deprecation warning line; delete
  zero-referenced `ch-migrate.sh` now) · [ ] left alone with reasons noted:
  `docs/MIGRATION.md:31`, `deploy-status.ts:25`, `update-api.test.ts:331`
- done when: nothing executes or documents a ch-* path except sanctioned
  back-compat strings.

### WO-0024 · Domain folders for the flat library
- type: REFACTOR · tier: T2 · priority: P1 · status: ready · blocked-by: WO-0008
- warrant: WG-ARCH-006 + approved-plan warrant.
- scope: the six domain file lists in the committed plan's **Appendix A**
  (missions 22 · sessions 9 · memory 7 · git 3 · fs 5 · dashboard 6).
- acceptance: [ ] one move commit per domain: ONLY moves + mechanical import
  updates + mandatory riders (baseline re-keys at identical counts,
  `check-doc-links`, `docs/REPO_GUIDE.md` map, `tests/e2e/app-routes.ts` if
  routes touched) · [ ] D10's `dashboard-helpers.ts` merge-into-callers is its
  own **non-move commit** inside the row · [ ] canary proves every move commit
  output-neutral · [ ] tripwires: no Hermes-touching file enters a lint-exempt
  prefix; Turbopack-traced paths stay string-concatenated; nothing merges into
  `src/lib/modules/` · [ ] Phase 3b by name: `skills/` (skills-grouping,
  skills-page-helpers, skills-repository), `chat/` (chat-repository,
  chat-utils); the remaining top-level `*-repository.ts` files move only WITH
  their domain, never as a "repositories/" bucket · [ ] `src/lib/db.ts` does
  not move (that is WO-0026's final commit)
- done when: six domains complete, top level ≈64 before 3b, every move proved
  neutral, baselines re-keyed never grown.

### WO-0025 · God-file decomposition
- type: REFACTOR · tier: T2 · priority: P1 · status: ready · blocked-by: WO-0008
- warrant: WG-ARCH-006 + approved-plan warrant.
- scope: the 18 files in Appendix A (with verified line counts); 400 ceiling /
  350 target; exceptions carry reasons in row notes + header comment.
- acceptance: [ ] one file per work item, split by responsibility ·
  [ ] `useMissionsPage` → focused hooks; `useMissionsApi`/`useSchedules`/
  `useDashboard` NOT folded into `useApiResource` · [ ] `session-sync.ts` split
  preserves `ensureMessageCountColumn` (D6) and `lastOrphanCloseCount`; **all
  13 SQL sites stay in place** (re-keyed at identical counts if their file
  paths change) — their migration is WO-0026's, not this row's ·
  [ ] `config-sync.ts` split keeps every config.yaml write inside
  `writeHermesConfigFile`; `config-cache-invalidation.test.ts` green
  throughout · [ ] auth stays out of route handlers in the 4 API-route splits ·
  [ ] `VersionFooter` split re-keys its hermes-outside-adapter entry ·
  [ ] compatibility re-exports deleted in the row's final commit or their
  retention justified on the row
- done when: every listed file ≤400 (350 norm), callers migrated, full suite +
  config-cache-invalidation + e2e smoke green.

### WO-0026 · Repository-seam pull-through
- type: REFACTOR · tier: T3 · priority: P1 · status: ready · blocked-by: WO-0025
- warrant: WG-ARCH-002 (B, unmet).
- scope: the disposition table in the committed plan §6 (Appendix A carries it).
- acceptance: [ ] 18 files clear entirely per dispositions; the **two
  Hermes-`state.db` reads (`session-sync.ts:77/:92`) go to the runtime adapter
  (`src/lib/runtime/`), NOT a `*repository*` file** (a repository name would
  drop them out of lint sight via the `/repository/i` exemption) ·
  [ ] `db.ts`: `getGatewayPlatforms` (:99) and `getSchemaHealth`'s queries
  (:295/:303) extracted to repositories; residual = 3 plumbing sites (:133
  probe, :162/:179 migration execs) with reasons on the row · [ ] baseline
  entries deleted in the same commits; count only ever falls via migration ·
  [ ] final commit, per D8: `db.ts` → `src/lib/db/index.ts` as its own
  canary-proved neutral move (keeps `@/lib/db` byte-identical; smoke
  `scripts/tooling/migrate-db.ts`, whose relative dynamic import at :82 may
  need `/index`); the file becomes exempt-by-location and its 3-site baseline
  entry is deleted **by the sanctioned move, recorded as such** ·
  [ ] `.exec(` receiver gap NOT chased (parser; WG-WEB-013-carried) ·
  [ ] one `meta`-table repository serves both config-cache and the scheduler
  lease (not two) · [ ] VERIFY diffs a sample of migrated queries against git
  history for changed semantics; scheduler extraction preserves the deliberate
  try/catch swallows (`BackgroundScheduler.ts:36/:48`)
- done when: `sql-outside-repository` measured count is **0** — 54 sites
  removed by migration, 3 by the sanctioned D8 relocation with reasons.
- merge gate: real-Hermes suite + upgrade-path test; G3 operator approval.

### WO-0027 · Migration truth and the going-forward rule
- type: FIX · tier: T2 · priority: P1 · status: ready
- warrant: lock-book enforced contract "Migration history is a record, not a
  description"; the defect is doc/test drift (v13/v11 claimed vs v30 real).
- acceptance: [ ] `docs/MIGRATION.md:57/:79/:104` corrected to v30 ·
  [ ] head constant minted in **`src/lib/db-schema.ts`** (unmocked by
  `tests/jest.setup.ts:116-133`, already imported by the upgrade test, exempt
  by name in design-lint) and asserted equal to the last applier's gate
  (`NEUTRAL_COLUMN_NAMES_SCHEMA_VERSION`, reserved by WO-0022); the three
  hardcoded 30s at :128/:169/:192 tied to it — strengthened, never weakened ·
  [ ] going-forward rule written (home per D11/ADR-0007): new numbered `.sql`
  + version-gated applier exec'ing it, appended to the hand-wired order; the 4
  `readFileSync` appliers + 3 pure-TS appliers recorded as historical
  exceptions (D-5); ladder quirks (no v6/v10, 007/008 markers) documented;
  shipped migrations immutable · [ ] D6's session-sync self-heal ruling
  recorded here so lint comment and file agree
- done when: MIGRATION.md matches code and doc/test cannot drift apart again.
- merge gate: upgrade-path test.

### WO-0028 · One repo, two branches: delete the merged strays
- type: OPS · tier: T2 · priority: P1 · status: ready
- warrant: approved-plan warrant (the operator's consolidation order).
- tier justification (on the row): deletions are of refs whose content is
  proven contained in dev (§3 proofs recorded in the committed plan); local
  reflog retains 90 days; hence T2 not T3.
- acceptance — agent half: [ ] `git branch -D cleanup/consolidation-ux`
  (tip `e00b9934` tree byte-identical to squash `bef00ba7`) ·
  [ ] `git fetch --prune` clears the stale fieldkit tracking ref; no benchmark
  code re-merged (deleted from dev by design, `4935ac31`) ·
  [ ] Cursor worktree: `git worktree repair <path>` first; `git -C <path>
  status --porcelain` must come back EMPTY before `git worktree remove`;
  `--force` forbidden — if repair fails or the tree is dirty, stop and hand
  the operator the listing · [ ] then `git branch -d cursor/f7b69026` ·
  [ ] Dependabot per the D14 ruling (close + pause until programme end): agent
  half closes the open Dependabot PRs via `gh` (branches auto-delete) ·
  [ ] end state verified: `git for-each-ref` + `git ls-remote --heads origin`
  show dev + main only; **PR #157 remains the open dev→main PR** (it merges
  only at the final release, per the D13 ruling)
- acceptance — operator half (WO-0011-style, outside any commit):
  [ ] pause/snooze Dependabot in GitHub settings for the programme's duration;
  re-enable at the final release
- done when: the ref landscape is dev, main, and nothing unsanctioned.

### WO-0029 · Amend WORK.md's branch-from-main to match practised doctrine
- type: DOCS · tier: T3 · priority: P2 · status: blocked (on ADR-0006 signature)
- warrant: ADR-0006 (proposed at plan approval; §10) — protected-set change via
  Part III change control, never an ordinary doc fix.
- acceptance: [ ] `org/roles/WORK.md:21` and `org/OPERATING_MODEL.md` §4 reworded
  to branch-from-dev / done-means-green-dev per the signed ADR-0006 · [ ] the
  operating model's DoD "merged to a green main" gains the ADR's release-time
  qualification · [ ] G3: operator approves the diff itself
- done when: charter text and practised doctrine agree, through change control.

**Amendments to existing rows at approval:** WO-0018 gains (a) the D-2
docker-image port evidence, (b) an acceptance box "full knip report + design-lint
totals + jest count + coverage photographed verbatim into this row's notes"
(WO-0022's named input), (c) a pointer to WO-0020 as Phase 0's third leg.
WO-0008 gains the stricter line "a deliberate one-line change is proved
non-neutral by the same gate" (flagged as plan addition). WO-0011's operator
half corrected per D-3 (add-only). WO-0004 notes the canary will exist (Phase 2).
Physical re-order: Phase 0 rows to top; WO-0010 above WO-0009; plan order
throughout. Ready-preamble gains the approved-plan-warrant line. Done rows stay
put pending the operator's answer.

## 6 · Phase 5 dispositions (19 files, 57 sites → measured 0)

| File (sites) | Disposition |
| --- | --- |
| `session-sync.ts` (13) | 11 sites → sessions repository; **2 Hermes-state.db reads (:77/:92) → runtime adapter**, never a `*repository*` name (exemption laundering). After WO-0025's split, re-keyed paths, counts identical. |
| `db.ts` (6) | Extract `getGatewayPlatforms` (:99) + `getSchemaHealth` (:295/:303) → repositories; 3 plumbing sites remain (:133, :162, :179) until the sanctioned D8 move relocates the file into exempt `src/lib/db/`. |
| `seed/catalog-seed.ts` (5) | → seed repository module. |
| `stats/agent-stats.ts` (5) + `stats/agent-experience.ts` (1) | → existing `stats/stats-repository.ts`. |
| `analytics/run-aggregates.ts` (4) | → analytics repository. |
| `config-cache.ts` (3) | `meta`-row SQL → the single shared meta repository. |
| `sync/sources/*` (9 in 5 files) | → one sync repository consumed by the five sources. |
| `mission-model-audit.ts` (2) | → `mission-repository`. |
| `composer/seed.ts` (2) | → `composer/composer-repository`. |
| `orchestration/scheduler/BackgroundScheduler.ts` (2) | Lease read/write → the same shared meta repository; preserve the deliberate try/catch swallows; T3 care. |
| `api/agents` (1), `api/monitor` (1), `api/sessions/[id]` (2) routes | → domain repositories; routes end SQL-free. |
| `modules/hermes/lib/state-import.ts` (1) | → `modules/hermes/lib/profiles-repository` (module repositories exempt per WO-0003 ruling). |

## 7 · Merge protocol, gates, releases

- WORK branches from `dev` per CONTRIBUTING (practised doctrine); ADR-0006
  (proposed at approval, §10) makes this constitutional rather than contra-
  charter; WO-0029 lands the charter edit after signature.
- VERIFY merges approved consolidation PRs into `dev` (charter-licensed); the
  operator merges persistence/data-safety rows (WO-0026, WO-0010, WO-0009) and
  every `dev` → `main`.
- Row done = merged to green `dev` + VERIFY verdict recorded on the row; the
  DoD's "merged to a green main" is satisfied at the releases, per ADR-0006.
- Base gate per phase: `npm run lint` · `npx tsc --noEmit` · `npm run lint:knip`
  (widened per Phase 1) · `npm test` (+ coverage where floors apply) ·
  `npm run build` · **CI on dev checked, not assumed**.
- Real-Hermes gate (`npm run test:e2e-hermes` + upgrade test): WO-0021,
  WO-0026, WO-0027, WO-0010, WO-0009, plus any diff touching `src/lib/db*`,
  `src/modules/hermes/`, or the scheduler.
- **The release (one, at programme end per the D13 ruling): the full release
  gate runs first** — full local Playwright matrix (PLAYWRIGHT_SMOKE unset),
  real-Hermes suite, upgrade-path test, results recorded on PR #157 and in
  STATE (Art. 9: main is always releasable; the merge happens only through
  this gate).

## 8 · Risk register

| Phase | Could break | Detection / control |
| --- | --- | --- |
| 0 | Auth weakened to green e2e (forbidden `PS_AUTH_MODE=none`); docker "fix" masking a prod port bug | Row forbids; refused-unauthenticated test required; VERIFY confirms `src/proxy.ts` untouched; docker fix confined to harness env unless evidence says image |
| 0b | Deleting unmerged work; worktree force-removal losing scratch | Per-ref containment proofs in §3; repair→clean-check→remove sequence; `--force` forbidden; reflog 90d |
| 1 | db:seed content drift; alias swap breaking runtime | Real-Hermes gate; `getDb` is the same function object; 40-line scope stated up front |
| 2 | Canary passing trivially | Stricter check: one-line change proved non-neutral |
| 3 | Cycles after moves; exempt-prefix laundering; Turbopack paths | Canary + build; identical baseline totals (re-key only); VERIFY greps for exempt-prefix moves |
| 4 | Behaviour smuggled into splits; cache invalidation dropped; auth creep | `config-cache-invalidation.test.ts`; `no-auth-in-route-handler`; VERIFY samples splits vs history verbatim |
| 5 | Query semantics drift; scheduler exactly-once regression; exemption laundering via repository names | VERIFY sample-diffs SQL vs history; T3 + operator merge; state.db reads to adapter not repository |
| 6 | Test-tie that loosens the test; mocked constant recreating drift | Constant in unmocked `db-schema.ts`; VERIFY checks assertion count didn't fall and constant equals 30 today |
| 7 | Prune before snapshot | WO-0010 strictly before WO-0009; operator merges both |
| All | Baseline grown to absorb violations | Shrink-only doctrine; VERIFY compares totals at every close; D-14 guard suggestion filed |

## 9 · Operator decisions — approval settles these; each ruling is written onto its governing row/QUESTIONS at approval

| # | Decision | Status |
| --- | --- | --- |
| D1 | **Session 0 gate** | **RULED 2026-08-22: this plan supersedes the Genesis-lite re-order; phase E signed/waived by the operator; recorded in STATE + QUESTIONS at approval; WO-0001 marked superseded-by-plan.** |
| D2 | Queue mechanics: row set §5, re-order, approved-plan warrants (+preamble line), merge protocol §7 | Approve as written (settled by plan approval). |
| D3 | docker-image | **RULED 2026-08-22: fix it** (D-2 port mismatch, under WO-0018). |
| D4 | ch-* shims | Keep `ch-deploy.sh` through v1.0 with deprecation warning; delete `ch-migrate.sh` (zero references) now. |
| D5 | Possibly-intentional unused exports | Delete all (git preserves); any keep gets a knip suppression so the gate still reaches zero. |
| D6 | session-sync self-heal | Keep + record as sanctioned (protects pre-migration DBs). |
| D7 | Widen knip gate at zero | Yes — to all issue types incl. `binaries`. |
| D8 | `db.ts` → `db/index.ts` | Yes — as WO-0026's final canary-proved commit (see row for why it must be sanctioned there). |
| D9 | `engines` field | Yes — hosted on WO-0022. |
| D10 | `dashboard-helpers.ts` | Merge into callers — as a non-move commit inside WO-0024. |
| D11 | ADR home | ADR-0007 (proposed): `docs/adr/` is the home; a pointer README in `org/decisions/` keeps the constitutional path literally true. |
| D12 | Branch-protection click | Add `install-harness` to required checks (add-only). Operator may add core CI jobs once green. |
| D13 | **Interim security release** | **RULED 2026-08-22: no — one release at programme end.** The operator accepts public main staying pre-hotfix/MIT for the duration; recorded in STATE so no session re-litigates. PR #157 stays open and auto-updates. |
| D14 | **Dependabot** | **RULED 2026-08-22: close the open Dependabot PRs (agent, via gh; branches auto-delete); operator pauses Dependabot in settings until the final release.** |

## 10 · Paperwork at approval (PLAN writes, before any WORK session)

1. `org/plans/2026-08-consolidation.md` — this plan + Appendix A file lists +
   the §3 branch proofs, committed so sessions read everything from disk.
2. `org/QUEUE.md` — §5 rows with rulings folded in, amendments, preamble line,
   physical re-order.
3. **ADR-0006 (proposed)** — dev as integration trunk: branch-from-dev,
   done-means-green-dev, releases via gated dev→main PRs. Operator's approval
   recorded in the ADR at plan approval; WO-0029 then executes the charter edit.
4. **ADR-0007 (proposed)** — ADR home is `docs/adr/`; pointer in `org/decisions/`.
5. `org/STATE.md` — claim/close; 919→918 (cite START's rule); third red job;
   D1 ruling; release-gate results ledger line.
6. `org/QUESTIONS.md` — entries: queue-header "moves to done" defect; lock-book
   WG-OPS-002 body correction (D-3) + the five "undefined" frontmatter notes
   (D-12) + WG-WEB-013 wording; empty org/logs history note; Done-rows-in-Ready
   formatting; D-14 update-baseline guard suggestion.
7. `org/logs/2026-08/S-0002-plan.md` — this session's log (the org's first;
   numbered honouring the unlogged session-1).
8. PLAN writes no code, merges nothing.

## 11 · Verification of this plan

Eight parallel read-only verifiers re-measured every briefed number (inventory,
bugs/shims, design-lint, migrations, CI via gh, branch archaeology, governance
corpus, live knip run); two independent critics then attacked the draft
(governance compliance; execution risk) and all 23 of their findings are folded
in above. Where brief and tree disagreed, the tree won (§2). Phase 0
re-photographs the volatile numbers into WO-0018's notes at execution time.

---

## Appendix A · Scope lists (committed with the plan; rows reference this)

**Phase 3 domains (45 top-level moves + 2 dirs):**
- `missions/` (22): mission-board, mission-body, mission-categories,
  mission-category-repository, mission-composer-utils, mission-dispatch,
  mission-field-updates, mission-filters, mission-form-utils,
  mission-model-audit, mission-promote-handler, mission-queue-tick,
  mission-repository, mission-response, mission-types (15 top-level .ts) +
  mission-handlers/ (cancel, delete, dispatch, promote, shared, update) +
  build-mission-prompt.ts
- `sessions/` (9): session-detail, session-filters, session-repository,
  session-sync, session-title, session-window, sessions-api-guard,
  sessions-api-helpers, sessions-grouping
- `memory/` (7): hindsight-bridge, hindsight-client, hindsight-mutate,
  hindsight-route-helpers, hindsight-tag-input, memory-providers/,
  memory-catalog-repository
- `git/` (3): git-branch-current, git-branch, git-workspace-branches
- `fs/` (5): fs-helpers, fs-stats, path-security, local-dir-entry, log-files
- `dashboard/` (6): dashboard-error-dedup, dashboard-initial-load,
  dashboard-model-subtitle, dashboard-top-templates, toast-from-result,
  dashboard-helpers (merged into callers per D10, non-move commit)
- Phase 3b: `skills/` (skills-grouping, skills-page-helpers, skills-repository),
  `chat/` (chat-repository, chat-utils); remaining `*-repository.ts` move only
  with their domain.

**Phase 4 god files (verified lines):** useMissionsPage.ts 1029 ·
useModelsPage.ts 636 · useChatPage.ts 537 · recroom/story-weaver/[id]/page.tsx
696 (presentation only) · operations/agents/page.tsx 688 ·
orchestration/scripts/page.tsx 513 · operations/skills/page.tsx 501 ·
operations/personalities/page.tsx 427 · (main)/sessions/page.tsx 465 ·
(main)/logs/page.tsx 438 · session-sync.ts 695 (SQL stays; see WO-0025/0026) ·
modules/hermes/lib/profile-sync.ts 646 · modules/hermes/lib/config-sync.ts 592
(writes stay in `writeHermesConfigFile`) · api/cron/hardware/route.ts 614 ·
api/templates/route.ts 422 · api/memory/hindsight/route.ts 422 ·
api/update/route.ts 415 · components/layout/VersionFooter.tsx 475 (re-key
hermes baseline entry).

**Phase 5 dispositions:** table in §6.
**Branch proofs:** table in §3.

---

## 12 · Part II: EOS v2 adoption (added 2026-08-22, operator-ruled)

At the interactive sign-off round the operator redirected the programme: the
rebuilt PatterTech_EOS (unreleased v2 line, tooling 0.4.0) is adopted into
PatterStage as its own phase. Four rulings, all 2026-08-22:

- **R-A (sequencing):** Phase 0 (green line) and Phase 0b (branches) run
  first under current rules; the EOS recompile runs next; ALL remaining work
  (Phases 1-7 plus WO-0012, WO-0014 rewritten, WO-0015/0016/0017, and the
  promoted Q-008 guard task) then executes as v2 task records under v2 modes.
- **R-B (ADR-0008 accepted):** the full recompile at ORG scale, per the ADR:
  pin repair (cc18755 recorded as c6f94df; new pin = current pushed EOS
  head), v2 kernel file set replaces the v1 org machinery, rulings migrate to
  docs/RULINGS.json with retired-id triage and the WG-DRAFT-001 to
  DOC-IDENT-001 re-anchor, open queue rows become org/tasks/T-####.json
  records, hand-kept STATE and session logs retire (git is the log).
- **R-C (ADR home):** all ADRs move to org/decisions/ under ADR-####-slug
  naming; docs/adr/README.md stays as a public pointer. ADR-0007 superseded.
- **R-D (EOS-side writes):** registration lands directly on the EOS's dev
  branch: registry/PROJECTS.md row, estate/repos.json run-engine correction
  per ADR-0002, and the v2-template feedback re-cut (FB-001/003/005 recorded
  as independently resolved; FB-002 re-aimed as a worked-ruling offer against
  the identity-access pack; FB-004 kept). Next harvest: 2026-09-08.

Dispositions this settles: Q-004, Q-006, Q-007 dissolve with the files they
concern (folded at cutover); Q-005's corrections ride the rulings migration;
Q-008 is promoted to a task; WO-0029 is discarded-with-note (the recompile
replaces WORK.md wholesale; ADR-0006 already records the doctrine and
survives unchanged). The scope ruling ("everything ready in the queue")
brings WO-0012, WO-0014 (acceptance rewritten per its 2026-07-26 ruling),
WO-0015, WO-0016 and WO-0017 into the execution phase.

Execution-session model from here to the cutover: EXECUTOR-style agents own
tasks end to end; independent verifier agents review diffs the executing
agent did not write before anything merges; after the cutover the compiled
v2 policy rules modes and review sampling. Oracle independence is preserved
throughout: acceptance tests for data-safety work are authored before
implementation by an agent that has not seen the implementation.

Pending operator items after the cutover: re-sign the human rubric headed by
the cold-start test (a migrated seed is a new seed), the branch-protection
click, and the Dependabot pause.
