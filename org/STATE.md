---
summary: PatterStage Venture STATE , the session claim line, live sections and the Resume Packet spec
type: venture
tags: [eos]
compiled_from: kernel/templates/org/STATE.tpl.md
---

# STATE

The live state of the organisation. Touched at session start (the
claim) and session close (the Resume Packet). Reality wins over this
file; fix it and note the correction in the session log.

active_session: none

The claim protocol: at session start, if `active_session` is set, dated
today or yesterday and not yours, stop and tell the operator. Otherwise
write your session id, assignment and date; clear the line to `none` at
close. A claim older than a day is stale; sweep it and note the sweep.

## Now

Session 0 is compiled and phases A to D are complete; **phase E is not, and it
is the gate on everything below it.** The EOS runs GENESIS-LITE (WO-0001) after
Session 0 closes, so Genesis cannot start until the operator signs the seed.
Six queue items have been closed ahead of Genesis on the operator's instruction
to do minimal prep first, on the reasoning that Genesis re-orders the queue and
work done before it may be reshaped by the sketch that follows.

The code is on `dev` and green. `main` is the pre-rebuild tree and still carries
the old MIT licence; the Apache-2.0 relicence, the security hotfix, the hermes
module extraction and every queue item below are unshipped until `dev` merges.

## In progress

none. WO-0011 is part-closed by construction rather than claimed: its
committable half has landed and its remaining two acceptance items are GitHub
branch-protection settings, which no session can do.

## Flags for the operator

- **CI is red on `dev` and has been since the security hotfix.** WO-0018, filed
  P0. `e2e-smoke` fails 3 of 4 because the auth middleware fails closed and the
  Playwright harness never mints a token, so every request gets 503.
  `docker-image` also fails and is not yet diagnosed. Read that row before
  trusting any earlier "gate green" in this repo's history: every one of them
  meant lint, tsc, jest and build on the operator's machine, and CI status was
  never checked.
- **Sign Session 0, phase E.** The H1 to H5 rubric, the cold-start test and the
  signature in `docs/COMPILE_REPORT.md`, then a row in the EOS
  `registry/PROJECTS.md`. Nobody who wrote the seed can judge it, which is the
  whole point of the rubric. **This blocks WO-0001 and therefore everything.**
- **The cold-start test needs an unclaimed queue item.** WO-0003, WO-0005 and
  WO-0006 were the small self-contained ones and are now closed. Use WO-0007 or
  WO-0013: hand a fresh session only the seed and that row, and see whether it
  completes with zero questions. That is H1 and it is the only test of the seed
  that matters.
- **Two branch-protection clicks, for WO-0011.** Add `install-harness` to the
  required checks once you have read one green run of it, and remove
  `docker-image` from them. The job is deliberately non-required until then.
- **Q-003 is still open** and only the cold-start test answers it: does an agent
  reading `AGENTS.md`, and following it to `org/START.md`, reach the lock-book's
  structural contracts reliably?
- **No spend decision is outstanding.** The WO-0014 ruling is recorded on its
  row: warn by default, hard stop available but opt-in, never forced.

## Resume Packet

Written at every session close and at named milestones. Fixed keys; a
fresh session must be able to resume from this packet plus the files it
names, alone.

- venture: PatterStage, scale M, `dev` branch, schema v30
- eos_pin: v1.0, commit `cc18755`, per `docs/LOCKBOOK.md`
- phase: Session 0 phases A to D complete, phase E unsigned. Pre-Genesis prep.
  Closed since the seed compiled: WO-0002 (fonts vendored, CI retries gone),
  WO-0003 (`sql-outside-repository` lint rule), WO-0005 (one reading register),
  WO-0006 (config cache invalidation), WO-0011 committable half, Q-002 folded.
- last_verified: LOCALLY, 2026-07-26: `npm run lint` (check-agent-files,
  check-doc-links, design-lint, eslint, typecheck:tests), `tsc --noEmit`, 2285
  jest tests, `next build`, `eos_check.py --seed` clean on the seed files, and
  the install harness at 5 of 5 scenarios under Docker 29.4.1.
  **CI is a different answer: red.** See WO-0018. A local green is necessary and
  has never been sufficient, and this repo learned that the expensive way.
- next_action: the operator signs Session 0 phase E, then a fresh session runs
  WO-0001 GENESIS-LITE per the EOS launcher. Its output re-orders this queue,
  so do not start queue items below it first.
- blockers: phase E needs the operator and cannot be done by a session that
  wrote the seed. WO-0011's last two acceptance items need GitHub branch
  protection, which is outside the repository.
- constraints: (1) the design-lint baseline shrinks and never grows, currently
  919; (2) a gate never retries, and the two surviving CI retries are filed as
  quarantined flakes reviewable 2027-01; (3) no spend without the operator's
  approval, and the WO-0014 ruling is warn-by-default with an opt-in hard stop.
- files_in_flight: none uncommitted. Everything is committed to `dev` and
  unmerged; `main` is still the pre-rebuild tree on the old MIT licence.

