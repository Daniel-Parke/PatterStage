---
summary: PatterStage Venture lock-book , the machine rulings header and the module contract sections
type: venture
tags: [eos]
supersedes: the v0.1 PROJECT_LOCKIN migration
eos_root: ../PatterTech_EOS
eos_version: v1.0
eos_commit: cc18755
scale: M
stack: none of the three registry profiles fits; see docs/EOS_FEEDBACK.md EOS-FB-004. PatterStage is a local-first Next.js application with an EMBEDDED database (better-sqlite3), no separate backend service and no hosting: the user runs it on their own machine. Pinned as `local-app (authored, pending a registry profile)`
addons: [ops-runbook, restore-test]
compiled: 2026-07-25
rulings:
  - WG-EOS-001 · M · argued · server state, auth and standing ops force at least M; every L trigger silent on the operator's answers
  - WG-EOS-002 · A monorepo · argued · the repo exists, is public with one remote, and is handed over as a unit; claimed rather than created
  - WG-VOX-001 · B professional-calm · argued · The operator's audience answer is "both, equally" and both halves are technical (people who already installed a Hermes agent, plus himself), so the mixed-audience
  - WG-ARCH-001 · B · argued · B, machine contract: two of design-lint's three boundary rules are clean contracts, hermes-outside-adapter's 21 baselined crossings are not
  - WG-ARCH-002 · B and B is not met · argued · B stands as the option and is unmet in fact: 19 files hold 49 prepare() sites outside the 25 repositories and the db/ plumbing, so the seam needs a shrink-only
  - WG-ARCH-003 · A for stats generally; C for the per-Body progression · argued · A for stats, C for the per-Body progression snapshot (inputs digest, written before any analytics_events prune), and B for the config read only once every config.yaml
  - WG-ARCH-004 · A with B's seam designed in, the doctrine's own · argued · A with B's seam designed in: the deterministic-occurrence claim is real, the unit-builder registry is absent everywhere, and boot recovery re-fails rather than rebuilds
  - WG-ARCH-005 · C for the in-repo TypeScript seam · argued · C in-repo (one language, apiFetch throws on non-2xx), B for everything that leaves it: generate:schema-json runs in no gate anywhere, and ADR-0002 decision 3's
  - WG-ARCH-006 · B · argued · All 2,279 tests are option A: tests/ holds no snapshot, golden or characterisation test and no output hash, while npm run seed-pack emits deterministic artefacts that
  - WG-ARCH-007 · B · argued · No vendor SDK appears in package.json at all
  - WG-ARCH-008 · A with C 's seam · argued · A with C's seam: one patterstage.db, but analytics_events and chat_messages are declared readings, consumer, retention window and prune path designed now, and the
  - WG-WEB-001 · A Dark-first · argued · A, dark-first, single register, no exception
  - WG-WEB-002 · App shell for all 27 routes; long read (article kit) · argued · Every route hangs off one persistent sidebar+main chrome in src/app/layout.tsx and the visitor's verb on all of them is operate, which the decision rule sends straight
  - WG-WEB-003 · D · argued · Sessions, logs, models, missions and skills are records with 3+ comparable fields, which the decision rule sends to a table or a ledger, not to the rounded-xl box the
  - WG-WEB-004 · B Concentrated · argued · The one place continuous motion belongs is the live run, `ps-rail-flow` and `ps-edge-glow` on the Composer canvas are the signature animated piece, and
  - WG-WEB-005 · C full · argued · amended in the second corrective pass; its fork was withdrawn once the prerequisite ruling eliminated two of three options
  - WG-WEB-006 · Reference-first for the 27 operator routes · argued · Reference-first on the 27 routes, skim-first dashboard, and the mandatory takeaways band on every long read, owed in full by the deep-research report.
  - WG-WEB-007 · C Server-rendered app · argued · Auth is enforced in src/proxy.ts, all state is better-sqlite3 at schema v30, and instrumentation.ts opens the DB at boot for the orchestration scheduler, none of which
  - WG-WEB-008 · B next/image with the built-in local loader · argued · PatterStage runs a real Next 16 server (src/proxy.ts, better-sqlite3, instrumentation), not a static export, so request-time optimisation is available, but "no spend
  - WG-WEB-009 · B · argued · ADR-0005 makes the module the unit and src/lib/modules/registry.ts registers four (core, hermes, laboratory, rec-room), but accent is set per nav link today, so the
  - WG-WEB-010 · The house trio: Space Grotesk display, Inter text · argued · ADR-0003 (accepted 2026-07-25) orders @pattertech/ui vendored verbatim and its theme.css declares --font-display: "Space Grotesk", while src/app/layout.tsx imports only
  - WG-WEB-011 · C Field-reactive · argued · C, field-reactive, with B's hover layer beneath it: vendor BloomField (66 lines) from PatterTech_Website into src/kit/, not a wait on the kit.
  - WG-WEB-012 · A generated only · argued · The whole repo holds one binary (src/app/favicon.ico), every atmosphere is already computed (grid-bg layered gradients, ps-rail-flow, the SVG viz components, glow-*)
  - WG-WEB-013 · C · argued · find src -iname GUIDE.md returns nothing and no component carries a JSDoc law header, so every law string lives in scripts/tooling/design-lint.mjs, one directory away
  - WG-WEB-014 · A argued · argued · A, argued not inherited: media is a citation, and the seven shipped screenshots in docs/ owe captions, a measure, and the deletion of the uncited one.
  - WG-DEL-001 · B with the two clauses the original left out · argued · undefined
  - WG-DEL-002 · B letter unchanged · argued · undefined
  - WG-DEL-003 · B · argued · undefined
  - WG-DEL-004 · C Determinism first · argued · The live flake is exactly the class rule 4 names: six next/font/google families across two layouts make next build fetch a CDN inside CI, and ci.yml's own comment
  - WG-OPS-003 · B - snapshots plus a scheduled restore test · argued · Production data exists at schema v30 across ~43 tables and backups are written in three places, yet grep for pre-migrate/pre-baseline/.bak across src, scripts and tests
  - WG-OPS-004 · B and C split by whose money it is · argued · undefined
  - WG-OPS-001 · C - self-hosting · argued · The decision rule reserves C for when sovereignty is the product, and local-first is the opening clause of the operator-confirmed restatement plus cheapest death #3
  - WG-OPS-002 · A One deployment model · argued · undefined
compiled_from: kernel/templates/LOCKBOOK.tpl.md
---

# PatterStage lock-book

The venture's contract with the EOS. This file wins on specifics; EOS
doctrine wins on principles. The YAML header above is machine-read: the
seed check validates it, the harvest counts its rulings, upgrades diff
against its pins. Rulings rows are one line each,
`WG-ID · ruling · argued|inherited · note`; argued means the triggers
were engaged afresh, inherited means the default was taken without new
argument. Only argued rulings are promotion evidence.

## Identity

- One-word feel: instrument
- Signature motif (promoted everywhere): the lit console in a dark room: a dense operator surface where the only bright things are live state
- Signature animated pieces (the sanctioned exceptions, by name): set at first build, ruled by WG-WEB-011 (C, field-reactive) and WG-WEB-005 (C, full)
- Voice register ruling (WG-VOX-001): in the header; banned list per
  the voice module.

## Narrative brief

The one-paragraph story the design must tell without saying it: what
the visitor should feel, what stays concealed, what escapes anyway.
Name the physics or motifs the brand draws from and how each becomes a
mechanism, not a mood board. This paragraph drives the light budget
(WG-WEB-005), the reactivity ruling (WG-WEB-011) and the imagery ruling
(WG-WEB-012).

A single operator sits at a dark console and watches work they did not do themselves. The surface should feel like an instrument rather than a dashboard: dense, legible at arm's length, and honest about what is happening right now versus what merely finished. What stays concealed is the machinery, the framework, the ports, the seams; what escapes anyway is liveness, because a run in flight must look different from a run that ended. The physics the brand draws from is a field: brightness is not decoration but a readout of energy in the system, so an idle console is dim and a working one is not. That is what makes the light budget a mechanism rather than a mood.

## Tokens

Before a first build exists, design-system slots below take the
sanctioned deferral: `set at first build` plus where the value gets
ruled. The first-build lock-in session replaces every deferral in one
sitting and notes it in the worklog or queue.

- Token home: src/app/globals.css (@theme, Tailwind v4) · Code mirror: src/lib/theme.ts ·
  Styleguide route: set at first build; owed by WG-DEL-003, which rules pixel baselines against a styleguide surface that does not yet exist
- Surface ladder: set at first build. Currently 32 appearance-named primitives (dark-950 and siblings) with no semantic layer, which TOKENS.md forbids by name; the ladder is ruled when the vendored @pattertech/ui lands
- Accents: set at first build. Ruled by WG-WEB-009 (B): one registered module-to-accent map of four entries. Today five accents are applied decoratively and the map does not exist
- Text tiers and measured contrast: set at first build. Measured contrast is owed: the design-lint baseline records sub-12px type as the single largest debt category
- Measures: reading set at first build · wide set at first build · full
  set at first build · block gap set at first build

## QC gates (exact commands)

- Build: npm run lint && npx tsc --noEmit && npm test && npm run build
- Overflow at 375: set at first build; owed by WG-WEB-003, no 375px overflow check exists today
- Page weight: set at first build; owed by WG-WEB-008
- Screenshots: npm run screenshots (Playwright, PORT=3477, CAPTURE_SCREENSHOTS=1)
- Regression smokes: npx playwright test (PLAYWRIGHT_SMOKE unset). CI runs smoke-only today, which WG-DEL-002 rules against

## Structural contracts (things future edits must not break)

Distilled from the argued rulings. Each line is a consequence a future edit must
respect, with the ruling that produced it and the mechanism that enforces it. A
contract with no mechanism is marked **unenforced** and carries its queue item,
because the whole point of this section is that it cannot quietly stop being true.

**Enforced today, in `npm run lint`:**

- **Authentication is enforced once, in `src/proxy.ts`, and never in a route
  handler.** WG-DRAFT-001 (B). `design-lint no-auth-in-route-handler` fails the
  build on `readAuthToken`, `tokenMatches` or `ps_session` under `src/app/api/`.
  The prohibition exists because the alternative gives no way to distinguish a
  route that is deliberately public from one where somebody forgot, which is
  exactly how this repo shipped an unauthenticated RCE chain before 2026-07.
- **Core never imports a module.** ADR-0005, WG-ARCH-001. Module capability is
  reached through one of three named composition points, `src/lib/modules/server.ts`,
  `src/lib/frameworks/registry.ts` and `src/lib/runtime/`. Enforced by
  `core-imports-no-module`. One exception exists, in `src/lib/api-schemas.ts`,
  behind a pragma with a written reason.
- **`AGENTS.md` stays within 40 lines and `CLAUDE.md` is byte-identical.**
  `check-agent-files.mjs`.
- **Every relative link in `docs/` resolves.** `check-doc-links.mjs`. A stale link
  reads as verified, which is worse than no link.
- **The design-lint baseline shrinks and never grows.** Re-keying a file's debt at
  the same count is permitted; a surviving file gaining a violation is not.
- **Migration history is a record, not a description.** Historical migrations are
  never edited, `schema_version` is a strictly increasing chain, and a migration
  that fails does not bump the version.
- **The test suite is type-checked.** `typecheck:tests` at zero, in the gate. A
  test that lies about a real signature is a red build.
- **Persistence goes through the repository layer.** WG-ARCH-002 (B), whose own
  remedy was a shrink-only counter. `design-lint sql-outside-repository` fails the
  build on `.prepare(`, and on a db-receiver `.exec(`, anywhere under `src/`
  outside a `*repository*.ts`, `src/lib/db/` or `src/lib/db-schema.ts`. Baselined
  2026-07-26 at 19 files and 57 sites, which is the debt and may only fall.
  `src/lib/db.ts` is baselined rather than exempted, because two of its six sites
  are `sqlite_master` plumbing but `getGatewayPlatforms()` is a repository
  function in the connection file. WO-0003.
- **A gate never retries.** WG-DEL-004 (C, determinism first). Playwright is at
  `retries: 0` unconditionally, and the six font families are vendored under
  `next/font/local` so the build reaches no network. The `checkout` and `npm ci`
  retries survive as quarantined flakes with a written reason and a 2027-01
  review, which is the alternative the ruling itself offers: they absorb GitHub
  and npm registry failures rather than defects in this code. WO-0002.

**Ruled and NOT yet enforced.** Each carries its queue item; none may be quietly
dropped:

- **No file's knowledge of the agent framework is licensed by a number.**
  WG-ARCH-001 (B). Unmet: `hermes-outside-adapter` is baselined at 21 crossings.
  → WO-0004.
- **A move must be provable output-neutral before it is made.** WG-ARCH-006 (B).
  Unmet: no canary exists, which is why WG-ARCH-001 cannot rule C. → WO-0008.
- **Contracts that leave the repo are gated.** WG-ARCH-005 (B for departing
  artefacts). Unmet: `generate:schema-json` runs in no gate. → WO-0007.
- **No table grows without bound.** WG-ARCH-008 (A with C's seam, ruled by the
  operator). Unmet: `analytics_events` and `chat_messages` are append-only with no
  expiry column. → WO-0009, ordered after WO-0010.
- **Recorded growth survives the deletion of the history it came from.**
  WG-ARCH-003 (C for the per-Body record), ADR-0004. Unmet: progression is
  recomputed from raw history. → WO-0010.
- **A dispatched unit is rebuildable, not merely re-failable.** WG-ARCH-004 (A with
  B's seam). Unmet: boot recovery marks interrupted work failed rather than
  rebuilding it, and the LLM spend it consumed is unrecoverable. → WO-0008 and
  WO-0014.
- **A fresh install is a gate.** WG-OPS-002 (A, the native host install). Unmet:
  the install harness is not in CI, and it carries a "not intended for CI"
  disclaimer. → WO-0011. This is death #1 in the brief and the gate the adopted
  scope put on everything else.
- **The suite that exists is the suite that runs.** WG-DEL-002 (B). Unmet: CI runs
  smoke-only, so 38 of 42 Playwright tests never execute on a pull request.
  → WO-0012.
- **Unattended work cannot spend past a number the operator set.** WG-OPS-004.
  Unmet: no figure is recorded and no pause exists. → WO-0014. This one is the
  operator's own standing rule, "No spend without my approval", so it is a
  contract before it is a feature.

**Design contracts, deferred to first build.** WG-WEB-001 rules one register,
dark-first, no exception; WG-WEB-009 one registered module-to-accent map of four
entries; WG-WEB-010 the house trio. None can be enforced before the semantic token
layer exists, and today 32 appearance-named primitives stand where it should be.
The deferral is dated to the first-build lock-in, not open-ended.

## Deviations from doctrine

Two, both deliberate, both with the operator's ruling recorded.

**1. The walk exceeded `WALK_ORDER.md`'s twenty-ruling stop condition, and
continued.**

- Doctrine deviated from: `WALK_ORDER.md`, "A walk running past twenty rulings
  means the trigger set is wrong (too broad) or the venture is bigger than its
  scale ruling; stop and re-run WG-EOS-001 before continuing."
- Trigger that justifies it: PatterStage's triggers activate all six wargame
  modules, giving 31 phase-C rulings. WG-EOS-001 was re-run as instructed and
  neither diagnosis applied: the trigger set is not too broad (every module is
  genuinely present) and the venture is not bigger than M (every L trigger is
  silent). The alarm is arithmetically unreachable for any web venture with server
  state, and its only prescribed remedy, re-ruling scale upward, pulls in more
  modules.
- Wargame that argued it: no wargame covers it. Filed as **EOS-FB-001** with the
  arithmetic and a draft replacement rule (budget per module, alarm at four
  modules).
- Operator's approval: ruled "proceed at 31, file the defect, and draft the fix".

**2. The `stack:` pin names no registry profile.**

- Doctrine deviated from: the lock-book header's `stack:` pin, which expects a
  profile from `registry/stacks/`.
- Trigger that justifies it: none of the three profiles describes PatterStage. 01
  `web-static` has no server state; 02 `fastapi-postgres` has no Python or
  Postgres here; 03 `fullstack-app` assumes a FastAPI back and Postgres underneath
  when there is no back half at all and the database is embedded. Every existing
  profile assumes a deployed service with a network boundary between a front end
  and a data store.
- Wargame that argued it: none exists. Filed as **EOS-FB-004** with a draft fourth
  profile, `STACK-local-app`, whose distinguishing pins are the install path, the
  migration story for a database the maintainer never sees, and backup and restore
  as a user duty rather than an ops duty.
- Operator's approval: pending at phase E. The pin is filled honestly as
  `local-app (authored, pending a registry profile)` rather than falsely naming a
  profile that is wrong in its load-bearing half.

**Not a deviation, recorded so it is not mistaken for one.** `WG-DRAFT-001` is a
draft wargame rather than a deviation: the `auth` trigger names no wargame in the
corpus (EOS-FB-002), so PatterStage drafted one and ruled against it. The
prescribed remedy was followed rather than departed from.
