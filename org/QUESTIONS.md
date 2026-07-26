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
