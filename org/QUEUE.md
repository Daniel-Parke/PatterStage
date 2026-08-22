---
summary: PatterStage M-scale queue , the single work file, rows per the templates contract
type: venture
tags: [eos]
compiled_from: kernel/templates/org/QUEUE.tpl.md
---

# QUEUE

The organisation's work, ordered. A session takes the top unblocked
item whose status is ready, sets it in progress with its session id,
and moves it to Done at close. WIP is 1. Row shape per
`org/TEMPLATES.md`; every row names its type, tier, priority, status,
acceptance checks and done-when. Operator-independent work rides above
anything waiting on an answer.

## Ready

Ordered by dependency first, then by cost. Every row below WO-0001 traces to a
lock-book ruling the code does not yet meet; the ruling id is the row's warrant.
Rows commissioned by the operator-approved consolidation plan
(`org/plans/2026-08-consolidation.md`) may instead carry that plan as their
warrant; the operator sanctioned plan-warranted rows at plan approval
(plan §9, ruling D2, 2026-08-22). Operator-independent work rides above
anything waiting on an answer. The 2026-08 consolidation programme owns the
order below; the plan file is the map.

### WO-0018 · CI is red on dev, and has been since the security hotfix
- type: FIX · tier: T2 · priority: P0 · status: ready
- warrant: WG-DEL-004 and the constitution's "never weaken, skip or delete a
  failing check". A gate that is red and unwatched is not a gate.
- plan: org/plans/2026-08-consolidation.md (Phase 0)
- found: 2026-07-26, by finally reading CI rather than the local gate. Every
  "gate green" reported in session 1 meant lint, tsc, jest and build on this
  machine. CI status was never checked once. Runs `30199845212` and
  `30199608664` were already failing before any of this session's work.
- defect 1, `e2e-smoke`, 3 of 4 tests failing. The S1 auth hotfix fails closed:
  `src/proxy.ts:112` returns **503** when no token file exists. The Playwright
  harness runs against a wiped `CH_DATA_DIR` (`playwright.config.ts` sets
  `CH_DATA_DIR=tmp/e2e-data`, global-setup wipes it) and never mints or sends a
  token, so every request gets 503. Hence "missions page loads" and "scripts
  page loads" find no heading, and "unknown app route returns 404" receives 503.
  The tests are correct; the harness has no credentials.
- do NOT fix this by setting `PS_AUTH_MODE=none` and moving on. That makes the
  suite green while permanently un-testing the most security-critical code in
  the repo, and this app already shipped an unauthenticated RCE once. Mint a
  token in global-setup and carry it, so the E2E suite exercises the real path,
  and keep one test that asserts an unauthenticated request is refused.
- defect 2, `docker-image`, failing. Not yet diagnosed.
- note (2026-08-22, plan S-0002): defect 2 is now DIAGNOSED from run
  30226692050's job log: the smoke harness sets `PS_DOCKER_TEST_PORT=42090`
  while the containerised app boots healthy on **42069** ("Ready in 134ms",
  token minted fine), so the readiness probe can never succeed. Operator ruling
  D3 at plan approval: FIX it, harness/env port plumbing first; touch the image
  only if evidence demands. Removal is moot: branch protection currently has
  ZERO required checks (plan §2 D-3).
- note (2026-08-22): CI has a THIRD red job this row predates:
  `real-hermes-integration`, push-only, invisible in PR views. WO-0020 owns it.
  Phase 0 of the consolidation plan is this row plus that one.
- acceptance: [ ] `e2e-smoke` green with auth genuinely exercised · [ ] one test
  proving an unauthenticated request is refused · [ ] `docker-image` diagnosed
  and either fixed or removed with a reason · [ ] the local gate documented as
  NOT a substitute for CI
- acceptance (added by plan amendment, 2026-08-22): [ ] baseline photograph
  captured verbatim into this row's notes at close: full knip report (expected
  38 unused exports / 18 unused types / 2 unresolved / 1 duplicate / 11
  unlisted-binary occurrences), design-lint totals (918; sql-outside-repository
  57 sites in 19 files; hermes-outside-adapter 21 in 13), jest count, coverage,
  clean build. WO-0022 names this row's notes as its input.
- done when: CI on dev is green and its status is checked before any session
  claims a gate passed.

### WO-0020 · real-hermes-integration is red on dev push runs
- type: FIX · tier: T2 · priority: P0 · status: ready
- warrant: WG-DEL-004 and Part II Art. 6 (a red gate is never bypassed); found
  by the plan's CI verification (run 30226692050, job 89857954990, "SMOKE
  FAILED (2 assertion(s))"). The job is push-only per `ci.yml:291`, hence
  invisible in PR-check views and absent from WO-0018 as originally filed.
- plan: org/plans/2026-08-consolidation.md (Phase 0)
- acceptance: [ ] the two failing assertions identified from the job log and
  the cause diagnosed from evidence · [ ] fixed without weakening the smoke (no
  assertion deleted, no retry added) · [ ] row note records why a push-only job
  hid it and puts the "also run on pull_request?" choice to the operator
- done when: the dev push run is green on real-hermes-integration.

### WO-0028 · One repo, two branches: delete the merged strays
- type: OPS · tier: T2 · priority: P1 · status: ready
- warrant: approved-plan warrant (the operator's consolidation order; plan §3
  records the per-ref merge proofs).
- plan: org/plans/2026-08-consolidation.md (Phase 0b; §3 proofs)
- tier justification: every deleted ref's content is proven contained in dev
  (tree-identity or ancestry, plan §3); local reflog retains 90 days; hence T2.
- acceptance, agent half: [ ] `git branch -D cleanup/consolidation-ux` (tip
  `e00b9934` tree byte-identical to dev's #189 squash `bef00ba7`) ·
  [ ] `git fetch --prune` clears the stale
  `origin/feat/benchmarks-trustworthy-fieldkit` tracking ref (already deleted
  on origin; content landed via the #201 squash `8e989084`); no benchmark code
  re-merged, dev deleted that subsystem by design (`4935ac31`) ·
  [ ] Cursor worktree at `C:/Users/Daniel/.cursor/worktrees/hermes-control-hub/flkr`:
  `git worktree repair <path>` FIRST (its gitdir back-pointer targets the
  pre-rename repo path and git dies inside it), then `git -C <path> status
  --porcelain` must come back EMPTY before `git worktree remove <path>`;
  `--force` is forbidden; if repair fails or the tree is dirty, stop and hand
  the operator the listing · [ ] then `git branch -d cursor/f7b69026` (ancestor
  of dev) · [ ] Dependabot per operator ruling D14 (2026-08-22): close the open
  Dependabot PRs via `gh` (branches auto-delete) · [ ] end state verified:
  `git for-each-ref` plus `git ls-remote --heads origin` show dev and main
  only; **PR #157 remains the open dev-to-main PR**, merging only at the final
  release per operator ruling D13
- acceptance, operator half (outside any commit, WO-0011-style):
  [ ] pause/snooze Dependabot in GitHub settings for the programme's duration;
  re-enable at the final release
- done when: the ref landscape is dev, main, and nothing unsanctioned.

### WO-0021 · Fix the two broken script imports and close both gates behind them
- type: FIX · tier: T2 · priority: P0 · status: ready
- warrant: WG-OPS-002 (`setup.sh:248/:283`, `setup.mjs:158/:161`,
  `ps-deploy.mjs:426/:428` and `npm run db:seed` all reach the broken imports;
  the install path is death #1).
- plan: org/plans/2026-08-consolidation.md (Phase 1a-1c)
- behaviour change sanctioned: yes, bug fixes, flagged in commit messages.
- acceptance: [ ] `scripts/tooling/ensure-hermes-model-sync.ts:55` imports
  `../../src/modules/hermes/lib/config-sync` and
  `scripts/tooling/import-hermes-state.ts:56` imports
  `../../src/modules/hermes/lib/state-import` (the modules do NOT move) ·
  [ ] `npm run db:seed` completes; the deploy path is smoke-tested; the six
  doc files printing the command re-checked (plan §2 D-8) · [ ] the
  `lint:knip` gate gains `unresolved` AFTER the fix lands (widening first
  reddens CI) · [ ] duplicate export closed: the `db` alias deleted from
  `src/lib/db.ts:82`; **all 40 `db`-importing lines** (19 via `@/lib/db` plus
  21 via relative `./db` and `../db` specifiers) migrated mechanically to
  `getDb`, plus the internal `db()` call at `db.ts:113`; design-lint's `.exec(`
  receiver list confirmed unchanged (it already names `db()`, `getDb()`,
  `database`, `this.db`) · [ ] proof that a future unresolved import fails CI
- done when: both scripts execute against their real homes, the knip gate
  catches a recurrence, and `getDb` is the single name.
- merge gate: real-Hermes suite (`npm run test:e2e-hermes`); this touches the
  Hermes config and state path.

### WO-0022 · Delete the dead exports and make the full knip report clean signal
- type: MAINT · tier: T2 · priority: P1 · status: ready
- warrant: approved-plan warrant (sanctioned per plan §9 D2).
- plan: org/plans/2026-08-consolidation.md (Phase 1d-1e)
- input: the full knip report photographed verbatim into WO-0018's row notes at
  its close (an acceptance box that plan amendment added to WO-0018).
- operator rulings folded (2026-08-22): D5, delete ALL possibly-intentional
  unused exports (credentials-repository, memory-providers, tool-catalog,
  frameworks barrel); git history preserves them. D7, widen the gate at zero.
  D9, add the `engines` field.
- acceptance: [ ] the 38 unused exports and 18 unused exported types deleted,
  **except `NEUTRAL_COLUMN_NAMES_SCHEMA_VERSION`
  (`src/lib/db/apply-neutral-column-names.ts:35`), reserved for WO-0027's
  head-constant tie** · [ ] any export the operator later keeps gets a knip
  suppression (`/** @public */` or a `knip.json` ignore) with a reason, so the
  widened gate still lands at zero · [ ] `LevelBadge` (and baseline key
  `design-lint.baseline.json:84`) and `ChipGroup` (and key `:145`) deleted in
  the same commits · [ ] the 7 OS binaries (sqlite3, tasklist, taskkill,
  netstat, ss, lsof, where) added to `knip.json` `ignoreBinaries` (5 entries
  exist) · [ ] gate widened to
  `files,dependencies,unlisted,unresolved,exports,types,duplicates,binaries`
  once counts are zero · [ ] `engines` field added to package.json (Node >=20;
  CI pins 20 in five places) · [ ] baseline keys for deleted files removed in
  the same commits
- done when: the full report is empty or every surviving line carries a
  recorded sanction, and none of it can regrow silently.

### WO-0023 · Retire the ch-* shim references the repo still exercises
- type: OPS · tier: T2 · priority: P1 · status: ready
- warrant: WG-OPS-002 (CI's install proof executes a file marked "Remove
  later").
- plan: org/plans/2026-08-consolidation.md (Phase 1f)
- operator ruling folded (2026-08-22): D4, keep `ch-deploy.sh` through v1.0
  with a deprecation warning line, delete after; `ch-migrate.sh` has zero
  references repo-wide and is deleted now.
- acceptance: [ ] `tests/integration/test_full_install_update_process.py:826`
  and `:942` invoke `ps-deploy.sh` directly · [ ] that file's line-27 docstring
  (naming nonexistent `scripts/lib/ch-deploy-impl.sh`) and its remaining
  ch-deploy mentions (lines 6, 418, 926, 1013, 1053, 1315) swept ·
  [ ] `tests/scripts/README.md:12` updated, including the stale
  `ch-hermes-profile-templates.sh` (real file:
  `scripts/lib/ps-hermes-profile-templates.sh`) · [ ] `ch-deploy.sh` gains its
  deprecation warning line; `ch-migrate.sh` deleted · [ ] left alone with
  reasons noted on this row: `docs/MIGRATION.md:31` (rename history),
  `src/lib/deploy-status.ts:25` (runtime back-compat with its own tests),
  `tests/unit/update-api.test.ts:331` (mocked message)
- done when: nothing in the repo executes or documents a ch-* path except the
  sanctioned back-compat strings.

### WO-0008 · Build the output canary
- type: FIX · tier: T2 · priority: P2 · status: ready
- warrant: WG-ARCH-006 (B, behaviour pinned first). All 2,279 tests are
  option A: no snapshot, golden or characterisation test and no output hash. The
  2026-07 module move was made without one, which is why WG-ARCH-001 cannot rule C.
- plan: org/plans/2026-08-consolidation.md (Phase 2; every later phase leans on
  this row)
- acceptance: [ ] a build-output hash or golden set that a pure file move leaves
  unchanged · [ ] it runs in a gate · [ ] `npm run seed-pack`'s deterministic
  artefacts are covered
- acceptance (added by plan amendment, 2026-08-22, beyond the row's original
  text): [ ] a deliberate one-line change is proved non-neutral by the same gate
- done when: a future move can be proved output-neutral rather than asserted.

### WO-0024 · Domain folders for the flat library
- type: REFACTOR · tier: T2 · priority: P1 · status: blocked (on WO-0008)
- warrant: WG-ARCH-006 plus approved-plan warrant.
- plan: org/plans/2026-08-consolidation.md (Phase 3; scope lists in Appendix A)
- operator ruling folded (2026-08-22): D10, `dashboard-helpers.ts` (11 lines)
  merges into its callers, as its own non-move commit inside this row.
- acceptance: [ ] one move commit per domain (missions 22 · sessions 9 ·
  memory 7 · git 3 · fs 5 · dashboard 6, per Appendix A's file lists): ONLY
  moves plus mechanical import updates plus the mandatory riders (baseline
  re-keys at identical counts, `check-doc-links` fixes, `docs/REPO_GUIDE.md`
  directory map, `tests/e2e/app-routes.ts` if routes are touched) · [ ] the
  dashboard-helpers merge is a separate non-move commit · [ ] the canary
  proves every move commit output-neutral · [ ] tripwires held: no
  Hermes-touching file enters a lint-exempt prefix; Turbopack-traced paths
  stay string-concatenated; nothing merges into `src/lib/modules/` ·
  [ ] Phase 3b by name: `skills/` (skills-grouping, skills-page-helpers,
  skills-repository) and `chat/` (chat-repository, chat-utils); the remaining
  top-level `*-repository.ts` files move only WITH their domain, never as a
  "repositories/" bucket · [ ] `src/lib/db.ts` does not move (that relocation
  is WO-0026's final commit)
- done when: the six domains are complete, the top level is ≈64 files before
  3b, every move is proved neutral, and baselines are re-keyed, never grown.

### WO-0025 · God-file decomposition
- type: REFACTOR · tier: T2 · priority: P1 · status: blocked (on WO-0008)
- warrant: WG-ARCH-006 plus approved-plan warrant.
- plan: org/plans/2026-08-consolidation.md (Phase 4; the 18 files with verified
  line counts in Appendix A; 400-line ceiling, 350 target)
- operator ruling folded (2026-08-22): D6, `session-sync`'s pragma-guarded lazy
  self-heal (`ensureMessageCountColumn`, line 240) is kept and sanctioned; the
  ruling is recorded in WO-0027's doc so the lint comment and the file agree.
- acceptance: [ ] one file per work item, split by responsibility; any file
  still over 350 carries its reason in this row's notes and a header comment ·
  [ ] `useMissionsPage` splits into focused hooks; `useMissionsApi`,
  `useSchedules` and `useDashboard` are NOT folded into `useApiResource`
  (its header deliberately excludes them) · [ ] the `session-sync.ts` split
  preserves `ensureMessageCountColumn` and the `lastOrphanCloseCount` log
  suppression; **all 13 SQL sites stay in place** (re-keyed at identical
  counts if their file paths change); their migration belongs to WO-0026, not
  this row · [ ] the `config-sync.ts` split keeps every config.yaml write
  inside `writeHermesConfigFile`; `tests/unit/config-cache-invalidation.test.ts`
  green throughout · [ ] auth stays out of route handlers in the four
  API-route splits · [ ] the `VersionFooter` split re-keys its
  hermes-outside-adapter baseline entry · [ ] compatibility re-exports deleted
  in the row's final commit, or their retention justified on the row
- done when: every listed file is at or under 400 lines (350 the norm),
  callers are migrated, and the full suite, config-cache-invalidation and the
  e2e smoke are green.

### WO-0026 · Repository-seam pull-through
- type: REFACTOR · tier: T3 · priority: P1 · status: blocked (on WO-0025)
- warrant: WG-ARCH-002 (B, and B is not met). This is the row that makes the
  shrink-only counter actually shrink.
- plan: org/plans/2026-08-consolidation.md (Phase 5; disposition table in §6)
- operator ruling folded (2026-08-22): D8, `src/lib/db.ts` relocates to
  `src/lib/db/index.ts` as this row's final, canary-proved commit.
- acceptance: [ ] the 18 other baselined files clear entirely per the plan's
  §6 dispositions; the **two Hermes-state.db reads (`session-sync.ts:77/:92`)
  go to the runtime adapter (`src/lib/runtime/`), NOT to any `*repository*`
  file** (a repository name would drop them out of lint sight via the
  `/repository/i` exemption) · [ ] `db.ts`: `getGatewayPlatforms` (:99) and
  `getSchemaHealth`'s queries (:295/:303) extracted to repositories; the
  residual is 3 plumbing sites (:133 sqlite_master probe, :162/:179 migration
  execs) with reasons on this row · [ ] baseline entries deleted in the same
  commits; the count only ever falls via migration · [ ] final commit, per D8:
  the db.ts move (keeps `@/lib/db` imports byte-identical; smoke
  `scripts/tooling/migrate-db.ts`, whose relative dynamic import at :82 may
  need `/index`); the file becomes exempt-by-location and its 3-site baseline
  entry is deleted BY the sanctioned move, recorded as such · [ ] the `.exec(`
  receiver gap is NOT chased (needs a parser; the dependency-free constraint
  carried by design-lint.mjs's header and WO-0003) · [ ] one `meta`-table
  repository serves both config-cache and the scheduler lease, not two ·
  [ ] the scheduler extraction preserves the deliberate try/catch swallows
  (`BackgroundScheduler.ts:36/:48`) · [ ] VERIFY diffs a sample of migrated
  queries against git history for changed semantics
- done when: `sql-outside-repository`'s measured count is **0**: 54 sites
  removed by migration, 3 by the sanctioned relocation with recorded reasons.
- merge gate: real-Hermes suite plus the upgrade-path test; G3, the operator
  approves and merges.

### WO-0027 · Migration truth and the going-forward rule
- type: FIX · tier: T2 · priority: P1 · status: ready
- warrant: the lock-book's enforced contract "Migration history is a record,
  not a description"; the defect is doc-and-test drift (v13/v11 claimed, v30
  real).
- plan: org/plans/2026-08-consolidation.md (Phase 6)
- acceptance: [ ] `docs/MIGRATION.md:57`, `:79` and `:104` corrected to the
  v30 head · [ ] a head constant minted in **`src/lib/db-schema.ts`** (the
  file is unmocked by `tests/jest.setup.ts:116-133`, already imported by the
  upgrade test, and exempt by name in design-lint) and asserted equal to the
  last applier's gate (`NEUTRAL_COLUMN_NAMES_SCHEMA_VERSION`, which WO-0022
  reserves); the three hardcoded 30s at
  `tests/unit/run-migrations-upgrade.integration.test.ts:128/:169/:192` tied
  to it, strengthened and never weakened · [ ] the going-forward rule written
  in `docs/MIGRATION.md`: a schema change is a new numbered `.sql` plus a
  version-gated applier exec'ing it, appended to the hand-wired order in the
  db entry file; the 4 readFileSync appliers and 3 pure-TS appliers recorded
  as the historical exceptions; the ladder quirks (no v6, no v10, 007/008
  markers) documented; shipped migrations immutable · [ ] operator ruling D6
  recorded here: `session-sync`'s guarded lazy self-heal is deliberate and
  sanctioned, so the design-lint comment and the file agree
- done when: MIGRATION.md matches the code, and the doc and test cannot drift
  apart again.
- merge gate: the upgrade-path test.

### WO-0004 · Name the 21 boundary crossings instead of counting them
- type: FIX · tier: T2 · priority: P2 · status: ready
- warrant: WG-ARCH-001 (B). `hermes-outside-adapter` is baselined at 21 crossings
  across 13 files. A shrink-only counter stops the 22nd; it does not make the 21 a
  contract, and the option's own words are "the layering fails the build when
  crossed".
- plan note (2026-08-22): Phase 7 row 1. WO-0008's canary lands in Phase 2,
  so the C-conditional in the third acceptance item will have its condition
  met by the time this row runs. Coordinate with WO-0024: the 13 crossing
  files are better moved alongside this row's closure than shuffled twice.
- acceptance: [ ] every one of the 21 either carries an inline pragma with a
  written reason or is closed behind the AgentRuntime port · [ ] the
  `hermes-outside-adapter` baseline entries are gone · [ ] C recorded in the
  lock-book as a dated target conditional on WO-0008's canary
- done when: no file's Hermes knowledge is licensed by a number.

### WO-0007 · Gate the schemas that leave the repo
- type: FIX · tier: T2 · priority: P2 · status: ready
- warrant: WG-ARCH-005 (B for every contract that leaves the repo).
  `generate:schema-json` runs in no gate, so the committed JSON Schemas can lag
  their Zod source silently.
- plan note (2026-08-22): Phase 7 row 2.
- acceptance: [ ] a CI step or jest test regenerates `mission-v1.schema.json` and
  `template-pack-v1.schema.json` and fails on a diff · [ ]
  `agentruntime-wire.json` vendored into `tests/fixtures/` and the port's wire
  shapes asserted against it, executing ADR-0002 decision 3
- done when: a Zod edit that changes the wire shape cannot merge silently.
- note: any change of mind about the PatterStudio coupling is an ADR-0002
  amendment, not a decision taken here.

### WO-0010 · Write the per-Body progression snapshot
- type: FEAT · tier: T2 · priority: P1 · status: ready
- warrant: WG-ARCH-003 (C for the per-Body progression record) and ADR-0004.
  Progression is currently recomputed from raw history, so pruning that history
  would silently change past levels.
- plan note (2026-08-22): Phase 7 row 3; strictly BEFORE WO-0009, and the
  physical order here now says so. The operator merges this row (data safety).
- acceptance: [ ] one immutable row per agent profile carrying level,
  achievements, the inputs digest and versions · [ ] corrections land as new rows,
  never edits · [ ] lands BEFORE WO-0009's prune
- done when: an agent's recorded growth survives the deletion of the events it was
  derived from.

### WO-0009 · Declare retention for the two unbounded tables
- type: FIX · tier: T2 · priority: P1 · status: ready
- warrant: WG-ARCH-008 (A with C's seam), ruled by the operator. `analytics_events`
  and `chat_messages` are append-only with no expiry column, on machines belonging
  to people the operator has never met.
- plan note (2026-08-22): Phase 7 row 4; runs only after WO-0010 has captured
  history. The operator merges this row (data safety).
- acceptance: [ ] consumer, retention window, prune path and the split migration
  written into the migration headers and an ADR · [ ] the prune implemented ·
  [ ] ordered after WO-0010, so no history is destroyed before it is captured
- done when: neither table can grow without bound, and the owner of each is named.

### WO-0013 · Put the coverage floors under a ratchet
- type: FIX · tier: T1 · priority: P3 · status: ready
- warrant: WG-DEL-001 (B, floors per surface, ratchet-only-up).
- plan note (2026-08-22): Phase 7 row 5, the programme's last row.
- acceptance: [ ] `!src/app/**` deleted from collectCoverageFrom and a
  `src/app/api` band added · [ ] every floor reset to the measured number rounded
  down, engine above service above UI · [ ] floors moved into a shrink-only
  baseline checked by the same mechanism as design-lint
- done when: lowering a floor fails CI instead of passing it.

### WO-0019 · The install harness's update scenario fails on CI only
- type: FIX · tier: T2 · priority: P2 · status: ready
- warrant: WG-OPS-002. The update path is half of what "the install path is a
  gate" means, and CI currently gates only the first install.
- plan note (2026-08-22): independent of the programme's phase chain; any WORK
  session may take it once Phase 0 closes.
- symptom: `fatal: not in a git directory` from the FIRST git command in the
  update scenario's setup block, so `/workspace` inside the container has no
  `.git`. The other four scenarios never touch git and pass identically on both
  machines. Locally the full five pass in 570s; on CI it is 4 of 5, twice.
- what has been RULED OUT, so nobody repeats it: `.git` is not in the harness's
  `COPY_IGNORE_DIR_NAMES`, and `shutil.copytree` therefore copies it;
  `docker cp <workspace>/.` copies dotfiles; and `fetch-depth: 0` on the
  checkout changed nothing, so the shallow-clone theory was WRONG. That was my
  first hypothesis and it cost a CI cycle to disprove.
- next step: put a diagnostic in the job before theorising again. `ls -la
  /workspace/.git` inside the container, plus `git status` on the runner before
  the copy, will say in one run whether `.git` leaves the runner, survives the
  copytree, or survives the docker cp. Three candidates, one cheap experiment.
- acceptance: [ ] cause identified from evidence, not inference · [ ] `update`
  restored to the CI scenario list · [ ] the exclusion comment in `ci.yml`
  removed
- done when: CI runs the same five scenarios that pass locally.

### WO-0011 · Make the install path a gate
- type: FIX · tier: T2 · priority: P1 · status: PART-DONE, awaiting one operator
  click · session: session-1-2026-07-26
- warrant: WG-OPS-002 (A, one deployment model, the native host install) and
  death #1 in the venture brief, which the adopted scope made the gate on
  everything else.
- acceptance: [ ] the existing install harness wired into CI as a PR gate ·
  [ ] its "not intended for CI" disclaimer struck · [ ] docker-image demoted out
  of PR-required checks · [ ] DEPLOY.md cut to one supported model
- done when: a change that breaks a fresh install cannot merge.
- unblocked 2026-07-26: WO-0002 landed, so `setup.sh`'s build no longer reaches
  the network. The stated dependency is discharged.
- REWRITE NEEDED, found on inspection 2026-07-26. Two of the four acceptance
  items are not repository files and cannot be done by an agent or by any commit:
  "wired into CI as a PR gate" and "docker-image demoted out of PR-required
  checks" are GitHub **branch-protection settings**, configured in repo settings,
  not in `ci.yml`. A workflow file can add a job; only branch protection decides
  which jobs block a merge. Branch protection is confirmed active on this repo,
  because a force-push was refused earlier in this session. So the row as written
  cannot reach DONE from inside the repo.
- split it: the committable half is a new `install-harness` job in `ci.yml`,
  striking the "not intended for CI" disclaimer in the harness docstring
  (`tests/integration/test_full_install_update_process.py:12`) and at
  `docs/TESTING.md:68`, and cutting `docs/DEPLOY.md` to one supported model. The
  owner's half is two clicks in branch protection: add `install-harness` to the
  required set, remove `docker-image` from it.
- VERIFIED LOCALLY 2026-07-26. The operator started Docker (29.4.1), so the
  harness was actually run rather than assumed: `--profile smoke --skip-http`,
  **5 of 5 scenarios passed in 570.3s**. fresh 102.2s, hermes 107.5s, dashboard
  110.9s, both 111.0s, update 136.8s. The `update` scenario is the valuable one:
  it fetches `dev` from a local bare repo and runs the real deploy script, so the
  update path is covered and not just the first install.
- committable half DONE:
  [x] `install-harness` job added to `ci.yml`, with a 45 minute timeout because
  a cold GitHub runner has no layer cache and this machine reused one. Scoped to
  four of the five scenarios: `update` fails on CI only and the cause is not yet
  known, so it is excluded with a written reason and WO-0019 owns it. The four
  still cover death #1, which is a stranger's FIRST install failing ·
  [x] the "not intended for CI" disclaimer struck in the harness docstring and
  in `docs/TESTING.md`, each replaced with what is now true and why it changed ·
  [x] `docs/DEPLOY.md` cut to one supported model, with the Docker section
  reframed as the CI parity rig rather than an optional deployment
- GREEN ON CI, run `30226331826`, 2026-07-26. That is the run the operator was
  waiting for, and it took three attempts to get: the first two failed on the
  `update` scenario and are recorded on WO-0019 rather than glossed over.
- correction (2026-08-22, plan S-0002): branch protection on main currently has
  ZERO required status checks (verified via `gh api`; `contexts=[]`), so the
  second click, "remove docker-image", has nothing to remove and is void. The
  remaining operator half is ONE click: add `install-harness` to the required
  set. The lock-book's WG-OPS-002 body paragraph asserting docker-image sits in
  the required set is stale; QUESTIONS carries the sanctioned correction.
- operator's half, still open:
  [ ] add `install-harness` to the required checks in branch protection
- caution, retained from the original second click: what WG-OPS-002 asks about
  docker-image must not become the reason it is never fixed. It has its ruling
  (D3: fix, under WO-0018) and its diagnosis.

### WO-0012 · Run the full end-to-end suite on main
- type: FIX · tier: T2 · priority: P2 · status: ready
- warrant: WG-DEL-002 (B). CI runs smoke-only, so 38 of 42 Playwright tests never
  execute on a pull request.
- plan note (2026-08-22): outside the consolidation programme's phase chain;
  surfaced to the operator. The programme's release gate runs the full matrix
  locally regardless.
- acceptance: [ ] a main-blocking job runs the full suite with PLAYWRIGHT_SMOKE
  unset · [ ] real-hermes-integration also runs on pull_request targeting main ·
  [ ] the install journey wired in once WO-0011 lands · [ ]
  missions-runtime.spec.ts converted to a journey, as its own header asks
- done when: the suite that exists is the suite that runs.

### WO-0014 · Make spend visible and stoppable
- type: FEAT · tier: T2 · priority: P2 · status: ready
- warrant: WG-OPS-004 (B for the operator's own install, C for shipped ones) and
  the operator's standing rule: "No spend without my approval".
- plan note (2026-08-22): outside the consolidation programme; the row wants
  rewriting against the recorded operator ruling before anyone starts it.
- acceptance: [ ] the monthly figure and the spend rule written into the venture
  state · [ ] run-aggregate spend displayed against it · [ ] a triage pause stops
  unattended dispatch once breached · [ ] for shipped installs, a provider ceiling
  documented as a precondition of enabling unattended work, with the running total
  surfaced at that point
- done when: an unattended agent cannot spend past a number the operator set.
- OPERATOR RULING, 2026-07-26: "We should just have a warning here, AND the
  ability for the user to have a hard stop, but we should not force this in a way
  that is awkward for users." Scope confirmed as LLM provider spend, the only
  thing in PatterStage that costs money: agent runs, Composer stages and Deep
  Research.
- so the acceptance above is superseded on its third item. The default is a
  warning, not a stop. The hard stop exists, is off by default, and is the
  user's to switch on with their own figure. No ceiling ships pre-set and
  nothing refuses to dispatch because a number was never entered.
- this reverses the option I recommended, and the ruling is the better one for a
  product a stranger installs. A tool that refuses to work until you have filled
  in a budget field teaches you to resent it. The operator's own rule, "no spend
  without my approval", is about HIS install, and it is served by the figure
  being visible rather than by the software policing everyone else's.
- rewrite the acceptance checks against this before starting the row.

### WO-0015 · Caption the figures and enforce the reading column
- type: DOCS · tier: T1 · priority: P3 · status: ready
- warrant: WG-WEB-014 (A, media is a citation in the reading column), re-argued
  after the audit found it wrongly inherited.
- plan note (2026-08-22): outside the consolidation programme.
- acceptance: [ ] a one-line caption under each of the seven figures in README.md
  and USER_WALKTHROUGH_GUIDE.md · [ ] `docs/images/insights.png` cited or deleted
  (generated by the screenshot spec, referenced by no document) · [ ] a reading
  measure set on ResearchReport's PROSE and the artifacts page's `prose
  max-w-none` · [ ] the "only binary asset is favicon.ico" premise corrected in
  the WG-WEB-008 and WG-WEB-012 notes
- done when: no figure is uncaptioned and no longform surface is unbounded.

### WO-0016 · Add the skim layer to long reports
- type: FEAT · tier: T2 · priority: P3 · status: ready
- warrant: WG-WEB-006 (reference-first, skim-first where a surface is read once).
- plan note (2026-08-22): outside the consolidation programme.
- acceptance: [ ] the synthesize step emits a leading `## In brief` of 3-5
  bullets, rendered as a band above the prose · [ ] slugged ids on the heading
  branch of renderReportHtml, mirrored in the HTML export · [ ] an on-page
  navigator when a report carries four or more h2s
- done when: a long report can be skimmed and deep-linked.
- note: do not lower type to fit. The no-sub-12px-type baseline stays shrink-only.

### WO-0017 · Vendor the bloom field
- type: FEAT · tier: T2 · priority: P3 · status: ready
- warrant: WG-WEB-011 (C, field-reactive) and WG-WEB-005 (C, full).
- plan note (2026-08-22): outside the consolidation programme.
- acceptance: [ ] `BloomField.tsx` copied verbatim from PatterTech_Website into
  `src/kit/` with a PROVENANCE.md naming source repo and commit, per ADR-0003
  Part 1 · [ ] mounted once in the root layout · [ ] the `[data-bloom]::after`
  paint rule ported using the existing Cherenkov RGB so no new token is minted ·
  [ ] `data-bloom` on the ledger rows, panels, cards and buttons WG-WEB-003 names
  as the console's containers · [ ] the fine-pointer and reduced-motion opt-outs
  carried across exactly
- done when: brightness reads as energy in the system rather than decoration.

### WO-0001 · Run Genesis-lite
- type: DOCS · tier: T2 · priority: P1 · status: superseded (operator ruling
  D1, 2026-08-22, at plan approval)
- warrant: INCEPTION.md, "M ventures run GENESIS-LITE" after Session 0
- superseded: the approved consolidation plan
  (`org/plans/2026-08-consolidation.md`) stands in place of the Genesis-lite
  queue re-order, and the operator signed or waived Session 0 phase E in the
  same ruling. The row is retained for history per the append-only article; do
  not take it. "superseded" extends the template's status vocabulary
  deliberately and is noted here rather than hidden.
- acceptance: [ ] domain model and architecture sketch written ·
  [ ] ADRs for every judgement call · [ ] this queue re-ordered with the
  foundation items below placed against the sketch
- done when: the GENESIS-LITE launcher's outputs are complete and a cold WORK
  session can take the new top item with zero questions.

### WO-0002 · Make the test suite deterministic before anything depends on it
- type: FIX · tier: T2 · priority: P1 · status: DONE · session: session-1-2026-07-26
- warrant: WG-DEL-004 (C, determinism first). Explicitly ordered ahead of the
  other delivery items, and WO-0011 waits on it because setup.sh runs a build
  that fetches fonts from the network.
- acceptance: [x] Playwright retries 0 unconditionally, trace retain-on-failure ·
  [x] the six font families vendored as local .woff2 under next/font/local ·
  [x] the font warmup and the build retry deleted from ci.yml ·
  [x] npm ci and checkout retries filed as quarantined flakes with a reason and a
  2027-01 review, the alternative the ruling offers: they absorb GitHub and npm
  registry failures, not defects in this code
- done when: no gate in ci.yml retries, and a red run means a real failure.

### WO-0003 · Make the repository seam a contract instead of a claim
- type: FIX · tier: T2 · priority: P1 · status: DONE · session: session-1-2026-07-26
- warrant: WG-ARCH-002 (B, and B is not met). 19 files hold 49 `.prepare(` sites
  outside the repository layer, so the seam is documented and unenforced.
- acceptance: [x] a design-lint rule, `sql-outside-repository`, forbids `.prepare(`
  outside a `*repository*.ts`, `src/lib/db/` or `src/lib/db-schema.ts` ·
  [x] baselined at today's count, shrink-only · [x] the rule is in `npm run lint`
  (design-lint already runs there, so a new rule is gated the moment it lands)
- done when: the 49 can only shrink, and a new bypass fails the build.
- measured: 19 files, **57** sites, not 49. Three corrections, all recorded rather
  than quietly adopted. (1) The row's 49 came from raw grep, which counts
  `.prepare(` on comment lines; design-lint skips those, taking it to 48. (2) The
  row's stated exemption, `src/lib/**/*repository*.ts`, contradicts its own
  warrant, which says "the 25 repositories" and so must include the three under
  `src/modules/`. Exempting only `src/lib` would push a module's SQL into core to
  satisfy this rule and break ADR-0005 to do it, so repositories are exempt
  wherever they live. (3) +9 sites because the rule also covers a db-receiver
  `.exec(`. `session-sync.ts:240` runs `ALTER TABLE sessions ADD COLUMN` outside
  the migration chain entirely, and `catalog-seed.ts` execs raw SQL. A rule that
  waves those through is not a contract, and "a new bypass fails the build" is the
  row's own done-when.
- note: `.exec(` is receiver-anchored because `RegExp.prototype.exec` accounts for
  5 of the 10 `.exec(` sites in `src/`. That leaves one gap, stated in the rule
  header: an arbitrarily-named connection variable escapes the `.exec(` half.
  Closing it needs a parser, which WG-WEB-013 rules out. The `.prepare(` half,
  52 of the 57 sites, has no such gap.
- proved: nine probes, each planting a violation and running the real gate. New
  `.prepare(` fails; a pragma with a reason passes; a pragma **without** a reason
  fails; the same SQL inside a repository or `src/lib/db/` passes; `RegExp.exec`
  is not flagged; `db().exec("ALTER TABLE ...")` is; and a file already baselined
  at 13 fails at 14, which is the case the lock-book names.

### WO-0005 · Delete the dead reading themes
- type: FIX · tier: T1 · priority: P2 · status: DONE · session: session-1-2026-07-26
- warrant: WG-WEB-001 (A, dark-first, no exception). The `light` and `sepia`
  reader themes are a second register nobody ruled.
- acceptance: [x] `light` and `sepia` removed from THEMES in
  `src/modules/rec-room/components/ReaderSettings.tsx` and their picker tiles ·
  [x] the two `pageTheme === "light"` conditional hexes removed from the story
  reader · [x] `dark`/`black` held as tokens rather than hex
- done when: the no-raw-colour-in-tsx baseline has shrunk and one register remains.
- built: the picker tiles needed no separate deletion, being generated from
  `Object.entries(THEMES)`. The eight remaining values moved to `--ps-reader-*`
  in globals.css and the component now holds `var()` handles, so the hex lives
  once. `pageTheme` narrowed to `"dark" | "black"`, which makes a fifth theme a
  type error rather than a silent addition. The two `pageTheme === "light"`
  conditionals became `theme.rule`, a shared token, since neither had a branch
  left.
- baseline: 926 to 920. `no-raw-colour-in-tsx` on ReaderSettings.tsx cleared
  entirely (4 to 0, key removed) and the reader page went 4 to 2. The surviving 2
  are chapter-status colours, which are separate debt and not this row's.
- migration: a reader whose localStorage holds `sepia` or `light` is normalised
  back to `dark` at the load boundary. Without that the page would have rendered
  correctly through its `|| THEMES.dark` fallback while the picker showed nothing
  selected, because no tile matches.
- verified: not by assertion. The values are byte-identical to the originals, so
  this is a move rather than a restyle, and the chain was checked end to end,
  hex in globals.css, into the emitted stylesheet under .next, back to the
  var() references, with zero undefined and zero dead tokens. A mistyped custom
  property renders transparent and fails silently, which is the whole reason
  `no-ch-custom-properties` exists.
- note: two user-facing reading themes are gone. Restoring either is a fork
  needing a dated deviation, a budgeted second QC surface, and palettes minted
  in `@pattertech/ui`, never in globals.css or a module.
- note: a light reading register is a fork, not a bug fix. It needs a dated
  deviation, a budgeted second QC surface, and palettes minted in
  `@pattertech/ui`, never in globals.css or a module.

### WO-0006 · Close the config-cache invalidation gap
- type: FIX · tier: T1 · priority: P2 · status: DONE · session: session-1-2026-07-26
- warrant: WG-ARCH-003 (B for the config read). Only PatterStage's own PUT
  invalidates the cache, so the agent and any hand edit to config.yaml are a
  second writer with the 15s TTL as sole owner.
- acceptance: [x] `invalidateConfigCache` called from
  `syncDefaultsToHermesConfig`, `syncSingleModelToHermesConfig`,
  `syncFallbacksToHermesConfig` and `finalizeRootConfigOnDisk`
- done when: the TTL is a backstop rather than the owner of correctness.
- built: one helper, `writeHermesConfigFile`, rather than the four calls the row
  asked for. An enumerated list of writers is how this gap opened, so the
  invalidation is attached to the act of writing config.yaml instead. Three call
  sites route through it; `finalizeRootConfigOnDisk` is covered by construction,
  because it writes by calling `syncDefaultsToHermesConfig`. A fifth writer
  inherits the behaviour without anyone remembering it.
- not folded into `atomicWriteFile`, which also writes `.env`: a generic file
  writer should not know which caches exist. A test pins that boundary, so
  pushing the invalidation further down turns the build red.
- proved: 6 tests in `tests/unit/config-cache-invalidation.test.ts`, end-to-end
  against real in-memory SQLite so the cache genuinely writes and reads `meta`
  rows. Removing the invalidation fails exactly the four writer tests and leaves
  the two control tests green, which is what makes them evidence rather than
  decoration. The controls are: a warm cache still serves stale content for a
  direct hand edit to config.yaml, which is what the TTL remains the backstop
  for, and an `.env` write does not clear the config cache.
- note: the hand-edit path is unchanged and still waits up to 15s. That is the
  TTL doing the job it was designed for, and closing it needs a file watcher,
  which is a different decision than this row.

## Blocked

### WO-0029 · Amend WORK.md's branch-from-main to match practised doctrine
- type: DOCS · tier: T3 · priority: P2 · status: blocked (on ADR-0006's
  signature)
- warrant: ADR-0006 (proposed, `docs/adr/0006-dev-is-the-integration-trunk.md`);
  a protected-set change goes through Part III change control, never an
  ordinary doc fix.
- plan: org/plans/2026-08-consolidation.md
- acceptance: [ ] `org/roles/WORK.md:21` and `org/OPERATING_MODEL.md` section 4
  reworded to branch-from-dev and done-means-green-dev per the signed ADR-0006 ·
  [ ] the operating model's DoD "merged to a green main" gains the ADR's
  release-time qualification · [ ] G3: the operator approves the diff itself
- done when: charter text and practised doctrine agree, through change control.

- (WO-0024, WO-0025 and WO-0026 carry their blockers on their own rows in
  Ready, because each is ready to start the moment its blocker closes.)

## Done

- (none)
