---
summary: Adopt the v2 EOS by recompile at ORG scale; the v1 org machinery is replaced, judgement is preserved verbatim
type: decision
tags: [process, governance, eos]
status: accepted
compiled_from: preserved
---

# ADR-0008 · Adopt the v2 EOS by recompile at ORG scale

**Status:** accepted by Daniel (operator), 2026-08-22, in the interactive
sign-off round of the consolidation programme (recorded rulings in
`org/plans/2026-08-consolidation.md` section 12).
**Date:** 2026-08-22.
**Supersedes:** ADR-0007 (the ADR-home question is re-ruled here under v2
conventions: the home becomes `org/decisions/`).

## Context

PatterStage was seeded by EOS Session 0 on 2026-07-25 against EOS v1.0 at
commit `cc18755`. Since then the EOS (`../PatterTech_EOS`) has been rebuilt
end to end: the v1 architecture is archived at the `archive/v1-final` tag, the
history was rewritten (so `cc18755` no longer resolves; its post-rewrite
identity is `c6f94df`, per the EOS's filter-repo commit map), and the current
line (tooling 0.4.0, unreleased) runs a different machine: atomic Doctrine
with authority grades, pressure-selected Wargames, venture-owned Rulings in a
structured `docs/RULINGS.json`, situational charters (EXECUTOR, ORACLE,
REVIEWER) under router-ruled execution modes (R0 to R3), JSON task records
instead of a queue file, and derived rather than hand-kept state. Scale M no
longer exists; v1's M and L merge into ORG. The EOS's own migration playbook
(`org/migration/PLAYBOOK.md`) prescribes the **recompile** route for a
venture in PatterStage's position: Session 0 re-run from the existing ruled
lock-book, interview as a confirmation pass, phases C to E against the v2
matrix, everything judgement-shaped preserved verbatim. The `migrate apply`
engine refuses real repositories by design, so the transforms are manual work
in this repo guided by the plan output.

Separately, the EOS never recorded PatterStage's Session 0: it has no
`registry/PROJECTS.md` row and appears in the estate manifest only as the
ungoverned candidate "Venture E", which is why none of PatterStage's five
filed feedback items was ever harvested.

## Decision

**PatterStage adopts the current v2 EOS by the recompile route, at ORG
scale**, sequenced after the consolidation programme's Phase 0 (green CI) and
Phase 0b (branch consolidation), and before all remaining programme work,
which then executes as v2 task records.

1. **Pin repair.** The dead pin `cc18755` is recorded as translated to
   `c6f94df` (reachable from the pushed `archive/v1-final` tag) wherever the
   old id appears; the new pin is the current pushed head of the EOS at
   adoption time.
2. **Recompile at ORG.** The v2 kernel templates replace the v1 org
   machinery: `AGENTS.md`/`CLAUDE.md`, `org/CONSTITUTION.md` (Part I product
   doctrine carries over verbatim), `org/START.md`, `org/TESTING.md`,
   `org/TEMPLATES.md`, `org/QUESTIONS.md`, `org/PLAYBOOKS.md`,
   `org/GRAPH_BUILD.md`, `org/policy.json` (guard validated: false, so
   guarded action classes are manual-only), `org/cadence.json`,
   `org/claims.json`, and `org/roles/{EXECUTOR,ORACLE,REVIEWER}.md`.
   Deleted with no successor: `org/OPERATING_MODEL.md`, `org/QUEUE.md`,
   `org/CADENCE.md`, hand-kept `org/STATE.md`, `org/roles/{PLAN,WORK,VERIFY}.md`,
   and the session-log convention (git is the log; the final v1-style log
   records the migration itself).
3. **Rulings migration.** The lock-book's 31 header rulings move into
   `docs/RULINGS.json` (v2 schema, with a selection log); the five
   "undefined" compile-defect notes are restored from the Session 0 walk
   records; the one aliased id is re-keyed (WG-OPS-003 to WG-DEVOPS-005); the
   22 retired-id rulings are carried as provenance with an explicit triage
   note each (their contracts stay enforced; re-ruling against live analogues
   happens as tasks, not silently); WG-DRAFT-001 is retired in favour of
   citing the now-binding estate doctrine DOC-IDENT-001, which its rule
   became. The lock-book header gains `policy_profile`, `packs_adopted`,
   `rulings_record`, scale ORG, and the new pin.
4. **Queue conversion.** Every open queue row becomes an `org/tasks/T-####.json`
   record (intent, declared side effects, preserved acceptance as oracle
   material); statuses map ready to proposed, in_verification to in-review,
   superseded to discarded-with-note. Closed rows stay in git history.
5. **ADR home.** All ADRs move to `org/decisions/` under the
   `ADR-####-slug.md` naming (v2-native; the constitution's protected-set
   path becomes literally true); `docs/adr/README.md` remains as a public
   pointer. This supersedes ADR-0007's proposal.
6. **Registration.** PatterStage registers with the EOS: a
   `registry/PROJECTS.md` row (the sanctioned cross-repo write), the
   `estate/repos.json` run-engine line corrected per accepted ADR-0002, and
   PatterStage's `docs/EOS_FEEDBACK.md` re-cut to the v2 template with
   privacy-reviewed summaries (FB-001/003/005 recorded as independently
   resolved; FB-002 re-aimed as a worked-ruling offer against the
   identity-access pack; FB-004, the missing local-app stack profile, kept).
   Operator ruling: these EOS-side writes land directly on the EOS's dev
   branch.
7. **Gate.** `python -m tools.eos check --seed` at zero errors, and the
   operator re-signs the human rubric headed by the cold-start test (a
   migrated seed is a new seed). PatterStage's own gates (lint, doc links,
   design-lint baselines, tests, build) stay green through the cutover.
8. **What is preserved verbatim:** every ADR, the ruling content with
   argued/inherited marks, `docs/EOS_FEEDBACK.md`'s substance, the venture
   brief, and all product/design material. ADR-0006 (dev is the integration
   trunk) survives unchanged; it is orthogonal to the kernel version.

## Alternatives considered

- **Stay on v1.** The pin is dead, the v1 kernel is archived, and the v1
  process vocabulary (tiers, gates, WIP=1, session logs) would govern a
  further twenty tasks while its replacement sits one directory away.
  Rejected by the operator directly.
- **The `apply` route.** The code heuristic routes `v1.0` to apply, but the
  playbook prose routes v-prefixed pins to recompile, the pin is not a
  released v1 kernel, M must become ORG anyway, and `migrate apply`
  physically refuses git repositories. Not actually available.
- **Fresh inception.** Discards the ruled lock-book, the 31 argued rulings
  and the interview record for no gain; the recompile route exists precisely
  to avoid this.

## Consequences and trade-offs accepted

- v2 is unreleased; the pin is a moving dev line's pushed commit. Future
  PB-E06 upgrade passes are expected, and 1.0's eight-item gate may change
  details. Accepted knowingly.
- The consolidation plan's process vocabulary (T-tiers, G-gates, WIP=1,
  VERIFY-merges) is superseded from the cutover; the plan's substantive
  content (phases, dispositions, risk register, scope lists) carries into
  the task records unchanged.
- Open questions Q-004, Q-006 and Q-007 dissolve structurally (the files
  they concern are retired); Q-005's corrections ride the rulings migration;
  Q-008 is promoted to a task.

## Anti-patterns this guards against

Running a fleet under a governance model its own estate has retired; a
dangling pin nobody can check a seed against; judgement (rulings, ADRs)
being lost in a machinery swap; the venture staying invisible to the
harvest that exists to learn from it.
