---
summary: Confirmed fallback DELETE refusal rollback defect and independent red acceptance
type: review
tags: [testing, data-integrity]
---

# T-0208 fallback refusal cohort

At dev `db48bb19`, the second T-0195 gate passed 9,070 unit tests,
static checks and the build, then failed the fallback persistence journey:
DELETE returned 500 after an owned Windows EPERM configuration replacement
failure. The retained runtime-XvCqW0 database had zero enabled fallbacks;
its YAML still had one. The unchanged ten-case browser specification passed
alone afterwards. That partial rerun does not repair or waive the full failure.

Lagrange independently froze
`tests/unit/fallback-delete-refusal-rollback.test.ts` at SHA-256
`b6ef4cdbdb483c1a001abd5eb97ee172aab23db5f2867414f0200026486cdb36`.
The executed oracle uses real SQLite and owned YAML. Its four cases produced
two ordinary preservation matcher failures and two passing success/missing
controls, with zero infrastructure-error suites. Eighteen existing parent
tests passed; lint and test typecheck exited zero. The source remained clean
at SHA-256 `cd354abd1d9edf4e39201957143b4f3c737fada26abb275a99ebe79159fe933c`.
Reproduce with the pinned Node 24.21.0 runtime, Jest runTestsByPath for this
suite and config-cache-invalidation, a-custom-fallback-keeps-its-name and
commit-fallback-change. The ignored evidence is
`tmp/t0208-fallback-oracle/frozen-proof.json`, red-results.json and
parent-results.json. Synthetic fixture data never accesses operator paths.

On 2026-10-07 Gauss adopted the frozen red oracle under R2 REVIEWER authority
and authorised only the existing synchronous inTransaction helper around the
DELETE mutation, missing response, configuration sync and success response.
The unchanged route wrapper continues handling exceptions. No retry, response
contract, authentication, schema, deadline or concurrency change is authorised.
Before repair acceptance the same four cases and eighteen controls must pass,
with lint/types green and the frozen oracle unchanged.

This first cohort remains part of active T-0208. It addresses refusal before
file replacement. Replacement followed by mirror or database-commit failure,
success-audit timing and crash consistency remain uncertainties. The actual
Windows file holder and the intermittent positive journey remain unresolved.
Other T-0208 findings remain open. No universal two-store atomicity or full
T-0195 gate success is claimed.

## Repair controls

The handler now uses that existing outer synchronous transaction. In the
owned validation checkout at cb7e48c6 plus the implementation overlay,
`tmp/t0208-focused-1791367696925/results.json` reports all four unchanged
oracle cases and eighteen parent controls passing. Lint and test typecheck
each exit zero. The source changes only the import and DELETE boundary.
The new causal mutant bypasses that boundary; its committed-tree sweep
remains pending. A full gate, hosted checks and independent implementation
acceptance remain required.


## Committed causal sweep, 7 October

The source commits978ddd93 (T0195) andc251319e (T0208 first cohort) are
separate and independently revertable. At clean dev c251319e the actual
production sweep kills all11 T0195 mutants and the one T0208 transaction
mutant. Thirty-five unmodified T0195 controls pass before and after; four
T0208 controls pass before and after. Its mutant yields the two intended
SQLite preservation matcher failures. All16 structured Jest runs contain
zero runtime-error suites. Byte/mode restoration and clean-tree checks pass.
Evidence:tmp/t0194-committed-sweeps-1791368763841/summary.json and runs.json.
No NOT-APPLIED,INEFFECTIVE,SURVIVED or infrastructure result is called killed.
Exact-head hosted acceptance remains pending. T0208's other findings remain
active; the green local gate does not establish a Windows holder or release.
