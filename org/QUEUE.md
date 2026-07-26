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
- type: FIX · tier: T2 · priority: P1 · status: in progress · session: session-1-2026-07-26
- warrant: WG-DEL-004 (C, determinism first). Explicitly ordered ahead of the
  other delivery items, and WO-0011 waits on it because setup.sh runs a build
  that fetches fonts from the network.
- acceptance: [x] Playwright retries 0 unconditionally, trace retain-on-failure ·
  [ ] the six font families vendored as local .woff2 under next/font/local ·
  BLOCKED: vendoring binaries into a public repo is an owner decision, see below ·
  [ ] the font warmup and the build retry deleted from ci.yml ·
  [ ] npm ci and checkout retries removed, or each filed as a quarantined flake
  with an owner and a deadline
- done when: no gate in ci.yml retries, and a red run means a real failure.

### WO-0003 · Make the repository seam a contract instead of a claim
- type: FIX · tier: T2 · priority: P1 · status: ready
- warrant: WG-ARCH-002 (B, and B is not met). 19 files hold 49 `.prepare(` sites
  outside the repository layer, so the seam is documented and unenforced.
- acceptance: [ ] a design-lint rule forbids `.prepare(` outside
  `src/lib/**/*repository*.ts` and `src/lib/db/` · [ ] baselined at today's count,
  shrink-only · [ ] the rule is in `npm run lint`
- done when: the 49 can only shrink, and a new bypass fails the build.

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
- type: FIX · tier: T1 · priority: P2 · status: ready
- warrant: WG-WEB-001 (A, dark-first, no exception). The `light` and `sepia`
  reader themes are a second register nobody ruled.
- acceptance: [ ] `light` and `sepia` removed from THEMES in
  `src/modules/rec-room/components/ReaderSettings.tsx` and their picker tiles ·
  [ ] the two `pageTheme === "light"` conditional hexes removed from the story
  reader · [ ] `dark`/`black` held as tokens rather than hex
- done when: the no-raw-colour-in-tsx baseline has shrunk and one register remains.
- note: a light reading register is a fork, not a bug fix. It needs a dated
  deviation, a budgeted second QC surface, and palettes minted in
  `@pattertech/ui`, never in globals.css or a module.

### WO-0006 · Close the config-cache invalidation gap
- type: FIX · tier: T1 · priority: P2 · status: ready
- warrant: WG-ARCH-003 (B for the config read). Only PatterStage's own PUT
  invalidates the cache, so the agent and any hand edit to config.yaml are a
  second writer with the 15s TTL as sole owner.
- acceptance: [ ] `invalidateConfigCache` called from
  `syncDefaultsToHermesConfig`, `syncSingleModelToHermesConfig`,
  `syncFallbacksToHermesConfig` and `finalizeRootConfigOnDisk`
- done when: the TTL is a backstop rather than the owner of correctness.

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
- type: FIX · tier: T2 · priority: P1 · status: ready
- warrant: WG-OPS-002 (A, one deployment model, the native host install) and
  death #1 in the venture brief, which the adopted scope made the gate on
  everything else.
- acceptance: [ ] the existing install harness wired into CI as a PR gate ·
  [ ] its "not intended for CI" disclaimer struck · [ ] docker-image demoted out
  of PR-required checks · [ ] DEPLOY.md cut to one supported model
- done when: a change that breaks a fresh install cannot merge.
- blocked-by: WO-0002 (the harness runs a build that currently fetches fonts).

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
