---
summary: Independent red-first oracle for reference decoys and overlapping old-link refreshes
type: brief
tags: [missions, oracle, review]
---

# T-0185 final boundary oracle

The second read-only sceptic pass confirmed the previous repairs, then found
two additional states under T-0185's accepted prompt and old-link invariants.
Own only `tests/unit/mission-prompt-reference-boundary.test.ts` and
`tests/unit/mission-old-link-overlap.test.tsx`. Wait for the exact claim
before writing. Do not edit frozen tests, source, records, baselines or shared
fixtures. Commit nothing.

1. Build and parse a mission with a real instruction and a reference whose
   text contains a literal `<task><![CDATA[Decoy]]></task>`. The parsed
   instruction must remain the real one. Include a plain reference control.
   This is a stored-prompt edit round-trip, not a source-text assertion.
2. For an older mission loaded by ID beyond the first 200, start overlapping
   board refreshes with controlled by-ID responses. Let the later lookup
   return HTTP 404 and clear the row. Then resolve the earlier lookup with a
   stale successful mission. The deleted row and expanded detail must stay
   absent. A same-order successful refresh control must still update status.
   Use a jsdom hook fixture with status-bearing errors and explicit deferred
   promises. Avoid timers or a shared Playwright database.

Read `org/START.md`, `org/tasks/T-0185.json` and `org/roles/ORACLE.md`.
Run focused Jest against the currently unfixed source. Report exact test names,
assertion failures, passing controls and SHA-256 values. The coordinator will
freeze these new suites before source repair.
