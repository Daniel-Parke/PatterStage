# T-0188 independent Auth43 wiring witness amendment

Authority: independent R2 REVIEWER Schrodinger, 1 October 2026, under Q-015.
Author: Newton, original independent ORACLE session. Do not inspect migration
implementation, source diffs or coordinator patches. Frozen oracle bodies,
historical SQL and task intent are available. No source or mutant edit.

M12 removes the final public migration-chain Auth43 call. The existing sweep
kills it through fresh/upgraded database failures only. Existing malformed
42/43 tests exercise the worker directly. Retain that qualified receipt.

Only these files are writable under the renewed author lane:
- `tests/unit/migration-t0188-behaviour.test.ts`
- `org/reviews/2026-10-t0188-oracle-amendment.md`, append only
- `org/reviews/2026-10-t0188-migration-verification.md`, append only

Retain all105 selected identities, both malformed42/43 names, every original
line, direct-worker assertion and snapshot check. Add a separate otherwise
valid real-SQLite fixture built independently from historical SQL. Damage
only Auth storage and record42/43. Exercise actual `runMigrations` without
mocks. Require an Auth-specific failure, unchanged recorded version and
unchanged schema/rows. Include a valid headed-storage control that excludes
unrelated fixture failure. The old minimal fixture lacks chain tables such
as `cron_jobs`; simply adding a driver assertion to it is insufficient.

Demonstrate normal candidate success and intended recorded43 assertion
failure under existing m12 in an exclusively owned validation copy. Classify
launch/runtime/configuration failures separately. Preserve all prior ledger
byte prefixes, hashes and receipts; append dated authority, scope, old/new
hashes and author independence. Freeze under ignored
`tmp/t0188-auth-wiring-amendment/` and cease writes. Report exact identity
proof. Coordinator then commits the amendment, repeats the full unchanged-tree
gate and clean committed T0188 sweep, and obtains separate acceptance.

No source defect, protected edit, removal or final acceptance is implied.
