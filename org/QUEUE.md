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
Operator-independent work rides above anything waiting on an answer.

### WO-0001 · Run Genesis-lite
- type: DOCS · tier: T2 · priority: P1 · status: ready
- warrant: INCEPTION.md, "M ventures run GENESIS-LITE" after Session 0
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

### WO-0004 · Name the 21 boundary crossings instead of counting them
- type: FIX · tier: T2 · priority: P2 · status: ready
- warrant: WG-ARCH-001 (B). `hermes-outside-adapter` is baselined at 21 crossings
  across 13 files. A shrink-only counter stops the 22nd; it does not make the 21 a
  contract, and the option's own words are "the layering fails the build when
  crossed".
- acceptance: [ ] every one of the 21 either carries an inline pragma with a
  written reason or is closed behind the AgentRuntime port · [ ] the
  `hermes-outside-adapter` baseline entries are gone · [ ] C recorded in the
  lock-book as a dated target conditional on WO-0008's canary
- done when: no file's Hermes knowledge is licensed by a number.

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

### WO-0007 · Gate the schemas that leave the repo
- type: FIX · tier: T2 · priority: P2 · status: ready
- warrant: WG-ARCH-005 (B for every contract that leaves the repo).
  `generate:schema-json` runs in no gate, so the committed JSON Schemas can lag
  their Zod source silently.
- acceptance: [ ] a CI step or jest test regenerates `mission-v1.schema.json` and
  `template-pack-v1.schema.json` and fails on a diff · [ ]
  `agentruntime-wire.json` vendored into `tests/fixtures/` and the port's wire
  shapes asserted against it, executing ADR-0002 decision 3
- done when: a Zod edit that changes the wire shape cannot merge silently.
- note: any change of mind about the PatterStudio coupling is an ADR-0002
  amendment, not a decision taken here.

### WO-0008 · Build the output canary
- type: FIX · tier: T2 · priority: P2 · status: ready
- warrant: WG-ARCH-006 (B, behaviour pinned first). All 2,279 tests are
  option A: no snapshot, golden or characterisation test and no output hash. The
  2026-07 module move was made without one, which is why WG-ARCH-001 cannot rule C.
- acceptance: [ ] a build-output hash or golden set that a pure file move leaves
  unchanged · [ ] it runs in a gate · [ ] `npm run seed-pack`'s deterministic
  artefacts are covered
- done when: a future move can be proved output-neutral rather than asserted.

### WO-0009 · Declare retention for the two unbounded tables
- type: FIX · tier: T2 · priority: P1 · status: ready
- warrant: WG-ARCH-008 (A with C's seam), ruled by the operator. `analytics_events`
  and `chat_messages` are append-only with no expiry column, on machines belonging
  to people the operator has never met.
- acceptance: [ ] consumer, retention window, prune path and the split migration
  written into the migration headers and an ADR · [ ] the prune implemented ·
  [ ] ordered after WO-0010, so no history is destroyed before it is captured
- done when: neither table can grow without bound, and the owner of each is named.

### WO-0010 · Write the per-Body progression snapshot
- type: FEAT · tier: T2 · priority: P1 · status: ready
- warrant: WG-ARCH-003 (C for the per-Body progression record) and ADR-0004.
  Progression is currently recomputed from raw history, so pruning that history
  would silently change past levels.
- acceptance: [ ] one immutable row per agent profile carrying level,
  achievements, the inputs digest and versions · [ ] corrections land as new rows,
  never edits · [ ] lands BEFORE WO-0009's prune
- done when: an agent's recorded growth survives the deletion of the events it was
  derived from.

### WO-0011 · Make the install path a gate
- type: FIX · tier: T2 · priority: P1 · status: PART-DONE, awaiting two operator
  clicks · session: session-1-2026-07-26
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
- operator's half, still open:
  [ ] add `install-harness` to the required checks in branch protection ·
  [ ] remove `docker-image` from them
- the job is deliberately NOT required yet. It passed on this machine, which is
  not the same as passing on a cold ubuntu-latest runner with no Docker cache.
  Read one green CI run first. A required check that fails for an environmental
  reason is worse than no check, and that order is the whole point of
  WG-DEL-004.

### WO-0019 · The install harness's update scenario fails on CI only
- type: FIX · tier: T2 · priority: P2 · status: ready
- warrant: WG-OPS-002. The update path is half of what "the install path is a
  gate" means, and CI currently gates only the first install.
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

### WO-0018 · CI is red on dev, and has been since the security hotfix
- type: FIX · tier: T2 · priority: P0 · status: ready
- warrant: WG-DEL-004 and the constitution's "never weaken, skip or delete a
  failing check". A gate that is red and unwatched is not a gate.
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
- acceptance: [ ] `e2e-smoke` green with auth genuinely exercised · [ ] one test
  proving an unauthenticated request is refused · [ ] `docker-image` diagnosed
  and either fixed or removed with a reason · [ ] the local gate documented as
  NOT a substitute for CI
- done when: CI on dev is green and its status is checked before any session
  claims a gate passed.

### WO-0012 · Run the full end-to-end suite on main
- type: FIX · tier: T2 · priority: P2 · status: ready
- warrant: WG-DEL-002 (B). CI runs smoke-only, so 38 of 42 Playwright tests never
  execute on a pull request.
- acceptance: [ ] a main-blocking job runs the full suite with PLAYWRIGHT_SMOKE
  unset · [ ] real-hermes-integration also runs on pull_request targeting main ·
  [ ] the install journey wired in once WO-0011 lands · [ ]
  missions-runtime.spec.ts converted to a journey, as its own header asks
- done when: the suite that exists is the suite that runs.

### WO-0013 · Put the coverage floors under a ratchet
- type: FIX · tier: T1 · priority: P3 · status: ready
- warrant: WG-DEL-001 (B, floors per surface, ratchet-only-up).
- acceptance: [ ] `!src/app/**` deleted from collectCoverageFrom and a
  `src/app/api` band added · [ ] every floor reset to the measured number rounded
  down, engine above service above UI · [ ] floors moved into a shrink-only
  baseline checked by the same mechanism as design-lint
- done when: lowering a floor fails CI instead of passing it.

### WO-0014 · Make spend visible and stoppable
- type: FEAT · tier: T2 · priority: P2 · status: ready
- warrant: WG-OPS-004 (B for the operator's own install, C for shipped ones) and
  the operator's standing rule: "No spend without my approval".
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
- acceptance: [ ] the synthesize step emits a leading `## In brief` of 3-5
  bullets, rendered as a band above the prose · [ ] slugged ids on the heading
  branch of renderReportHtml, mirrored in the HTML export · [ ] an on-page
  navigator when a report carries four or more h2s
- done when: a long report can be skimmed and deep-linked.
- note: do not lower type to fit. The no-sub-12px-type baseline stays shrink-only.

### WO-0017 · Vendor the bloom field
- type: FEAT · tier: T2 · priority: P3 · status: ready
- warrant: WG-WEB-011 (C, field-reactive) and WG-WEB-005 (C, full).
- acceptance: [ ] `BloomField.tsx` copied verbatim from PatterTech_Website into
  `src/kit/` with a PROVENANCE.md naming source repo and commit, per ADR-0003
  Part 1 · [ ] mounted once in the root layout · [ ] the `[data-bloom]::after`
  paint rule ported using the existing Cherenkov RGB so no new token is minted ·
  [ ] `data-bloom` on the ledger rows, panels, cards and buttons WG-WEB-003 names
  as the console's containers · [ ] the fine-pointer and reduced-motion opt-outs
  carried across exactly
- done when: brightness reads as energy in the system rather than decoration.

## Blocked

- (none. WO-0011's dependency on WO-0002 is recorded on the row rather than here,
  because it is ready to start the moment WO-0002 closes.)

## Done

- (none)
