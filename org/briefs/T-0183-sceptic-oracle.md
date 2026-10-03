---
summary: Independent T-0183 oracle for five adversarially verified gaps and a truthful restart fixture
type: brief
tags: [oracle, missions, scheduler]
---

# T-0183 final sceptic oracle

Read `org/START.md`, `org/tasks/T-0183.json`, the current source diff and this
brief. Your only write paths are:

- `tests/unit/mission-dispatch-edge-contract.test.ts` (new)
- `tests/unit/mission-schedule-claim-contention.test.ts` (new)
- `tests/integration/runtime/restart-recovery.mjs` (closed acceptance amendment)

Use isolated real SQLite and a held fake gateway where the behaviour depends
on persisted state. Each case must have an assertion that fails on current
source, not an infrastructure failure or source-text match.

Cover these distinct behaviours:

1. Seed two active runs with backend IDs for one mission, hold reconciliation
   of the older run, cancel, then return a completed old poll. The mission and
   both run rows remain cancelled. The remote stop path requests both known
   backend IDs, without duplicate paid dispatch.
2. Let `submitRun` return an immediate terminal `RunHandle` (at least
   `completed`). The mission does not remain dispatched forever. A subsequent
   authoritative poll can supply output and complete it. Keep the existing
   elapsed-deadline and grace behaviour.
3. While a normal submit promise remains held, the mission view must not say
   `Waiting for you` or tell the operator the outcome is unconfirmed. After an
   ambiguous error or boot recovery it must show the unconfirmed review note.
4. A duplicate cron tick while the first occurrence has no gateway answer
   must not advance `next_run_at` or `repeat_done` or describe the occurrence
   as a finished duplicate. Once the owner acknowledges, exactly one advance
   consumes the occurrence and stable run ID.
5. A queue reservation failure such as `SQLITE_BUSY` cannot escape the
   detached `handleDispatchMission` call as an unobserved rejection. It must
   leave the queued mission due and produce a bounded logged failure or other
   observable result. Do not convert this into a silent successful dispatch.

The restart acceptance currently seeds two active runs on one mission and
expects that whole mission to display the unknown run's state. Amend it to
give the known-backend control its own mission, preserving both run controls,
all boot checks, process kill, no replay and the test's original purpose. The
amendment author must differ from the previous author, preserve the script's
assertion count or add stronger assertions, and record before/after SHA-256.

Run both new suites against current source and report exact assertion-red
cases and passing controls. For the restart script, run `node --check` and
report any execution limit; the coordinator will run it against a built app.
Run test TypeScript, file ESLint, `git diff --check`, and the line-census
report. The fixed repeated test-window limit remains 4,800; do not weaken it.
Do not edit source, records, other tests, baselines or protected files. Do not
commit.
