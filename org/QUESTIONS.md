---
summary: PatterStage Questions , the human decision queue and its folding rule
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
split.

## Open

### Q-001 · How do the PatterTech product layers link together?
- raised: Session 0, 2026-07-25, by the operator, unprompted, in his answer to
  the personal-data question.
- his words: "I am honestly really confused how I should link all of these
  together, and this is something I want you to help me with. I have a lot of
  different product layers and applications, and I really want to deploy/release
  them in the most effective way for myself (a sole dev with AI) to maintain
  them."
- why it is recorded rather than answered: it is the venture's central open
  question and the reason death #2 (the integration layer eats the product) is
  cheap. Guessing at it in the interview would have been the exact failure the
  challenge steps exist to prevent.
- how it gets answered: the adopted smaller version defers it deliberately.
  Nothing integrates until one person who is not the author has installed
  PatterStage from scratch and used it for a week (WO-0011 makes that install a
  gate). The answer then comes from what that person reaches for, not from a
  topology chosen in advance.
- shape of the answer when it arrives: an ADR. ADR-0001 already fixes the half
  that is settled (PatterStage hosts work, not surfaces), so what is open is the
  mechanism, not the principle.

### Q-003 · Does the compiled AGENTS.md say enough?
- raised: Session 0 phase D, by the compile.
- what happened: the compile replaced PatterStage's hand-written 39-line router
  with the kernel's 31-line one, which is correct (the matrix lists AGENTS.md as
  a compiled file) but dropped the repo's own prohibitions in favour of routing
  to org/START.md.
- what was preserved: every dropped rule is in the lock-book's structural
  contracts, which is where a venture's specifics belong under this scheme.
- the open part: whether an agent reading only AGENTS.md, and following it to
  org/START.md, arrives at those contracts reliably. The cold-start test at
  phase E is what answers this, and it is the only test of the seed that matters.

### Q-004 · The queue header contradicts the separation of duties
- raised: 2026-08-22, PLAN session S-0002, at consolidation-plan approval.
- the defect: `org/QUEUE.md`'s header says a session "moves it to Done at
  close", but Part II Article 3 says no session approves its own output, and
  the practised protocol (recorded in the approved plan, section 7) is that a
  WORK session sets its row to in_verification and only a VERIFY session or
  the operator moves it to done.
- what is asked: sanction rewriting the header sentence to match the
  constitution. The plan treats the header as the defect and does not obey it
  meanwhile; PLAN did not rewrite it unprompted because the brief ordered the
  contradiction flagged rather than silently resolved.
- owner: operator.

### Q-005 · Three lock-book corrections need sanction
- raised: 2026-08-22, PLAN session S-0002, from the plan's verification sweep.
- (a) `docs/LOCKBOOK.md:188-190` (WG-OPS-002 body) asserts `docker-image` sits
  in branch protection's required set. Measured via `gh api`:
  `required_status_checks.contexts = []`, zero required checks. The paragraph
  needs a one-line factual correction, same duty as the STATE 919-to-918 fix.
- (b) Five frontmatter ruling notes are the literal string "undefined"
  (WG-DEL-001, WG-DEL-002, WG-DEL-003, WG-OPS-004, WG-OPS-002): a compile
  defect, the serializer wrote a missing field. The argued full texts survive
  in `docs/eos-session0/WALK_RAW.json` and `CORRECTIVE_RAW.json`.
- (c) The dependency-free lint constraint is conventionally attributed to
  WG-WEB-013, whose recorded text concerns where law strings live. The real
  carriers are `design-lint.mjs`'s own header and WO-0003's queue note.
  Tighten the lock-book wording or bless the attribution.
- what is asked: sanction the three corrections; the lock-book records closed
  rulings and PLAN does not touch it without a ruling.
- owner: operator.

### Q-006 · No session log exists for session 1
- raised: 2026-08-22, PLAN session S-0002.
- the fact: `org/logs/` was empty despite queue rows citing
  `session-1-2026-07-26` and START's close ritual demanding a log per session.
  S-0002 starts the series properly. The append-only history article means the
  gap should be acknowledged, not papered over.
- what is asked: acknowledge the gap, and say whether a reconstruction of
  session 1's log from git history and the queue rows is wanted (a cheap DOCS
  row) or whether the gap is simply recorded here.
- owner: operator.

### Q-007 · Done rows sit in the Ready section
- raised: 2026-08-22, PLAN session S-0002.
- the fact: WO-0002, WO-0003, WO-0005 and WO-0006 are status DONE but live in
  Ready; the Done section says "(none)". The consolidation plan's re-order
  kept them in Ready, at the bottom, untouched, because tidying them
  unprompted was explicitly out of scope.
- what is asked: move them to the Done section (id, session, date per the
  template), or leave them in place.
- owner: operator.

### Q-008 · Suggestion: make the design-lint baseline mechanically shrink-only
- raised: 2026-08-22, PLAN session S-0002, from the verification sweep.
- the fact: `--update-baseline` writes current counts unconditionally; run
  after a regression it would grow the baseline. Shrink-only is doctrine in
  comments and error text, not mechanism.
- the suggestion: the flag refuses to write a larger total (or a larger
  per-key count) without an explicit second flag carrying a written reason.
  Strengthens a check; touches nothing else.
- what is asked: promote to a queue row or decline with a reason.
- owner: operator.

## Folded

### Q-002 · Which licence does the public repository carry? · FOLDED 2026-07-26
- answer: **Apache-2.0**, given by the operator.
- and the question was measured wrongly when it was raised. It recorded the
  conflict as "the repo files say Apache-2.0, GitHub's metadata says MIT", which
  reads as a metadata bug. Both halves were measured on `dev` alone. The truth:

  | | LICENSE | README | package.json | NOTICE |
  |---|---|---|---|---|
  | `main` (default, public) | MIT | MIT | no field | absent |
  | `dev` | Apache-2.0 | Apache-2.0 | Apache-2.0 | present |

- so GitHub was reporting `main` correctly. GitHub detects a licence from the
  default branch, and the default branch is MIT. There is no metadata to edit.
- and the relicence is already done. Commit `a18063be`, "chore(license):
  relicense MIT -> Apache-2.0 + add PatterTech trademark kit", sits on `dev`
  with NOTICE, TRADEMARK.md and REBRANDING.md. It has simply never shipped,
  because `dev` has not merged to `main`. GitHub re-detects on a push to the
  default branch, so the reported licence corrects itself at that merge with no
  further action.
- what remains true and is worth stating plainly: the 11 forks and anyone who
  cloned before that merge took the code under MIT, and a licence already
  granted cannot be withdrawn. Those copies stay MIT. Apache-2.0 applies from
  the merge onward. That is a statement of what the two licences say, not legal
  advice, and it needs no decision from anyone.
- residual work: none in this repo. Folded into the cutover.
