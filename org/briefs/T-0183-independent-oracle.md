---
summary: Independent red-first oracle for mission queue ownership and cancellation
type: brief
tags: [oracle, missions, concurrency]
---

# T-0183 independent oracle brief

Read `org/START.md`, `org/tasks/T-0183.json`, the T-0183 plan row and
`org/reviews/2026-09-t0164-defects.md` M1/M2. You own only
`tests/unit/mission-dispatch-race.test.ts`. Do not edit source, task records,
existing tests, baselines or protected files. One writing lane is assigned;
the coordinator is read-only while you write.

Use an isolated real SQLite database and a controllable fake runtime where
practical. Do not submit to an actual gateway or use the operator's data.
Prove the behaviour at the public queue/dispatch/cancel seams, not source
spelling. Hold the first gateway submission pending, overlap two queue
ticks and assert exactly one submission, one durable run ID/idempotency key
and one session. If the same global one-mission rule can be exercised with
a due cron tick without making the fixture brittle, include that race.
Cancel while submission is pending, resolve a success, and assert the
mission/run stay cancelled, queued work remains cleared, no dispatched
event is emitted, and the returned backend ID is stopped. Repeat with a
rejected submission. An uncertain post-restart claim must not be
re-dispatched under a new key or labelled certainly unsubmitted; the
operator's exact recovery policy is still pending, so avoid encoding one
of two unresolved product choices.

Keep the accepted elapsed-deadline and five-minute 404-grace semantics by
reusing their existing fixtures as coordinator checks; do not rewrite
those closed oracles. Preserve every existing test name. If a closed test
later needs an amendment, a different author will handle it under a
separate brief.

Run your new suite against the unmodified source and record exit code,
test names, assertion counts and red cases. All red failures must show a
specific race or cancellation defect, not fixture or infrastructure
failure. Run TypeScript/lint on your file if possible. Report the file
SHA-256 and all paths touched; do not implement or silently soften an
assertion to turn a failure green. The coordinator will freeze the red
oracle in a commit before source changes.
