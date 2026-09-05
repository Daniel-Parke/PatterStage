---
summary: One shared repo for the estate's agnostic layers; PatterStage vendors the design kit by copy-in first
type: decision
tags: [arch, web, brand]
status: accepted
compiled_from: preserved
---

# ADR-0003 · Shared kit distribution

**Status:** accepted by Daniel, 2026-07-25. Part 2 is an estate-level
change and needs its own EOS decision before it is executed.
**Date:** 2026-07-25.

## Context

The estate has the same capability implemented four times over:

| Layer | Where it lives now |
|---|---|
| Design tokens | EOS `TOKENS.md` doctrine · `PatterTech_Website/globals.css` · `PatterStudio/shared/ui/theme.css` · PatterStage's own `globals.css` |
| Org → Venture → Project resolution | `PatterStudio/shared/paths` · `PatterTech_App/api` · absent from PatterStage |
| Run / agent-event shapes | `PatterStudio/shared/schemas` · PatterStage's `runs` table |
| Graph node semantics | PatterStage's Composer · `PatterStudio/platform/orchestration/nodes.py` |

`@pattertech/ui` is real and good: Cherenkov tokens as Tailwind v4 `@theme` plus
typed CVA primitives, already consumed by `PatterStudio/apps/studio`. PatterStage
hand-ported those tokens and drifted — different surface ramp, different
success/danger, four extra accents, no display face, and three different cyans
hardcoded in one stylesheet.

The owner's constraint is explicit: **do not end up managing dozens of repos.**

Two facts bound the solution. PatterStage is public Apache-2.0 and must stay
installable by strangers with no private dependencies. And the estate has already
chosen a distribution model for exactly this: `repos.yaml` describes the planned
`PatterTech_WebKit` as "distributed by a shadcn-style copy-in registry".

## Decision

**Part 1, now: PatterStage vendors the kit.**

`@pattertech/ui` is copied verbatim into `src/kit/` with a `PROVENANCE.md`
recording the source repo and commit, and a CI drift test that fails when the
vendored copy diverges from its recorded source. No cross-repo coupling, nothing
private in the dependency tree, and the rebuild is unblocked today.

**Part 2, later: one shared repo, not several.**

`PatterTech_Core` — public, Apache-2.0, polyglot:

```
contracts/     ONE JSON Schema source of truth
  org.schema.json      Organisation → Venture → Project
  run.schema.json      run, agent event, usage
  graph.schema.json    node / edge / verdict / outcome / gate   (ADR-0002)
ts/  @pattertech/ui  @pattertech/contracts   (generated)
py/  pattertech-contracts                    (generated)
```

`@pattertech/ui` moves out of PatterStudio into it. The planned
`PatterTech_WebKit` repo is **cancelled and folded in** — one fewer repo, which is
the owner's stated constraint.

## Consequences

- PatterStage stops minting design tokens immediately. Any new token is a change to
  the shared kit, not to `globals.css`.
- The vendored copy is byte-identical to the future package, so Part 2 is a
  mechanical move rather than a migration.
- Part 2 changes ownership recorded in the estate manifest (PatterStudio currently
  owns PatterStack), so it needs an EOS decision, not just this one.
- A document factory owning the estate's screen design system is an accident of
  history; this ends it.

## Alternatives rejected

- **A repo per layer.** Directly contradicts the owner's constraint.
- **Put it in PatterOS.** Wrong home: PatterOS is the base, the provisioner and the
  sovereignty charter, not a library host.
- **Depend on PatterStudio directly.** PatterStudio is private; this would make the
  public product unbuildable by anyone outside the estate.
- **Leave the drift.** It is already producing shipped defects: two dead Tailwind
  classes from a typo'd token, and an entire hover treatment Tailwind never compiles.
