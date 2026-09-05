---
summary: The EOS governance corpus leaves docs/ for org/, so docs/ holds only what a user of the product reads, and the root operators guide becomes org/EOS_OPERATORS_GUIDE.md
type: decision
tags: [process, governance, docs]
status: accepted
compiled_from: authored
---

# ADR-0010 · The governance corpus lives under org/

**Status:** ACCEPTED by Daniel Parke (operator), 2026-09-05, given as a
direct ruling when asked in the final-release planning round ("Move it under
org/, with an ADR") and confirmed by approving the programme that carries it
as decision 15 (`org/plans/2026-09-final-release.md`). The ruling is the
operator's; the wording of this record is the session's, written after the
ruling and before the move.

**Date:** 2026-09-05.
**Depends on:** ADR-0008, which adopted the v2 EOS and made `org/` the home of
this venture's governance, and which this record completes.

## Context

Four independent documentation audits in the final-release review read `docs/`
as a brand-new user would and reached the same finding: the folder that is the
product's front door holds the venture's governance corpus, written in the EOS
vocabulary, in front of the reader. Fourteen files are governance rather than
product documentation:

- `docs/LOCKBOOK.md` and `docs/RULINGS.json`, the lock-book and its rulings;
- `docs/VENTURE_BRIEF.md`, `docs/ACCEPTANCE_SPINE.md`, `docs/PRODUCT_MAP.md`,
  `docs/COMPILE_REPORT.md` and `docs/EOS_FEEDBACK.md`, the seed's artefacts;
- `docs/genesis/` (three form templates) and `docs/eos-session0/` (three raw
  Session-0 records);
- `docs/UX_AUDIT.md`, `docs/QA_NOTES.md` and `docs/QA_ROUND_6_BRIEF.md`, the
  review records written for the next reviewing session, not for a user.

The root `OPERATORS_GUIDE.md` is the fifteenth. It is the EOS operator's
manual for the human running the organisation, and its title is the one the
product needs for its own operators' guide, which the programme writes under
`docs/running/`.

`docs/README.md` explains why the corpus sits where it does: the paths are set
by the estate's scale matrix and rewritten by `scripts/tooling/eos-compile.mjs`
on every compile, "so they cannot be moved or renamed from this repo". That
constraint is no longer real. The compile has refused to run since the matrix
changed shape, deliberately, because repairing its parse would regenerate 32
files and discard every hand correction in them (`eos-compile.mjs`, the
guard-the-guard comment). Every file in the list above is hand-maintained now,
and two of them (`VENTURE_BRIEF.md`, `EOS_FEEDBACK.md`) always were. A dead
script's output path is not a reason to keep a file in front of a user.

The programme's documentation decision (decision 3) makes `docs/` the single
source for a static site and for the in-app Help. Whatever is in `docs/` is
published. The corpus must therefore be out of `docs/` before the site exists,
not filtered out of it.

## Decision

**The governance corpus moves under `org/`. `docs/` holds product
documentation only. The root operators guide becomes the EOS operators guide
under `org/`, so the product can own the title.**

### 1. The move map

Moved with `git mv`, so history follows each file.

| From | To |
|---|---|
| `docs/LOCKBOOK.md` | `org/LOCKBOOK.md` |
| `docs/RULINGS.json` | `org/RULINGS.json` |
| `docs/VENTURE_BRIEF.md` | `org/VENTURE_BRIEF.md` |
| `docs/ACCEPTANCE_SPINE.md` | `org/ACCEPTANCE_SPINE.md` |
| `docs/PRODUCT_MAP.md` | `org/PRODUCT_MAP.md` |
| `docs/COMPILE_REPORT.md` | `org/COMPILE_REPORT.md` |
| `docs/EOS_FEEDBACK.md` | `org/EOS_FEEDBACK.md` |
| `docs/genesis/*` | `org/genesis/*` |
| `docs/eos-session0/*` | `org/eos-session0/*` |
| `docs/UX_AUDIT.md` | `org/reviews/UX_AUDIT.md` |
| `docs/QA_NOTES.md` | `org/reviews/QA_NOTES.md` |
| `docs/QA_ROUND_6_BRIEF.md` | `org/reviews/QA_ROUND_6_BRIEF.md` |
| `OPERATORS_GUIDE.md` (root) | `org/EOS_OPERATORS_GUIDE.md` |

`org/reviews/` is new: the review records are read by the session that runs
the next review, which is an `org/` reader, and they are dated point-in-time
documents rather than living governance, so they get their own folder rather
than the top level. Every other destination is the top of `org/` or a folder
of the same name as before.

Not moved: `REBRANDING.md` and `TRADEMARK.md` at the root. They are legal
notices for people who redistribute the software, the root is where such
notices are looked for, and neither is governance. `docs/adr/README.md` stays
as the public pointer ADR-0008 made it.

### 2. What is updated in the same commit

- `docs/README.md` loses its Governance table and keeps one line: the
  governance layer lives under `org/`, the human's door is
  `org/EOS_OPERATORS_GUIDE.md`, an agent's is `org/START.md`.
- Every inbound reference in the tree: `docs/adr/README.md`,
  `docs/design-tokens.md`, `ops/runbooks/deploy.md`, the lock-book citations
  in `src/lib/theme.ts`, `src/lib/modules/registry.ts` and
  `tests/unit/lockbook-tokens.test.ts` (comments only), and the paths
  `scripts/tooling/eos-compile.mjs` and `scripts/tooling/check-derived-views.mjs`
  name in their comments and in `HAND_WRITTEN`.
- `org/EOS_FEEDBACK.md` gains an entry asking the estate to move the matching
  rows of `kernel/SCALE_MATRIX.md`, so a repaired compile would write to the
  new paths. Until that happens the compile's own refusal is the guard against
  it writing to the old ones.
- The link gate. `check-doc-links.mjs` walks `docs/` and resolves every
  relative target wherever it points, so links from `docs/` into `org/` stay
  checked after the move. The moved files themselves leave that walk and
  leave `design-lint`'s scan (`src`, `docs`), which is correct: the voice law
  and the link gate exist for what a user reads.

### 3. What is not changed

- `org/policy.json`. The moved files leave the `docs/` entry of
  `path_patterns.reversible` and route as ordinary paths, which is stricter
  than before and accepted. This record is the only protected-set edit.
- Task records that cite the old paths in their `claims` (`T-0093` and
  earlier). Records are historical and are not rewritten.
- The `type: venture` and `tags: [eos]` front matter on the moved files, which
  is how the EOS identifies them regardless of path.

### 4. Timing

This record lands first, as the programme's first commit (batch B0,
T-0094), before any file moves. The move itself is batch B15 (T-0109), the
batch that rewrites `docs/README.md` into the new reading path, so that
`check-doc-links` is green at every commit in between.

## Alternatives considered

- **Leave the corpus in `docs/` under its Governance heading.** The status quo.
  Lost because four audits found it in front of the new reader, and because
  the site generator publishes `docs/` whole.
- **Keep it in `docs/` and exclude it from the site by front matter.** Lost
  because it turns "docs/ is the source" into "docs/ minus a list", which is
  the two-homes drift ADR-0007 was written against, and the in-app Help would
  need the same list.
- **Delete the Session-0 artefacts instead of moving them.** `PRODUCT_MAP.md`
  is a blank form and `eos-session0/` is raw JSON nobody reads. Lost because
  `COMPILE_REPORT.md` is the seed's ancestry proof and cites them; moving
  costs nothing and deleting costs the proof.
- **Repair `eos-compile.mjs` and move the files by changing the matrix.** The
  "proper" EOS route. Lost because the repair regenerates 32 files from the
  estate's templates and discards hand corrections, which is an estate
  decision about seed ancestry and not this venture's to take alone. The
  request goes through `EOS_FEEDBACK.md` instead.
- **Rename `OPERATORS_GUIDE.md` in place rather than moving it.** Lost because
  a file about running the EOS organisation belongs with the organisation's
  other files, and the root then holds only what GitHub and a redistributor
  look for.

## Consequences and trade-offs accepted

- A new reader of `docs/` never meets the EOS vocabulary. The doors to the
  governance layer are named once, in `docs/README.md`.
- The estate's scale matrix names the old paths until the estate moves them.
  A repaired compile before that would write governance back into `docs/`;
  the compile's refusal guard and the feedback entry are the mitigation, and
  the gap is recorded here rather than assumed away.
- External links into `docs/LOCKBOOK.md` and its siblings break; GitHub does
  not redirect moved files. None are known.
- The next QA round's brief is read from `org/reviews/`, and the round-6
  records that say "docs/QA_NOTES.md" in their own text describe where the
  file was when they were written.

## Anti-patterns this guards against

A front door with the plumbing in it. An index that states a constraint
("cannot be moved") which stopped being true when the tool behind it was
retired, and which nobody re-read. A file kept where a dead script once wrote
it. And the opposite failure: deleting provenance to tidy a folder.
