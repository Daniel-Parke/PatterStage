---
summary: Independent T-0185 old-link browser fixture amendment after worker crashes
type: brief
tags: [missions, oracle, e2e]
---

# T-0185 old-link browser fixture amendment

The full Playwright gate twice reported a Windows worker exit (3221226505)
while running `mission-old-link-boundary.spec.ts` under load. The same spec
passed alone and one full run passed. These observations do not prove the
ten-way batches of 200 POST requests caused the exits. The fixture is the
only T-0185 test doing those writes, and bulk API creation is outside its
old-link acceptance invariant.

Independent R2 REVIEWER `01a0ee4f-3f54-7cc1-85c5-5db46e4c2623`
authorised a separate ORACLE author to edit only
`tests/e2e/mission-old-link-boundary.spec.ts`. Keep its one test name and
behavioural checks. Save the oldest mission through the real API. Insert 200
newer minimal rows with distinct valid IDs and explicit sortable ISO
timestamps in one transaction in the same isolated SQLite fixture. Assert
exactly 201 rows, 200 timestamps strictly newer than the oldest, a 200-item
API page that excludes the oldest, the oldest name and Edit draft via its
published link at 1440×900 and 390×844, and missing feedback for a false ID.
Commit the transaction before querying the API.

Do not change source, shared fixtures, worker count, retries, timeouts,
baselines, test names, behavioural assertions or operator data. The old
spec hash is SHA-256
`261CD5AFE9C2C341CDB18D7D758E5D7949617030A311765B14645D234D7F222E`.
Run the spec alone, typecheck and ESLint. Report its new SHA-256 and exact
test result; commit nothing. The coordinator will record the append-only
amendment and rerun the complete gate under load.
