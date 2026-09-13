---
summary: dev is the integration trunk; WORK branches from dev, done means merged to green dev, main moves only through gated release PRs
type: decision
tags: [process, governance]
status: accepted
compiled_from: preserved
---

# ADR-0006 · dev is the integration trunk

**Status:** accepted by Daniel (operator), 2026-08-22, in the interactive
sign-off round following plan approval. Proposed the same day by PLAN session
S-0002 under `org/plans/2026-08-consolidation.md`.
**Date:** 2026-08-22.

## Context

The governing files disagree about where work branches from and what "done"
means, and the disagreement sat unrecorded until the 2026-08 consolidation
plan surfaced it:

- `org/roles/WORK.md:21` tells a WORK session to create "a short-lived branch
  off `main`", and `org/OPERATING_MODEL.md` section 4 says the same.
- `docs/CONTRIBUTING.md` says "Branch from `dev` (not `main`)", "Open a PR into
  `dev`", and "`main` only moves through reviewed PRs", and that is what every
  merged PR in this repository's history actually did.
- The operating model's Definition of Done says "Merged to a green `main`",
  while practised doctrine closes work on a green `dev` and promotes `dev` to
  `main` at releases (PR #146 and its nine predecessors, and the open PR #157).

`org/roles/*` is in the constitution's protected set, so the mismatch cannot be
fixed as an ordinary documentation edit. It needs a decision through Part III
change control. Until that decision exists, every session is either disobeying
a charter or disobeying the practised doctrine of the repository.

## Decision

**`dev` is the integration trunk. `main` is the release branch.**

1. WORK sessions branch from `dev` and open PRs into `dev`, exactly as
   `docs/CONTRIBUTING.md` describes.
2. A queue row's "done" means: merged to a green `dev`, with a VERIFY verdict
   recorded on the row.
3. The Definition of Done's "merged to a green `main`" is satisfied at
   releases: the operator merges `dev` into `main` through a gated release PR
   (full Playwright matrix with PLAYWRIGHT_SMOKE unset, the real-Hermes suite,
   and the upgrade-path test, results recorded). Part II Article 9 ("main is
   always releasable") is preserved because `main` only ever receives
   release-gated merges.
4. WO-0029 amends `org/roles/WORK.md` and `org/OPERATING_MODEL.md` section 4 to
   say the above, and runs only after this ADR is accepted, at the ladder's top
   tier with the operator approving the diff.

## Alternatives considered

- **Obey WORK.md literally and branch off `main`.** Rejected: `main` is 203
  commits behind `dev`; work branched from it could not merge into `dev`
  without conflicts against the entire consolidation history, and every
  practised merge in the repo contradicts it.
- **Collapse to a single trunk (`main` only).** Rejected for now: it would put
  unreleased work on the public default branch continuously, which is a larger
  product decision than this mismatch warrants, and the operator's release
  ruling (one gated release at programme end) presumes the two-branch shape.

## Consequences and trade-offs accepted

- Until WO-0029 lands, the charter text and this ADR disagree on wording; this
  ADR plus `docs/CONTRIBUTING.md` govern in the meantime, and the paper trail
  says so rather than leaving sessions to guess.
- "Green dev" becomes load-bearing: CI on `dev` must actually be watched,
  which WO-0018 exists to restore.

## Anti-patterns this guards against

Silent doctrine drift (charters describing a workflow nobody practises);
sessions branching from a stale `main` and integrating against the wrong tree;
"done" quietly meaning whatever the closing session wants it to mean.
