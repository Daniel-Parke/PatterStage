---
summary: Proposed independent R2 amendment for the approved default-Node test policy
type: review
tags: [testing, oracle-amendment]
---

# Default-Node configuration pin amendment

Status: proposed; no frozen file changed. T-0195 is ruled R2. Q-015 and the
ORACLE charter require a different author and independent REVIEWER authority.

The approved tests-06 batch changes the single Next-wrapped Jest default from
`jest-environment-jsdom` to `jest-environment-node`. The independent inventory
names33 implicit DOM exceptions. All existing pragmas, worker/coverage settings,
Next transforms and module mappings stay for the initial cohort.

`tests/unit/dependency-hygiene-contract.test.ts` pins the complete executable
Jest configuration to historical SHA256
`3188e6c3935b640ba58aa02c2ebc32913b41ac5ef5eb9dd9b74563942a9a6ba0`.
Its current historicalConfig normalises only the separately accepted Next
environment-registry expression. The Jest default change necessarily violates
that closed pin.

The proposed separate author may reconstruct only the exact single
testEnvironment property value `jest-environment-node` back to its historical
`jest-environment-jsdom` value before printing/hashing Jest configuration.
Keep both historical hashes, all existing names/assertions/timeouts and the
Next normalisation unchanged. Do not normalise any other executable change or
accept arbitrary environment strings, multiple declarations or computed keys.

An independently authored T-0195 behaviour control must hold the actual resolved
Node default and DOM exceptions. The amendment therefore preserves unrelated
configuration integrity while the new oracle holds the separately ruled change.

Before acceptance, demonstrate original-byte reconstruction of the amended
oracle, identical old test names/assertions, the exact authorised Node change
passing, and representative unrelated config mutations still failing. Record
old/new LF hashes, author, reviewer authorisation and date here. The coordinator
must not perform this amendment. No coverage floor, worker count, skip or
timing bound is changed.
