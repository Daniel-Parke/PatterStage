---
summary: Separate red-first oracle for T-0185 null model input and old-link retention
type: brief
tags: [missions, oracle, review]
---

# T-0185 sceptic oracle

An independent read-only review found two gaps after the first T-0185 source
repair. Author **new** behavioural suites only in
`tests/unit/mission-model-null-boundary.test.ts` and
`tests/unit/mission-old-link-retention.test.tsx`. Do not edit the frozen
original oracle suites, source, records, baselines or shared fixtures. Wait
for the coordinator's exact claim before writing.

1. A supplied `modelId: null` is not a string. For dispatch, promote and
   update, it must produce a 4xx response before any mission row changes.
   Omission of `modelId` must still retain the documented default-model path.
   Use isolated SQLite and no external gateway.
2. A mission outside the first 200 can be fetched by its published deep link.
   On a subsequent board refresh, a by-ID 404 must remove that retained row
   and its expanded detail; a changed by-ID mission should refresh the row's
   visible status. A temporary 5xx must not silently present a stale row as
   current. A jsdom hook test with controlled API responses is preferred to
   seeding a second 201-row browser fixture. Assert rendered or hook-visible
   behaviour, not source text.

Read `org/START.md`, `org/tasks/T-0185.json` and `org/roles/ORACLE.md`.
Run focused tests against the current unfixed source and report exact test
names, assertion-level red results, passing controls and SHA-256 hashes.
Do not commit. The coordinator freezes the suites in a separate commit.
