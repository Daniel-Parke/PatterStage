---
summary: PatterStage venture lock-book, the machine header and the module contract sections
type: venture
tags: [eos]
supersedes: the v0.1 PROJECT_LOCKIN migration
eos_root: ../PatterTech_EOS
eos_version: 0.4.0
eos_commit: 727bee44bdd83ce569a8d711d51eccf79851af92
scale: ORG
stack: none of the three registry profiles fits; see docs/EOS_FEEDBACK.md EOS-FB-004. PatterStage is a local-first Next.js application with an EMBEDDED database (better-sqlite3), no separate backend service and no hosting: the user runs it on their own machine. Pinned as `local-app (authored, pending a registry profile)`
policy_profile: org/policy.json
packs_adopted: [identity-access, security-privacy, architecture, coding, delivery-testing, devops-reliability, docs-dx, ui-ux, writing-content, agentic-development, agentic-swarm, ai-ml-llm, supply-chain-integrity, legal-licensing, data-analytics, pattertech-house]
addons: [ops-runbook, restore-test]
compiled: 2026-08-22
rulings_record: docs/RULINGS.json
compiled_from: kernel/templates/LOCKBOOK.tpl.md
---

# PatterStage lock-book

The venture's contract with the EOS. This file wins on specifics; EOS
Doctrine wins on standing rules. The YAML header above is machine-read:
the seed check validates it, the harvest reads the structured Rulings
record, and upgrades diff against the pins. `policy_profile` names the
compiled policy instance; `packs_adopted` lists the knowledge packs this
venture activates, and house style activates only by adoption here.
`docs/RULINGS.json` records why each candidate Wargame was selected or
omitted and holds the argued outcomes. Inherited Doctrine is carried by
the EOS pin and adopted packs, so it is not expanded into empty rows.

**The pin translation, recorded rather than silently swapped.** Session 0
compiled this seed on 2026-07-25 against EOS v1.0 at commit `cc18755`.
The EOS then rewrote its history, so `cc18755` no longer resolves; its
post-rewrite identity is `c6f94df`, which is dated 2026-07-15 and is an
ancestor of the pushed `archive/v1-final` tag. The header now pins the v2
line at `727bee44bdd83ce569a8d711d51eccf79851af92`. Both dead ids are kept
here on purpose: a reader checking this seed against its own history needs
to be able to follow the chain, and deleting an id that a later record
still cites is how provenance breaks.

**Where `packs_adopted` came from.** The list is the proposed set read off
this venture's true predicates at the ADR-0008 cutover, not yet the output
of `python -m tools.eos wargame match --facts`. Running the matcher in the
confirmation pass is what settles it, and a pack leaving the list there is
a subtraction the matcher earned rather than a defect in this header.

## Identity

- One-word feel: instrument
- Signature motif (promoted everywhere): the lit console in a dark room: a dense operator surface where the only bright things are live state
- Signature animated pieces (the sanctioned exceptions, by name): set at first build, ruled by WG-WEB-011 (C, field-reactive) and WG-WEB-005 (C, full)
- Voice register ruling (WG-VOX-001, a retired identity carried as
  provenance): in `docs/RULINGS.json`, not in the header any more; banned
  list per the voice module.

## Narrative brief

The one-paragraph story the design must tell without saying it: what
the visitor should feel, what stays concealed, what escapes anyway.
Name the physics or motifs the brand draws from and how each becomes a
mechanism, not a mood board. This paragraph drives the light budget
(WG-WEB-005), the reactivity ruling (WG-WEB-011) and the imagery ruling
(WG-WEB-012).

A single operator sits at a dark console and watches work they did not do themselves. The surface should feel like an instrument rather than a dashboard: dense, legible at arm's length, and honest about what is happening right now versus what merely finished. What stays concealed is the machinery, the framework, the ports, the seams; what escapes anyway is liveness, because a run in flight must look different from a run that ended. The physics the brand draws from is a field: brightness is not decoration but a readout of energy in the system, so an idle console is dim and a working one is not. That is what makes the light budget a mechanism rather than a mood.

## Tokens

Before a first build exists, the design-system slots take the sanctioned
deferral: the marker plus where the value gets ruled. The lock-in sitting
replaces the marker with a value and records how the value was reached.

**The sitting for the rows below was held on 2026-08-24 (T-0028).** Nothing here
was picked by eye. Every value is read off what the tree already paints, each row
carries the count that produced it, and each carries the mechanism that reddens
the build when the value and the code drift apart. One row still defers, the
styleguide route, and it carries a dated warrant and a review rather than an open
intention.

- Token home: src/app/globals.css (@theme, Tailwind v4) · Code mirror:
  src/lib/theme.ts. The two are held together by
  tests/unit/lockbook-tokens.test.ts, which reads the CSS and fails on a mirror
  naming a token nobody declared. A class string for a token that does not exist
  compiles, lints and renders nothing, which is the failure this file's own
  accent-map comment was written about.
- Styleguide route: **deferred 2026-08-24, review by 2027-01-31**, and this is
  admitted debt, not a re-ruling. WG-DEL-003 stands at B with its fork
  withdrawn: pixel baselines over the 24 primitives' states, zero threshold,
  pinned render container, baselines committed. A route on its own discharges
  none of that, and a styleguide surface with no comparison behind it goes stale
  in a fortnight while reading as a gate, which is worse than an admitted gap.
  The precondition the WG-WEB-012 collision named is also still open: install.sh
  clones `--single-branch` with no `--depth`, verified 2026-08-24, so every
  committed baseline would be paid by the stranger at install. Order is clone
  depth, then the render rig, then the surface. Until it lands the ruled tokens
  are still checkable without a page, by scripts/tooling/contrast-check.mjs in
  `npm run lint` and by the test above.
- Surface ladder: four semantic roles over the appearance-named primitives, in
  globals.css @theme. `ground` is dark-950 (the page itself, 50 uses), `panel`
  is dark-900 (a raised card or bar, 160), `well` is dark-800 (a sunken field,
  code block or row, 68), `hairline` is white at 10 percent (the rule between
  two surfaces, 280). No colour is minted: three of the four are aliases, so
  moving a primitive moves its role with it. The hairline is the exception and
  it is recorded rather than invented, because the tree draws its rules as
  `border-white/10`, which resolves to #1e232a over the ground and matches no
  rung; naming a rung there would repaint 280 borders. dark-700 and dark-600
  stay un-roled on purpose: four backgrounds and a scrollbar thumb between them
  is not a role. Naming is not migration, and the 278 appearance-named
  backgrounds are all still there. Open, and not this sitting's to rule: whether
  the ladder is re-minted in the vendored @pattertech/ui when it lands or stays
  here.
- Accents: the map exists, in src/lib/modules/registry.ts beside the modules it
  keys, which is what WG-WEB-009 (B) rules: four entries, one per registered
  module. core cyan, hermes orange, laboratory pink, rec-room purple. Green is
  the accent that leaves, because `--color-neon-green` and
  `--color-semantic-success` are the same hex and a hue that already means
  "finished" cannot also mean "Laboratory"; that is the arithmetic behind four
  entries against five accents applied. Each of the four is the hue that module
  already flies, counted 2026-08-24 over its own routes and components: core
  cyan 186 against 97 orange, rec-room purple 115 of its 117 non-green uses,
  hermes orange 47 against 0 pink, laboratory the remainder, owning no hue of
  its own. Registering is not applying: the nav links still carry the hues the
  tree grew, and pink still doubles as the failure tint on two Laboratory
  surfaces, which belong on `--color-semantic-danger` before the map can be read
  off a screen. That repaint is work this sitting did not take.
- Text tiers and measured contrast: ruled and shipped. Four derived tiers in
  globals.css, white at 92, 70, 55 and 50 percent, measured against #040b12,
  which is the app's actually painted ground: 16.7:1, 9.7:1, 6.3:1 and 5.3:1, so
  every tier clears WCAG AA for normal text with headroom instead of balancing
  on the 4.5:1 line. There is deliberately no tier below `faint`; anything
  quieter is decoration rather than text. scripts/tooling/contrast-check.mjs
  re-derives all four in `npm run lint` and fails if the background moves under
  them.
- Measures: reading 48rem · wide 56rem · full 80rem · block gap 1.5rem, declared
  as `--container-ps-*` and `--spacing-ps-block`. Reading is not a second
  number: it is the longform column the UX pass already set on the Story Weaver
  reader, the research report and the artifact viewer, cited to WG-WEB-014 in
  two of the three, and this row records it. The other three are the tree's own
  page shells, all sixteen `mx-auto` containers under src/app measured
  2026-08-24: wide is the modal shell (7 of 16), full is the widest (4 of 16,
  the dashboard, the config index and the missions board, which spells the same
  80rem as `max-w-screen-xl`), and the block gap matches the shells' own 1.5rem
  gutter, which is what breaks the 3 to 3 tie between space-y-6 and space-y-8.

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
  handler.** `DOC-IDENT-001`, binding estate doctrine, from the identity-access
  pack: deny unless something permitted, and decide at one layer.
  `design-lint no-auth-in-route-handler` fails the
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
  2026-07-26 at 19 files and 57 sites, which was the debt and could only fall.
  DISCHARGED: the baseline file is now an empty object, zero files and zero sites,
  for this rule and every other. The connection file that carried six of those
  sites, then `src/lib/db.ts`, has since become the `src/lib/db/` directory, and
  `getGatewayPlatforms()` moved to `sync/sync-repository.ts` as
  `readGatewayPlatforms`. WO-0003 closed.
- **One reading register, dark-first, no exception.** WG-WEB-001 (A). The
  Story Weaver reader offers two page tints, `dark` and `black`, and `pageTheme`
  is typed to exactly those, so a third is a compile error rather than an
  addition nobody argued. The palette is `--ps-reader-*` in globals.css, not hex
  in the component. WO-0005. A light or sepia register is a fork: it needs a
  dated deviation, a budgeted second QC surface, and palettes minted in
  `@pattertech/ui`.
- **One writer per fact, and the config cache is a cache.** WG-ARCH-003 (B for
  the config read). Every write of `config.yaml` goes through
  `writeHermesConfigFile`, which invalidates the read cache in the same call, so
  the 15s TTL is a backstop rather than the owner of correctness. Pinned by
  `tests/unit/config-cache-invalidation.test.ts`, including a test that the
  invalidation stays OUT of `atomicWriteFile`, which also writes `.env`. A direct
  hand edit to `config.yaml` still waits for the TTL, which is what a TTL is for.
  WO-0006.
- **Contracts that leave the repo are gated.** WG-ARCH-005 (B for departing
  artefacts). `tests/unit/schema-json-drift.test.ts` regenerates
  `mission-v1.schema.json` and `template-pack-v1.schema.json` from their Zod
  sources and fails on any diff, and both halves call the same
  `buildSchemaJsonArtefacts`, so the gate cannot agree only with itself.
  `tests/unit/agentruntime-wire-contract.test.ts` asserts the port's wire
  shapes against `tests/fixtures/agentruntime-wire.json`, vendored
  byte-identical from PatterStudio with its sha256 recorded, executing ADR-0002
  decision 3. Both were proved to fail by perturbation before being believed.
  WO-0007.

- **A gate never retries.** WG-DEL-004 (C, determinism first). Playwright is at
  `retries: 0` unconditionally, and the six font families are vendored under
  `next/font/local` so the build reaches no network. The `checkout` and `npm ci`
  retries survive as quarantined flakes with a written reason and a 2027-01
  review, which is the alternative the ruling itself offers: they absorb GitHub
  and npm registry failures rather than defects in this code. WO-0002.
- **No file's knowledge of the agent framework is licensed by a number.**
  WG-ARCH-001 (B). `design-lint hermes-outside-adapter` fails the build on
  `getActiveHermesPaths`, `getAgentLlmEndpoints`, `HERMES_HOME` or `.hermes/`
  anywhere under `src/` outside `src/lib/runtime/`, `src/lib/frameworks/` and
  `src/modules/hermes/`, and as of 2026-08-22 it holds no baseline entries at
  all. The 21 crossings the ruling named, 20 by the time this landed, are gone
  as a count: four API routes now ask the AgentRuntime port, where `sessions`
  and `backups` joined `AgentWorkspace` to finish answers it was already giving
  half of, and every other site carries an inline pragma with a written reason.
  Most of those are operator prose, where the Hermes path is the payload: a
  credential warning, a parse-error alert, a restart log the operator is about
  to need. A file may still know a Hermes path; it may no longer do so silently.
  WO-0004.

**Ruled and NOT yet enforced.** Each carries its queue item; none may be quietly
dropped:

- **A move must be provable output-neutral before it is made.** WG-ARCH-006 (B).
  The canary exists now and is gated (`docs/OUTPUT_CANARY.md`, `npm run
  canary:check` in CI), which discharges the condition WG-ARCH-001's option C
  was waiting on. Whether that closes this row is WO-0008's call, not
  WO-0004's. → WO-0008.

- **No table grows without bound.** WG-ARCH-008 (A with C's seam, ruled by the
  operator). MET as of migration `032_retention.sql`, verified 2026-08-30: it
  creates `retention_policy` with a declared owner, consumer, window and floor for
  both `analytics_events` and `chat_messages`, plus an append-only
  `retention_prune_runs` record. WO-0009 closed. This row read "Unmet" for some
  time after the work landed, which is its own lesson: a ratchet nobody re-reads
  understates what the system guarantees and keeps a closed work order looking open.
- **Recorded growth survives the deletion of the history it came from.**
  WG-ARCH-003 (C for the per-Body record), ADR-0004. MET as of migration
  `031_agent_progression.sql`, verified 2026-08-30: `agent_progression_snapshots`
  is an append-only per-Body record protected by BEFORE UPDATE and BEFORE DELETE
  triggers, and the retention prune refuses to run until the capture has happened.
  WO-0010 closed.
- **A dispatched unit is rebuildable, not merely re-failable.** WG-ARCH-004 (A with
  B's seam). Unmet: boot recovery marks interrupted work failed rather than
  rebuilding it, and the LLM spend it consumed is unrecoverable. → WO-0008 and
  WO-0014.
- **A fresh install is a gate.** WG-OPS-002 (A, the native host install). Death
  #1 in the brief. Partly met: the `install-harness` job runs the harness on
  every push and pull request, the disclaimer is struck, and `docs/DEPLOY.md`
  now names one supported deployment model with the container demoted to the CI
  parity rig. All five scenarios now run: the harness step passes
  `--scenarios fresh,hermes,dashboard,both,update`, and WO-0019's cause (docker cp
  not preserving the runner uid) was fixed. Verified 2026-08-30.
  Outstanding, and NOT doable from inside the repository: the job is not yet in
  branch protection's required set. Measured 2026-08-22 via `gh api`:
  `required_status_checks.contexts` is empty, so nothing at all is required and a
  broken install still cannot block a merge. Correcting the earlier claim that
  `docker-image` sat in that set is Q-005a, sanctioned by the operator on
  2026-08-22. → WO-0011, operator's half.
- **The suite that exists is the suite that runs.** WG-DEL-002 (B). MET, verified
  2026-08-30 by listing the suite rather than counting by hand: `e2e-full`
  (ci.yml, `PLAYWRIGHT_SMOKE` unset) runs all 98 tests across 13 files on every
  pull request into main and on workflow_dispatch, while `e2e-smoke` keeps the
  5-test fast lane on every push. The old figure of "38 of 42" was wrong in both
  numbers as well as in its conclusion. WO-0012 closed.
- **Unattended work cannot spend past a number the operator set.** WG-OPS-004.
  MET as of migration `033_spend_policy.sql`, verified 2026-08-30: it creates
  `spend_policy` and seeds exactly one row with the limit optional and null by
  default, and `src/lib/spend/spend-guard.ts` pauses unattended dispatch once the
  budget is spent while leaving a hand dispatch through, because a human clicking
  dispatch is answering for the spend himself. WO-0014 closed. This one is the
  operator's own standing rule, "No spend without my approval", so it is a
  contract before it is a feature. Note the measurement it rests on was itself
  incomplete until T-0058: Composer stages recorded no tokens at all, so the
  figure the guard compares against under-counted by that whole source.

**Design contracts, at the first-build lock-in.** WG-WEB-001 rules one register,
dark-first, no exception; WG-WEB-009 one registered module-to-accent map of four
entries; WG-WEB-010 the house trio. The blocker the three shared, that no
semantic token layer existed to enforce anything against, is gone as of
2026-08-24: the Tokens section above carries a four-role surface ladder over the
appearance-named primitives, four measured text tiers and the four measures.
WG-WEB-001 stays enforced by the typed `pageTheme` recorded above. WG-WEB-009's
map now exists in src/lib/modules/registry.ts and is held to its shape by
tests/unit/lockbook-tokens.test.ts; what is still **unenforced** is that a
surface obeys its module's entry, because the nav links carry the hues the tree
grew rather than the map's, and that repaint has no queue item yet. WG-WEB-010 is
a type ruling and this sitting did not touch it.

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

**Not a deviation, recorded so it is not mistaken for one.** At Session 0 the
`auth` trigger named no wargame in the v1 corpus (EOS-FB-002), so PatterStage
drafted `WG-DRAFT-001` and ruled against it. The prescribed remedy was followed
rather than departed from. At the ADR-0008 cutover that draft retires: the rule
it carried now stands as `DOC-IDENT-001`, binding estate doctrine in the
identity-access pack, whose statement is PatterStage's rule almost word for word.
A binding doctrine binds without a venture ruling, so nothing needs to cite it for
it to hold. The structural contract it produced, authentication enforced once in
`src/proxy.ts`, is unchanged and still enforced by
`design-lint no-auth-in-route-handler`.
