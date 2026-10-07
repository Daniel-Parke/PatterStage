---
summary: Independent T-0183 reconciliation and uncertainty oracle, plus identity-preserving closed-test amendments
type: brief
tags: [oracle, missions, cancellation]
---

# T-0183 reconciliation oracle

Read `org/START.md`, `org/tasks/T-0183.json`, this brief, and the current
uncommitted source diff. Your only write paths are:

- `tests/unit/mission-reconcile-cancellation-race.test.ts` (new)
- `tests/unit/mission-uncertain-submit.test.ts` (new)
- `tests/unit/b13-scheduler-runs-scripts.test.ts` (closed suite amendment)
- `tests/integration/runtime/restart-recovery.mjs` (closed acceptance amendment)

The first new suite must use real isolated SQLite, a controlled gateway and
held responses. A cancellation committed while `getRun` awaits must remain
terminal after a completed reply, an elapsed declared timeout, a persistent
404, or an unreachable-backend deadline. At least one case should use two
separate SQLite connections to the same isolated file, so the check/write
atomicity is tested across process-like database boundaries. Assert mission,
run and session state, not just a function call.

The second new suite must prove that an ambiguous network rejection after a
submission attempt leaves its mission claim unconfirmed, with no new key or
automatic retry. Preserve explicit pre-submit local failure behaviour. It
should also prove that the mission-specific hold does not strand a chat run
without a backend ID forever.

Amend the closed B13 script-scheduler suite's mission-path mock to the new
`reserveMissionRun` interface. Preserve every test name and all script-path
assertions. The mission control must still prove that a real mission schedule
dispatches and a script schedule does not. Record the before/after exact
test-name set and hashes; report pre-amendment red and post-amendment green.

The restart acceptance currently expects a no-backend-ID mission to be failed
on boot. Q-031 instead requires a visible unconfirmed hold and no replay.
Independently amend only that assertion and its dependent observation without
removing the scenario, changing the test's name, or reducing its other checks.
If its fixture cannot exercise the new policy, report the blocker rather than
making it vacuous.

For new suites, run them against current source and report the exact red cases.
Do not change source to make them pass. For the old tests, prove name identity,
TypeScript/file lint where applicable, and report SHA-256 per touched file.
Do not commit, edit another file, weaken a check, or open a live network call.
