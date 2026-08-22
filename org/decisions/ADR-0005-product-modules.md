---
summary: Product surfaces plug in through one ProductModule seam; Rec Room is the first tenant and the proof
type: decision
tags: [arch, product]
status: accepted
compiled_from: preserved
---

# ADR-0005 · Product modules

**Status:** accepted by Daniel, 2026-07-25.
**Date:** 2026-07-25.

## Context

ADR-0001 says PatterStage hosts other products' *work*. It does not yet say how
anything plugs in, and today the answer is: it does not. Adding a surface means
editing a hardcoded 165-line array in `src/components/layout/sidebar-config.ts`,
mirroring it by hand into `tests/e2e/app-routes.ts`, hand-writing a migration
applier into a 26-call chain in `db.ts`, and creating an app-router subtree. The
2026-07 review scored readiness to host a second product at 3/10, and named the
absence of an extension point as the blocker.

Rec Room is the right place to fix this. The owner's intent is that it is "a place
to pursue creative endeavours while your Agent is working", with Story Weaver the
first of many applications. That makes it a genuine second product inside the
repo, owned by us, and safe to break, which is exactly what a seam needs in order to
be proven rather than asserted. A seam with one tenant is scaffolding; a seam that
carries a real product is a contract.

## Decision

**One `ProductModule` contract. Every surface is a module, including the ones that
exist today.**

A module declares:

| Field | Purpose |
|---|---|
| `id`, `title`, `icon`, `accent` | Identity |
| `nav` | Its sidebar entries. The sidebar is **derived** from the registry, and so is the e2e route matrix; the hand-mirrored copy goes. |
| `routes` | Its app-router segment |
| `jobKinds` | Work it can register with the scheduler, per ADR-0001 |
| `migrations` | Its own schema, applied by the shared runner rather than a bespoke applier |
| `health` | An optional probe surfaced on the console |
| `enabled` | A feature flag, so a module can ship dark |

Rules:

1. **The core never imports a module.** Modules import core. This is enforced by a
   lint rule, not by convention, because the review found that a boundary an agent
   can cross without a red build does not exist.
2. **A module owns its own tables**, prefixed, and never reads another module's.
3. **Cross-module communication goes through the job model or MCP**, never a direct
   import. This is the same rule the estate applies to PatterStack.
4. `hermes`, `rec-room` and `laboratory` become modules. The console verbs
   (found, commission, gate, watch) stay in core.

Rec Room is built first and is the acceptance test: if adding Story Weaver's
successor does not require touching core, the seam works.

## Physical layout, reviewed against Next.js 16

Reviewed 2026-07-25 against the App Router project-structure documentation,
because "move surfaces into `src/modules/<id>/`" sounded like it might fight the
framework. It does not. Next.js is explicitly **unopinionated** here, and the
first strategy the docs name is *"Store project files outside of `app`: stores
all application code in shared folders in the root of your project and keeps the
`app` directory purely for routing purposes."* That is exactly this ADR.

The one hard constraint is that a route is only a route when `page.tsx`,
`route.ts` or `layout.tsx` sits at the matching path under `app/`. So:

```
src/app/orchestration/composer/page.tsx     routing only, delegates
src/modules/core/composer/                  the actual page, logic, data access
```

Rules:

- **`app/` holds routing files and nothing else.** Each `page.tsx` is a thin
  shell that renders a component the module exports. `route.ts` handlers likewise
  delegate to a module handler.
- **A module owns its components, hooks, lib and data access.** Cross-module
  reads go through the job model or MCP (ADR-0001), never a direct import.
- Two other sanctioned tools are deliberately NOT used, and it is worth saying
  why so nobody adds them later thinking they were forgotten:
  - *Colocation / private folders* (`app/blog/_components/`) is idiomatic for
    route-local UI, but it scatters a module's code across the route tree, which
    is precisely what makes a boundary lint impossible to write.
  - *Route groups* (`(folder)`) organise URLs, not ownership. The repo already
    uses one, `(main)`, and that stays; mirroring module ids into route groups
    would restate the registry in the filesystem and let the two disagree.
- The move is **incremental**: a module is migrated when it is next worked on,
  not in one sweep. The boundary lint starts in report-only mode and gains teeth
  per module, because a rule that red-builds the whole tree on day one is a rule
  that gets deleted.

## The hermes module: measured, not guessed

`rec-room` moved in one commit because nothing in core imported it. `hermes` is
the opposite, and the numbers say why. Core importers, excluding other
`hermes-*` files and excluding `app/` (which is routing and may delegate):

| file | core importers | note |
|---|---|---|
| `hermes-agent-runtime` | 14 | `getActiveHermesPaths` is 7 of them |
| `hermes-providers` | 10 → **4** | done, see below |
| `hermes-profile-paths` | 5 | |
| `hermes-config-sync` | 4 | app-heavy (7 route importers) |
| `hermes-profile-sync` | 3 | app-heavy (8) |
| `hermes-toolset-catalog` | 3 | |
| `hermes-toolset-unify` | 2 | |
| `hermes-toolset-normalize` | 2 | |
| `hermes-home` | 1 | |
| `hermes-paths` | 0 | but imported by three `hermes-*` files that stay |
| `hermes-import`, `hermes-state-import` | 0 | app-only consumers |

**So moving the directory is not the work.** A file move would create roughly 45
`core-imports-no-module` violations, and baselining them would defeat the rule
that makes the module mean anything. The work is removing the reason core imports
Hermes at all, and it splits into two very different halves:

1. **Vocabulary coupling, which is cheap. DONE.** Eight of `hermes-providers`'
   ten core importers wanted only `TaskType` / `TASK_TYPES`, and those name
   PatterStage's OWN columns, the 12 `is_default_<task>` fields in migration
   006. They mirror Hermes' auxiliary slots, but mirroring is not ownership: a
   second framework would map onto these slots rather than replace them. Moved to
   `src/lib/models/task-types.ts` (core). Core importers fell 10 → 4, and the
   four that remain are real Hermes knowledge: the provider list, the type, and
   the env-var lookup.

   Worth recording how this was nearly got wrong: a first pass with `grep -B3`
   attributed `DefaultsModelOption` and `ModelEditorRecord` to this file. Both
   actually live in `components/models`; the grep had picked up neighbouring
   import lines. The conclusion held only because the counts were re-measured
   per-file before acting.
2. **Path coupling, the real job. FIRST PASS DONE.** `getActiveHermesPaths` was
   called in thirteen core modules: orchestration and sync code knew where Hermes
   keeps its files, and a grep could prove the framework-agnostic claim false.

   `src/lib/runtime/workspace.ts` is the missing half of the port. `AgentRuntime`
   covers what the agent DOES; `AgentWorkspace` covers where its files are, in
   five neutral fields (root, logs, config, env, memoryDb). Nine core modules now
   depend on that instead of on Hermes.

   It is deliberately narrow. `HermesPathBundle` has 19 fields and core only ever
   needed five; a neutral interface mirroring all nineteen would just be the
   Hermes bundle wearing a different name. `ConfigSync` was reverted to importing
   Hermes directly, because it genuinely needs `SOUL.md`. Leaving that coupling
   visible is better than smuggling a Hermes concept into a neutral type.

   Measured: `hermes-agent-runtime` core importers 14 → 6, and the
   `hermes-outside-adapter` lint 45 → 26.

   `src/lib/runtime/gateway.ts` finished the job. Four sites wanted
   `getAgentLlmEndpoints`, and not one of them used any Hermes knowledge beyond
   the URL it returned: an OpenAI-compatible chat endpoint is the most
   framework-neutral thing in the system, and it counted against the claim
   purely because of which file the constant lived in. `AgentGateway` is two
   fields, `baseUrl` and `chatCompletionsUrl`. `endpoint-registry` keeps its
   per-profile routing (including the ephemeral benchmark gateways) layered on
   top.

   That is the port complete: **what the agent does** (`AgentRuntime`), **where
   its files are** (`AgentWorkspace`), **where it answers** (`AgentGateway`).

   Measured: `hermes-agent-runtime` core importers 14 → **5**, and two of those
   five ARE the port files, which are meant to know. Genuine core coupling is
   **three** files, and each is honest: `behavior-files` (needs eight
   Hermes-specific file paths), `ConfigSync` (SOUL.md), `session-title-server`
   (`getActiveHermesHome`). `hermes-outside-adapter` in design-lint fell 45 → 26
   and now also fails on `getAgentLlmEndpoints`, so the new seam is a red build
   rather than a convention.

   What remains before the directory move is not path or gateway coupling but
   the Hermes-shaped surfaces themselves (config sync, profiles, toolsets),
   which move with the module rather than ahead of it.

## The move itself: measured, staged, COMPLETE

"The directory move is now mechanical" was wrong, and it is worth recording why
so the mistake is not repeated. That claim was measured on `hermes-agent-runtime`
alone, which had 3 core importers. Across all twelve files the real figure was
**25 importer edges over 22 distinct core files**. A blind `git mv` would have
created 25 `core-imports-no-module` violations.

Three plans were drafted for the move under different lenses and an adversarial
pass found **all three red-build**, every time for the same reason: a hermes file
moved while a core file still imported it. So the ordering rule is topological,
not file-count: **a file moves only once every core importer of it is resolved.**

Landed so far, each slice independently gate-green:

| slice | what | edges |
|---|---|---|
| prep | two free deletions, one port repoint, two neutral extractions | 25 → 21 |
| 1 | the 5 zero-importer files, module created | 21 → 21 |
| 2 | 6 co-travellers + `config-sync` | 21 → 14 |
| 3 | the 2 Hermes-subject components | 14 → 12 |
| 4 | agent_profiles and its codecs, 9 files | 12 → 6 |
| 5 | the last 6 edges, then the final 3 files | 6 → **1** |
| 6 | catalog-seed split along its two owners | **1** |

Two mechanisms make an incremental move safe:

- **A transitional exemption that deletes itself.** A partial move makes the
  files still in `src/lib` import `@/modules/hermes`, which the rule forbids. So
  `src/lib/hermes-*.ts` is exempt while the move is in flight. A temporary
  exemption nobody must remove is a permanent one, so design-lint **fails the
  build the moment `src/lib` holds no `hermes-*.ts` file**, naming the clauses to
  delete.
- **A baseline discipline for re-keying.** The baseline keys on file path, so
  moving a file with debt makes it look new. Every move verifies the delta
  against HEAD: keys may be re-keyed at the same count, and **no surviving file
  may gain a violation**. Slice 2 shrank it 924 → 922 honestly (behavior-files'
  two violations became legitimately exempt inside the adapter); slice 3 was a
  1-for-1 re-key at 922.

Two findings worth keeping. `sortedUnique`-style toolset algebra was being
recomputed client-side in two hooks when the route already returned the same
union as `unifiedEnabled`. Deleting the duplicates removed both hooks' only
Hermes imports and one redundant fan-in. And `getActiveHermesPaths().root` is
literally `getHermesHome()`, so `AgentWorkspace.root` already covered
`path-security`'s allowlist with no new seam.

### How the last 12 edges resolved

They were decisions, not moves, and the owner ruled on the four that were his:

1. **The `hermes` module owns `agent_profiles`** (ruled yes). Every content column
   of that table mirrors a Hermes file, so rule 2 applies. Nine files travelled:
   `profiles-repository`, `profile-config-builder`, `skills-config`,
   `agent-file-store`, `seed-profile-toolsets`, plus `toolset-normalize`,
   `profile-sync`, `profile-paths` and the framework adapter.

   Core kept one honest question and it needed two fields. Mission dispatch
   resolved what the operator typed by scanning `listProfiles()` for a
   slug-or-displayName match: a framework-neutral question answered by reading a
   17-column row. `src/lib/agents/roster.ts` exposes `AgentRosterEntry`
   {slug, displayName} through the composition root. Deliberately NOT a re-export
   of `AgentProfileRow`, which would be the module's table wearing a neutral name.
2. **Benchmarks were deleted** (see docs/adr/0004, amended). `bench-agent`'s 2
   edges went with them.
3. **Schema-level vendor naming: partially done, and I overruled part of it.** The
   owner ruled "rename now in a migration". On measuring each object, only ONE was
   a naming problem and it needed no migration: `sessions.agent_type` already had
   a neutral column name, and the coupling was core supplying the literal
   `"hermes"` as its default. `AgentType` is now `FrameworkType` and the default
   comes from the frameworks layer.

   I initially declined to rename `hermes_md` and `cron_jobs.hermes_job_id`, on
   the grounds that both names were ACCURATE (they hold a Hermes file's contents
   and a Hermes-minted job id) and the ConfigSync precedent says visible coupling
   beats a neutral-sounding alias. **The owner reaffirmed the ruling and both were
   renamed in migration 030**, to `framework_md` and `external_job_id`.

   The counter-argument stands on its own and is worth recording: PatterStage owns
   these tables, and a schema that names one vendor makes the second one a special
   case forever. The ConfigSync precedent is about not inventing a neutral type to
   hide a real dependency; a column in PatterStage's own table is not that.

   `framework_md` rather than `agent_md` because `agents_md` (AGENTS.md) already
   exists and two columns one character apart is a defect waiting to happen.
4. **`src/types/hermes.ts` renamed to `src/types/console.ts`** (ruled yes). 60
   importers, none of its exports Hermes-anything: `ApiResponse`, `Mission`,
   `AccentColor`. A grep for "hermes" in core was returning 60 false positives
   from one file. `HermesProcess` kept its name on purpose: it describes what
   `ps aux` shows.

The remaining six closed on their own merits, not by pragma:
`session-title-server` and `ConfigSync` through two new ServerModule
capabilities; `credentials-repository` by moving a guard that asked Hermes "do
you have an env var for this?" to mean "is this OAuth-only?" out to the
composition point that asks it; `ModelEditor` by prop injection; and
`ToolsetSelector` by a hook over `/api/tools`, which its sibling hook already
called. `ToolsetSelector` had been pencilled in for a pragma; the hook turned out
cheaper than the exception.

### Where it landed

`src/lib` holds **zero** `hermes-*.ts` files. `src/modules/hermes/` holds 30
across `lib/`, `handlers/`, `components/`, `sync/` and `server.ts`. **25 edges
became 1.**

That one is deliberate: `api-schemas.ts` imports `HERMES_PROVIDERS` behind a
pragma with a written reason. Moving the list into core would be worse, not
better: its own comment says the first fourteen entries must stay in lock-step
with the agent CLI's `--provider` choices, so relocating it would keep the
coupling and make it invisible, which is the failure this boundary exists to
prevent. The reviewed alternative, widening `providerSchema` to `z.string()`,
weakens validation for every caller to buy a boundary.

**Three composition points**, all named in one place so none is undeclared:
`modules/server.ts` (module capability), `frameworks/registry.ts` (framework id to
adapter) and `src/lib/runtime/` (the port, whose files already said in their own
headers that they are the one file that knows the answer comes from Hermes).
`core-imports-no-module` and `hermes-outside-adapter` now agree on which directory
is the adapter layer instead of each having its own idea.

**The transitional exemption deleted itself**, as designed. On the last move
design-lint failed with "the hermes module move is COMPLETE, so delete its
transitional exemption", naming the clauses. Both are gone along with the guard
that removed them.

**`catalog-seed` was split last**, and only after the rest: it had two owners and
always did, so the line had to be decided rather than moved. Core keeps the
orchestration, the once-only meta flag and its own catalogs; the module gets
`seedAgentCatalog` and `publishSkill`. The `skills` table stays core and only the
write-through crosses. Writing its test caught a regression introduced in the same
change: moving a try/catch into the module had left core's call bare, so a
throwing module would have killed the boot seed.

### What the claim is now, stated precisely

**No core file knows the Hermes filesystem or protocol**, and a lint rule fails
the build if one starts to. That is testable and true.

The schema no longer names the vendor either, as of migration 030. The one
remaining occurrence is `sessions.agent_type` storing the VALUE `'hermes'`, which
is legitimate and stays: it is the framework's registry id, and core no longer
supplies it as a hardcoded literal (it comes from the frameworks layer).

What the claim still does NOT cover, stated so nobody mistakes the boundary for
more than it is: `app/` may import a module by design, the `hermes` word survives
in user-visible surfaces that name real Hermes files (the `/config/hermes_md`
route, `agent-file-store`'s `"hermes"` file key), and `tests/` is outside the lint
rule entirely.

Doing the move first would produce a module that only looks separated, which is
the `frameworks` registry mistake this ADR exists to avoid repeating.

## Consequences

- The sidebar, the e2e route matrix and the migration chain all become derived
  from one registry, removing three sources of hand-mirrored drift the review
  found.
- Story Weaver is rebuilt on the seam rather than patched: its dead Characters and
  Themes pages, its unthrottled generation loop and its forked design system are
  fixed in the rebuild rather than carried across.
- The Hermes surface becoming a module is what finally makes the
  framework-agnostic claim testable: a boundary lint can then assert that nothing
  outside `modules/hermes/` knows the Hermes filesystem layout.
- PatterStudio and the EOS plug in later through the same contract, without any of
  their UI entering this repo.

## Alternatives rejected

- **Build the contract with no tenant.** An untested seam is the `frameworks`
  registry again: 205 lines, one read-only consumer, a config field nothing reads.
- **Rebuild Story Weaver in place and generalise later.** The owner asked for the
  module contract, and it is cheaper to extract a seam while writing the second
  product than to retrofit it afterwards.
