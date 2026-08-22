---
summary: docs/adr/ is the single ADR home; org/decisions/ holds a pointer so the constitutional path stays true
type: decision
tags: [process, governance]
status: superseded
compiled_from: preserved
---

# ADR-0007 · The ADR home is docs/adr/

**Status:** superseded by ADR-0008 before acceptance, 2026-08-22. The operator
declined this proposal in the interactive sign-off round and ruled the
opposite under v2 EOS conventions: the ADR home becomes `org/decisions/`
(v2-native), with `docs/adr/README.md` kept as a public pointer. See
`0008-adopt-the-v2-eos.md`, Decision item 5.
**Date:** 2026-08-22.

## Context

The constitution's protected set names `org/decisions/*` (ADRs), and
`org/roles/PLAN.md` says PLAN produces "ADRs in `org/decisions/`". On disk,
`org/decisions/` is empty, and the five accepted ADRs (0001 to 0005) live in
`docs/adr/` under an `NNNN-slug.md` naming scheme, where external readers of a
public repository expect to find them. `org/TEMPLATES.md` still templates the
decision path as `org/decisions/ADR-####-<slug>.md`. Two homes are described;
one is real.

## Decision

**`docs/adr/` is the single home for ADRs, existing and future.**

1. `org/decisions/README.md` is a pointer file stating that the venture's ADRs
   live in `docs/adr/`, so the constitution's protected-set path resolves to
   something true rather than to an empty directory.
2. The protected set reads onto the real home: `docs/adr/*` carries the same
   protection as `org/decisions/*` (amendments only as new superseding ADRs
   with operator approval; accepted ADRs immutable).
3. `org/TEMPLATES.md`'s decision-path line is updated to `docs/adr/` by an
   ordinary PLAN edit once this ADR is accepted (TEMPLATES is not in the
   protected set).

## Alternatives considered

- **Move the five ADRs into `org/decisions/`.** Rejected: it churns accepted,
  immutable records, breaks every existing `docs/adr/` link inside and outside
  the repo, and hides the decisions from the public readers a public product
  wants to show them to.
- **Keep both homes.** Rejected: two homes guarantee drift, and the current
  state (one empty, one real) is exactly that drift.

## Consequences and trade-offs accepted

- The constitution's literal string `org/decisions/*` stays as written; the
  pointer file makes it true by reference rather than by relocation. If the
  constitution is ever amended for other reasons, the path can be updated to
  `docs/adr/*` in the same change.

## Anti-patterns this guards against

Derived-state drift between governing files and the tree; decisions filed
where no reader looks; an empty protected directory lending false confidence
that no decisions exist.
