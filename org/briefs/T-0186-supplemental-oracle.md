# T-0186 supplemental ORACLE brief

Author only `tests/e2e/story-weaver-save-boundaries.spec.ts`. Do not edit the
frozen `tests/e2e/story-weaver-save-failure.spec.ts`, source, task records,
claims, baselines, or other tests. Do not commit or push.

Boot from `org/START.md`, `org/tasks/T-0186.json`, and the ORACLE charter.
The current implementation fixes basic HTTP and network failure cases but
still treats a 200 empty or unchanged response as a saved chapter. It also
allows two quick chapter selections to send stale full chapter arrays, so a
later response can erase a read status on the server. `handleUpdate` in
`src/modules/rec-room/handlers/crud.ts` responds `{ data: story }` with
the saved chapter array; its repository writes the full array.

Write browser behaviour cases, preferably at 1440 and 390 widths where
feasible, for (1) 200 empty/malformed or unchanged data refusing a local read
mark with visible feedback, (2) two overlapping selections persisting both
marks after reload, and (3) the Next button's failed save leaving its current
chapter unread while navigation remains usable. The fixture may intercept
`/api/stories`; model the server's chapter data so it exposes lost updates,
not merely the number of requests. Run this new suite against the current
source. Report exact failing assertion(s), passing controls, test names and
SHA-256. Preserve auth and isolated Playwright data. Do not alter the gate,
worker count, retry count, timeouts or existing test identities.
