---
summary: Independent T-0158 real-SQLite retention oracle assignment
type: review
tags: [oracle, security, auth, retention]
status: active
---

# T-0158 retention oracle brief

**Author:** independent ORACLE session
`01a0e1fd-fece-7642-8b9d-ec3e48d04e25`. **Task:** T-0158, R3.
**Claim:** only `tests/unit/t0158-session-retention.test.ts`. The coordinator
owns the production implementation, task record and this brief. Do not edit
the existing frozen T-0158 suites, implementation, migrations, derived views,
protected files or append-only ledgers. The accepted contract is
`org/decisions/ADR-0014-auth-session-retention.md`.

Write a behavioural oracle using real in-memory SQLite and a controlled clock.
Test the public session-creation behaviour with database rows, not source text.
Cover these independent cases:

- A revoked row remains at 30 days minus one millisecond and is removed at
  the exact 30-day boundary on the next successful sign-in.
- Idle expiry and absolute expiry independently use the first instant a row
  became unusable. An active row remains, regardless of its creation age.
- Deletion and insertion are one transaction. A forced delete failure causes
  session creation to fail with no new row or browser secret returned.
- A concurrent renewal cannot revive a row already eligible for deletion.
  If a deterministic interleaving is infeasible in SQLite, document the
  precise race that a predicate or transaction check still needs to cover.

Do not inspect the coordinator's session repository before writing the
assertions. A migration fixture or public API import is acceptable for the
harness. Keep the test-name set stable once written. Run only your new suite
and test TypeScript, report both exit codes and the exact intended red count.
Return the path, SHA-256, test names and any harness limits. The coordinator
will commit the oracle red before implementing pruning.
