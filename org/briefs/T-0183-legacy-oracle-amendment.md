---
summary: Independent amendment of three closed scheduler test doubles after the shared mission claim
type: brief
tags: [oracle, missions, scheduler]
---

# T-0183 closed-oracle amendment

Read `org/START.md`, `org/tasks/T-0183.json` and this brief. Your only
write paths are:

- `tests/unit/spend-unattended-dispatch.test.ts`
- `tests/unit/scheduler-tick.test.ts`
- `tests/unit/schedule-minimum-interval.test.ts`

The T-0183 source now calls `reserveMissionRun` once, after the spend and
schedule-interval gates. The old tests mock separate `hasDispatchedMission`,
`getNextQueuedMission` and `createRun` calls, so six of 118 focused cases
currently fail from the obsolete test-double interface. The frozen new
`mission-dispatch-race.test.ts` already passes seven cases; do not touch it.

Adapt only the three owned test files to the shared reservation result:
`{ kind: "claimed", missionId, runId }`, `{ kind: "busy" }`,
`{ kind: "duplicate" }` or `{ kind: "none" }`. Keep every test name and
behavioural distinction. The spend refusal must assert the reservation is
never called. The scheduler's busy occurrence remains due, the duplicate
advances without a gateway call, invalid intervals never claim or submit,
and a valid interval still dispatches and advances. Assert the new claim's
mission, schedule and stable run ID instead of the removed `createRun` call.
Do not replace these with weaker counts, skips, retries or a blanket success
mock that makes the duplicate and busy cases vacuous.

Before editing, record the exact test-name set from your three files and
their current failure output. After editing, prove the set is byte-equal and
the three files pass with exit 0. Run TypeScript and file lint, record file
SHA-256 values, and report every touched path. Do not commit or edit source,
records, the line baseline, claims, protected files or other tests. The
coordinator will integrate and run the wider suite.
