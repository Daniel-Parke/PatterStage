---
summary: T-0144's codemod edited the protected set and rewrote closed records with no ADR; the four protected path lines are ratified and the closed records are restored
type: decision
tags: [process, governance]
status: accepted
compiled_from: authored
---

# ADR-0011 · T-0144's unsanctioned org edits

**Status:** ACCEPTED by Daniel Parke (operator), 2026-09-12, ruling Q-010 in
`org/reviews/2026-09-decision-register.md` (entry `org-01a`): "Split: ADR
ratifies protected, restore history". The ruling is the operator's; the wording
of this record is the session's, written after the ruling and before the
restore.

**Date:** 2026-09-12.
**Depends on:** ADR-0010, which moved the governance corpus under `org/` and
whose section 3 says task records are historical and are not rewritten.

## Context

On 2026-09-10, batch C7 of the consolidation programme (T-0144) moved 65 files
out of the `src/lib` root and rewrote every spelling of their paths by codemod.
The codemod's walk was not confined to the code it was moving. In commit
`cdf95b10` it rewrote 55 files under `org/`:

- **The protected set, four lines.** `org/policy.json:34-35`, where
  `src/lib/api-auth.ts` and `src/lib/auth-token.ts` became
  `src/lib/api/api-auth.ts` and `src/lib/api/auth-token.ts` in the
  `path_patterns.sensitive` list; `org/decisions/ADR-0009.md:90`, a
  chat-repository path; and `org/decisions/ADR-0010.md:102`, a theme path.
- **Closed records, 47 files.** 39 done task records, three Session-0
  artefacts, one dated `EOS_FEEDBACK.md` entry, and four closed plans and
  reviews. 90 line pairs across them, mostly in the records' `claims` arrays.
- Two files inside T-0144's own claims (`org/HANDOVER.md` and the consolidation
  plan), which are not at issue.

T-0144's record is mode standard, tier R2, and its single reason is
size-threshold. It names no protected path, no ADR and no approval.
`org/CONSTITUTION.md:79-81` requires an accepted ADR before an amendment and
makes an accepted ADR immutable. `org/policy.json` puts protected-set contact at
tier R3, where the operator's approval is recorded before the work.

The review found it (org-01) and the verification re-derived it: a read-only
replay of `scripts/tooling/lib-moves.json` against `cdf95b10~1` reproduces 49 of
the 55 files byte for byte, which is what a mechanical rewrite looks like.
Nothing suggests intent; the walk list simply did not exclude `org/`.

## Decision

**The four protected lines are ratified as they stand. The 47 closed records are
restored to the text they had before the codemod. A codemod's walk list is
confined to its claims.**

### 1. The protected lines stand

Reverting `org/policy.json:34-35` would put back two paths that no longer exist,
`src/lib/api-auth.ts` and `src/lib/auth-token.ts`. The sensitive list is what
gives the authentication surface its R2 floor, so a revert would take that
signal off the two files that carry it and leave the pattern matching nothing.
The ADR-0009 and ADR-0010 lines are single path strings inside accepted records;
editing them again, to restore a path that has moved, is a second amendment to
an immutable record for no gain. What was wrong was the absence of this ADR, and
this ADR is the remedy.

### 2. The closed records are restored

The 47 files are history. ADR-0010 section 3 says so in as many words, and the
value of a task record is that it says what was true when it was written. A
record whose `claims` array names a path that did not exist on the day it was
written is a small lie in a place the estate reads for provenance. They are
restored to their `cdf95b10~1` text, by a script that reverses only the path
rewrites, 90 line pairs, net zero. `T-0055` is not restored: it is proposed
rather than done, so it is live.

Two more are kept, which makes eight: `org/LOCKBOOK.md` (two lines) and
`org/plans/2026-09-final-release.md` (five). Both are living documents that
describe the tree as it is now, so the paths they name should be the paths
that exist.

### 3. A codemod is confined to its claims

Every codemod from here runs against an explicit allowlist of directories, and
`git diff --stat -- org/` is read before the commit. The oracle for T-0144
already excluded `org/`; only the scratch codemod did not, which is why the
control is the codemod's own walk list rather than a new gate.

## Corrected before it left the machine

An independent REVIEWER session read this record on the day it was written and
found three things wrong with it: it said no test read the restored files, when
this batch's own oracle reads 43 of them; it named six of the eight kept files;
and it borrowed a line-pair count from a different list. All three are corrected
above, in the same batch, before the record was pushed. The ruling is unchanged.

## Alternatives considered

- **Ratify everything, restore nothing.** Simplest, and it leaves 47 closed
  records saying something that was not true when they were written, with no
  record of why. Lost on that.
- **Revert everything, including the protected lines.** Consistent, and it
  removes the auth-surface signal from the two moved files while re-editing two
  accepted ADRs to reinsert stale paths. It also needs its own ADR, because the
  protected set is protected in both directions. Lost on that.
- **Treat it as a breach and re-run C7 under an R3 record.** The work is landed,
  gated and swept; re-running it would change nothing in `src` and would rewrite
  history a second time.

## Consequences and trade-offs accepted

- `org/policy.json` keeps a change that reached it without an ADR. This record
  is the sanction, dated after the fact, and says so plainly.
- Two accepted ADRs keep a rewritten path string. The alternative was to edit
  them again.
- 43 of the 47 restored files are gated by this batch's own oracle, which goes
  red if any of them is rewritten again. The four closed plans and reviews are
  not, and neither are the two living documents kept above: nothing in the tree
  separates a closed plan from a living one without a filename list, and a rule
  that fails a file we mean to keep is worse than no rule. Those six rest on the
  diff against `cdf95b10~1`.
- The estate sees a venture that ratified a breach rather than reverting it; the
  reasoning is here so a reader can disagree with it.

## Anti-patterns this guards against

A codemod that walks further than the work. A governance file edited by a tool
whose author never saw it. And the opposite failure: reverting a correct change
because of how it arrived, and taking a security signal off the files that need
it to make a point about process.
