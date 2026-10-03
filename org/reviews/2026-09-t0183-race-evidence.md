---
summary: T-0183 mission reservation, cancellation and recovery evidence
type: review
tags: [missions, scheduler, verification]
---

# T-0183 race evidence

Inspected on `dev` during T-0183. This is a running evidence ledger; the
closing verification belongs on the task record after the unchanged-tree gate.

## Red-first observations

- `4eddd81b` froze seven independently authored SQLite/fake-gateway cases.
  Seven failed against the pre-fix source: overlapping queue and cron ticks,
  a fresh-worker replay, and late gateway replies after cancellation.
- `ccbb3571` froze eight additional independently authored cases, six red on
  the current partial source. The red cases were three stale reconciliation
  verdicts after cancellation, one two-connection check/write gap, one
  network-ambiguous submit being falsely failed, and a chat run with no
  backend ID left started. The pre-submit refusal and held completed-reply
  controls passed.
- The three closed scheduler test doubles had six failures after the shared
  repository claim changed their interface. A different author retained all
  51 test names and the spend, busy, duplicate and valid-interval distinctions;
  `2f410f4c` froze the amendment, and the coordinator observed 51/51 passes.
- The B13 script-scheduler mission control failed on the old `createRun` mock.
  Another independent author preserved its 19 names and script controls;
  `ccbb3571` froze that amendment and 19/19 passed.
- `7c48a1ec` froze five final edge assertions. The coordinator reran them
  before the second source repair: five of five failed on the intended
  behaviours, without an import or fixture failure. They cover cancellation
  of older active runs, terminal gateway acknowledgement, a pending-submit
  label, detached queue rejection and cron occurrence contention.
- `627345bf` froze three independently amended suites. Their 16 test names
  were unchanged. The fresh-worker case now invokes boot recovery; the
  schedule mocks distinguish pending from acknowledged duplicates.

## Adversarial gaps still being addressed

Read-only sceptics identified five further candidates after the first green
focused pass: older duplicate-run data may let an uncancelled run rewrite a
cancelled mission; a terminal `RunHandle` may strand a dispatched mission;
duplicate cron ticks can advance an unconfirmed occurrence; the board labels
an ordinary pending submit as requiring operator review; and a SQLite lock
error may escape a detached queue call. The frozen edge suite reproduces all
five and now passes after source repair. The restart acceptance now uses
distinct missions for the unknown-ID and known-backend controls.

The same sceptic correctly limited the two-connection Jest case: its mocked
`inTransaction` does not prove the production `BEGIN IMMEDIATE` method. The
production code requests that mode, and the real-file fixture proves that a
stale verdict is caught, but a process-level cancellation contention proof
remains separate. A temporary `SQLITE_BUSY` is not an accepted cancellation.

## Interim verification, not closure

The first source repair passed 104/104 focused cases and TypeScript. After
the second repair, 115/115 focused cases in 11 suites, TypeScript and file
lint passed. A production Turbopack build passed with `PS_DATA_DIR` and
`HERMES_HOME` pointed at `tmp/t0183-build-data`. The amended
`npm run test:restart-recovery` passed all 21 checks on an isolated temporary
database and port 3994, including the real process kill and restart.
An interim full `npm run test:coverage` passed 762 suites, 7,365 tests and
eight existing skips; it also precedes the second oracle and is not the final
gate. A worker-exit warning did not change its exit code.

An earlier sandboxed full Jest attempt failed 26 tests: most child `tsx`
processes could not call Windows `os.userInfo()` (`uv_os_get_passwd ENOMEM`),
and the open task record temporarily made derived views stale. The identity
lookup and two affected fixture suites passed with the required command
permission (5/5). The decision-entry wording and internal unused exports
were separately corrected and their focused checks passed. The fixed C4
window cap went red at 4,815; an independent fixture extraction preserved
all 38 test names and reduced the count to 4,778 without changing the cap.

The first post-repair full `npm run test:coverage` exited 1: 19 failures in
six older suites whose repository mocks lack `listActiveRunsForMission` or
whose queue mocks return `undefined` where detached callers now attach a
rejection handler. It passed 7,351 tests in 758 suites, with eight existing
skips. `8a7a704a` froze the independent amendment to those six test doubles
with all 92 original test names unchanged. The coordinator reran the six
suites: 92/92 passed. A second complete run is required after their repair.
No coverage floor or failing check was changed to clear this result.
The repeat full run passed by exit code: 764 suites, 7,370 tests, eight
existing skips; one worker-exit warning remains. The complete lint command
first failed because an ignored `.gate/t0182-walk.cjs` helper from the prior
batch was inside ESLint's walk and used CommonJS `require`. It was preserved
under the repository's ignored `tmp/` scratch directory, which the existing
ESLint configuration already excludes. The repeat full lint command passed
without changing a rule or a test.

The controlled production browser walk used a separate database, an owned
server on port 3995 and two seeded mission states. At 1440×900 and 390×844,
the board showed the pending submission as **Running** and the held unknown
outcome as **Waiting for you**. Both widths had a visible Missions h1, zero
horizontal overflow and no browser page errors. Screenshot SHA-256 values:
desktop `4d1d8ba63bf2ca672b29e89fbdecbe38dbd28fcaa274eb5719fbdea422127021`;
phone `3e9f21ac1da8ebf7141e55ca226fee76876b00b538a68224716b3d2d0f2c4042`.
Screenshots and the repeatable walk helper are ignored under `tmp/`; the
operator data directory was not used. The owned listener was stopped after
the walk.

## Limits

The local oracle proves PatterStage claim and cancellation state against fake
gateway replies. It does not prove the external gateway has durable
idempotency, charges once, or stops a run whose backend ID never arrived.
Q-031 therefore requires an unconfirmed review hold, not automatic replay.
