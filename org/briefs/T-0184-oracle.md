---
summary: Independent red-first oracle brief for T-0184 mission and category atomicity
type: brief
tags: [missions, oracle]
---

# T-0184 oracle brief

Task record: `org/tasks/T-0184.json`. Authority: M3, M4 and qualified M5
in `org/reviews/2026-09-t0164-defects.md`, plus the approved Phase 2 plan.
Write only `tests/unit/mission-promote-atomic.test.ts` and
`tests/unit/mission-category-atomic.test.ts`. Do not change source, existing
tests, task records, baselines or protected files. The coordinator owns those.

Use an isolated in-memory or temporary SQLite database and a temporary disk
template directory. Prove behaviour through the public repository/handler
entry points and inspect persisted rows and file bytes. Cover:

1. Queued-to-cron and draft-to-cron promotions set `queuedForRun` false and
   create one schedule without sending an immediate run.
2. A nonblank invalid or impossible cron, including an interval below the
   existing floor, returns 400 before changing any mission column or adding
   a schedule. Include an attempted name and prompt edit in the input.
3. Category deletion with reassignment moves mission, catalog and disk
   references. A disk template whose explicit category ID belongs to a
   different category must not move solely because its legacy text matches.
4. A real injected file-write failure reports failure and leaves the category,
   mission, catalog and all disk templates at their pre-operation values.

First run the focused tests against unchanged source. They must fail on the
intended assertions for M3/M4/M5; fixture or import errors are not oracle
red. Report each test name and failure cause. Keep the test names stable for
the implementation pass. Do not edit the oracle after it is frozen; any
needed amendment belongs to a different author. No source implementation is
authorised in this lane.
