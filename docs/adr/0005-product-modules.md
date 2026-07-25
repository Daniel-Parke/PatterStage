---
summary: Product surfaces plug in through one ProductModule seam; Rec Room is the first tenant and the proof
type: decision
tags: [arch, product]
status: accepted
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
2. **Path coupling, which is the real job.** `getActiveHermesPaths` in 7 core
   modules is the framework-agnostic claim failing out loud: orchestration and
   sync code knows where Hermes keeps its files. Each site goes behind the
   `AgentRuntime` port or an `AgentWorkspace` accessor before the module can move.

Ordering: (1) first, because it is nearly free and shrinks the problem; then (2)
site by site, watching `hermes-outside-adapter` in design-lint fall from its
baselined 45; then the directory move, which by then is mechanical.

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
