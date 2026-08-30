---
summary: PatterStage questions, the human decision queue and its folding rule
type: venture
tags: [eos]
compiled_from: kernel/templates/org/QUESTIONS.tpl.md
---

# QUESTIONS · Human decision queue

Anything an AI session must not decide lands here. Operator: answer
inline under each item; a PLAN session folds answers into decisions,
specs or registries and marks the item folded. Sessions blocked on a
question say so in `org/STATE.md` and move to other work.

Entry format: `Q-### (domain): the question, the context link, and the
owner.` One decision per entry; a question hiding two decisions is
split. Where a guard verdict raised the question, the entry names the
verdict (require-approval or manual-only) so the operator knows what
execution waits on the answer.

## Open

- Q-001 (product): how do the PatterTech product layers link together,
  and how does one developer working with AI release and maintain them?
  Context: `docs/VENTURE_BRIEF.md` death #2, and ADR-0001, which settles
  the principle and leaves the mechanism open. Owner: operator.
  - raised at Session 0, 2026-07-25, by the operator, unprompted, in his
    answer to the personal-data question. His words: "I am honestly
    really confused how I should link all of these together, and this is
    something I want you to help me with. I have a lot of different
    product layers and applications, and I really want to deploy/release
    them in the most effective way for myself (a sole dev with AI) to
    maintain them."
  - why it is recorded rather than answered: it is the venture's central
    open question and the reason death #2, the integration layer eating
    the product, is cheap. Guessing at it in the interview would have
    been the exact failure the challenge steps exist to prevent.
  - how it gets answered: the adopted smaller version defers it
    deliberately. Nothing integrates until one person who is not the
    author has installed PatterStage from scratch and used it for a week.
    The install gate is task `T-0004`. The answer then comes from what
    that person reaches for, not from a topology chosen in advance.
  - shape of the answer when it arrives: an ADR. ADR-0001 already fixes
    the settled half, so what is open is the mechanism, not the
    principle.

- Q-003 (process): does the compiled `AGENTS.md` say enough? Re-aimed at
  the v2 router, since the ADR-0008 recompile replaced the file the
  question was first asked about. Context: `AGENTS.md`, `org/START.md`,
  and `docs/LOCKBOOK.md`'s Structural contracts section. Owner: operator.
  - what happened at Session 0: the compile replaced PatterStage's
    hand-written 39-line router with the kernel's, which is correct (the
    matrix lists `AGENTS.md` as a compiled file) but dropped the repo's
    own prohibitions in favour of routing onward.
  - what happened at the cutover: the v2 router routes to `org/START.md`,
    to the task record's ruled tier and to a charter in `org/roles/`. It
    is a different file answering the same question, so the question is
    asked again rather than carried as answered.
  - what was preserved: every dropped rule is in the lock-book's
    structural contracts, which is where a venture's specifics belong
    under this scheme.
  - the open part: whether an agent reading only `AGENTS.md`, and
    following it, arrives at those contracts reliably. The H1 cold-start
    test at sign-off is what answers this, and it is the only test of the
    seed that matters.

## Folded

- Q-002 (legal): which licence does the public repository carry? Folded
  2026-07-26. Answer, from the operator: Apache-2.0. The relicence commit
  `a18063be` sits on `dev` with NOTICE, TRADEMARK.md and REBRANDING.md and
  has simply never shipped, because `dev` has not merged to `main`; GitHub
  detects the licence from the default branch, so the reported licence
  corrects itself at that merge with no metadata to edit. Copies taken
  before that merge stay MIT, because a licence already granted cannot be
  withdrawn. That is a statement of what the two licences say, not legal
  advice, and it needs no decision from anyone.

- Q-004 (process): the queue header contradicted the separation of
  duties. Folded 2026-08-22 at the cutover. Answer, from the operator via
  ADR-0008: dissolved structurally. The v2 recompile retires `org/QUEUE.md`
  entirely, and task records under router-ruled modes replace the header's
  protocol.

- Q-005 (process): three lock-book corrections needed sanction. Folded
  2026-08-22 at the cutover. Answer, from the operator via ADR-0008:
  sanctioned. (a) The WG-OPS-002 paragraph's claim that `docker-image` sits
  in branch protection's required set is corrected in `docs/LOCKBOOK.md`;
  the measured required set is empty. (b) The five ruling notes that read
  "undefined" are restored from `docs/eos-session0/WALK_RAW.json` and
  `CORRECTIVE_RAW.json` into `docs/RULINGS.json`. (c) The lint-constraint
  attribution is tightened there too.

- Q-006 (process): no session log exists for session 1. Folded 2026-08-22
  at the cutover. Answer, from the operator via ADR-0008: the gap stays
  recorded and is not reconstructed. v2 retires session logs, git is the
  log, so the series was expected to end with the migration record at
  `org/logs/2026-08/S-0002-plan.md`.
  - what happened next: two more logs were written after the fold,
    `org/logs/2026-08/S-0003-execution.md` (2026-08-23) and
    `org/logs/2026-08/S-0004-ux-and-value.md` (2026-08-24). S-0004 is the
    last one, and both are cited as real sessions elsewhere in the
    record, so they are part of the series rather than strays. The
    retirement itself stands: ADR-0008 rules it, no later ADR reverses
    it, and practice simply ran two sessions past the ruling.

- Q-007 (process): four done rows sat in the queue's Ready section.
  Folded 2026-08-22 at the cutover. Answer, from the operator via
  ADR-0008: moot. The queue file retires and closed rows live in git
  history.

- Q-008 (process): should the design-lint baseline be mechanically
  shrink-only rather than shrink-only by doctrine? Folded 2026-08-22,
  promoted rather than answered. Answer, from the operator: promoted to a
  task. It is `T-0025`, proposed: `--update-baseline` refuses to write a
  larger total, or a larger per-key count, without an explicit second flag
  carrying a written reason.
