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

**The 2026-08 consolidation programme is approved and owns the queue.**
The operator ruled at plan approval (2026-08-22, session S-0002): the approved
plan (`org/plans/2026-08-consolidation.md`) stands in place of the Genesis-lite
re-order, and Session 0 phase E is signed/waived in the same ruling, so the
gate that blocked WO-0001 and everything below it is discharged. WO-0001 is
superseded on its row. The programme: Phase 0 restores a green line (WO-0018 +
WO-0020), Phase 0b consolidates branches (WO-0028), Phases 1 to 7 run the
consolidation rows, then ONE release at programme end (operator ruling D13):
full local Playwright matrix, real-Hermes suite and upgrade test before the
operator merges PR #157 dev to main.

The code is on `dev`. `main` is 203 commits behind, fully contained in dev,
still MIT and pre-security-hotfix; the operator accepted that state for the
programme's duration (D13). Corrections applied this session under START's
"code and tests outrank notes": the design-lint baseline total is **918**, not
919 (mechanical sum of the 188 baseline entries).

## In progress

none. S-0002 (PLAN) closed with the approval paperwork committed: the plan
artefact, the queue re-order and new rows WO-0020 to WO-0029, ADR-0006 and
ADR-0007 (both proposed, awaiting the operator's signature), the
`org/decisions/` pointer, questions Q-004 to Q-008, and this file.

## Flags for the operator

- **CI is red on `dev` with THREE failing jobs, not two.** `e2e-smoke` (3 of 4,
  the harness has no auth token, WO-0018), `docker-image` (now DIAGNOSED: the
  smoke harness probes port 42090 while the containerised app boots on 42069;
  your ruling D3 says fix it, WO-0018), and `real-hermes-integration`
  ("SMOKE FAILED (2 assertion(s))", push-only so PR views miss it, WO-0020).
  No CI run has executed on dev since 2026-07-27.
- **One branch-protection click, not two** (WO-0011 corrected): add
  `install-harness` to the required checks. Measured 2026-08-22: the required
  set is EMPTY (`contexts=[]`), so there is no docker-image to remove.
- **Two signatures wanted:** ADR-0006 (dev is the integration trunk) and
  ADR-0007 (ADR home is docs/adr/), both proposed under the approved plan.
  WO-0029 stays blocked until ADR-0006 is signed.
- **One settings action from ruling D14:** pause/snooze Dependabot for the
  programme's duration (the agent half of WO-0028 closes the 12 open
  Dependabot PRs; the pause is yours).
- **Questions Q-004 to Q-008 are open**: the queue-header defect, three
  lock-book corrections, the missing session-1 log, the Done-rows-in-Ready
  formatting, and the update-baseline guard suggestion.
- **Q-003 is still open** and only the cold-start test answers it. The
  consolidation programme's WORK sessions are, in effect, repeated cold-start
  tests of the seed; their friction reports will answer it.
- The restore-test cadence has never run (`org/CADENCE.md`, last_run: never).
  The programme does not touch backups, but a first run remains due.

## Resume Packet

Written at every session close and at named milestones. Fixed keys; a
fresh session must be able to resume from this packet plus the files it
names, alone.

- venture: PatterStage, scale M, `dev` branch, schema v30
- eos_pin: v1.0, commit `cc18755`, per `docs/LOCKBOOK.md`
- phase: consolidation programme approved (2026-08-22); Phase 0 not started.
  Session 0 phase E discharged by the operator's D1 ruling at plan approval.
  Programme map: `org/plans/2026-08-consolidation.md` (phases, rows, rulings
  D1 to D14, dispositions, risk register, Appendix A scope lists).
- last_verified: 2026-08-22, read-only: eight parallel verifiers re-measured
  the plan's inventory against the tree at `d36eb817` (design-lint sum 918;
  sql-outside-repository 57 sites in 19 files; hermes-outside-adapter 21 in
  13; knip 38/18/2/1/11; migrations one chain to v30; branch containment
  proofs). CI was READ, not assumed: red, three jobs, evidence on WO-0018 and
  WO-0020. No gate was run this session beyond `npm run lint` on the paperwork
  (PLAN wrote no code).
- next_action: a WORK session takes WO-0018 (top of queue) per the plan's
  Phase 0. Its launcher may also name WO-0020; both are Phase 0. The session
  branches from `dev` per CONTRIBUTING and ADR-0006 (proposed).
- blockers: WO-0024/0025/0026 blocked on WO-0008 then WO-0025 (recorded on
  rows); WO-0029 blocked on ADR-0006's signature; the operator's click and
  Dependabot pause are outside any session's reach.
- constraints: (1) the design-lint baseline shrinks and never grows, currently
  **918**; (2) a gate never retries, and the two surviving CI retries are
  quarantined flakes reviewable 2027-01; (3) no spend without the operator's
  approval, and the WO-0014 ruling is warn-by-default with an opt-in hard
  stop; (4) behaviour preservation is the programme's default, hard rule 2 of
  the plan; (5) one release, at programme end, ruling D13.
- files_in_flight: none uncommitted at close. `main` still pre-rebuild, MIT,
  by ruling D13.
