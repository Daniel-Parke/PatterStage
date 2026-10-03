# T-0205 worker-budget oracle amendment

Date: 2026-10-02. Author: `01a0fac3-a432-7223-8493-2e32f9e4f113`.
Exclusive lane: `T-0205-worker-budget-amendment`, recorded in `org/claims.json`
before edits. Task ruled R1; the task retains separate authorship and independent
R2 acceptance. Schrodinger's written Q015 authority is
`org/briefs/T-0205-worker-budget-amendment.md` and the task's
`worker_budget_proposal.review` entry.

## Independence and amendment

Fresh clean-context ORACLE, separate from Galileo, the coordinator implementing
the configuration and Schrodinger reviewing at R2. Read START, the task, ORACLE
charter, written briefs and frozen suite before editing. No configuration
implementation exists or was inspected. Differential calibration used only
private baseline/cap1/cap2/cap8 configuration copies. The baseline configuration
hash was checked before calibration and again at freeze.

Only these tracked paths were written:

- `tests/unit/release-jest-worker-budget.test.ts`
- This new provenance file.

W05/W06 retain both old assertions and additionally require exactly two workers
when the controlled inventory is 64. The parameterised branch adds one executed
expectation to each of these two cases and none to W01-W04.

W09 retains its exact old `toThrow` assertion. Its invalid probe clears a
completion flag before launch. Completion requires status 1, no launch error
or signal, empty stdout, the complete known Jest validation diagnostic for
the invalid `maxWorkers: { invalid: true }` object and an exit-written
inventory receipt matching both controlled processor APIs. Only ANSI formatting,
CRLF and surrounding whitespace are normalised. The diagnostic is:

```text
Validation Error:

maxWorkers has to be of type string or number

maxWorkers=50% or
maxWorkers=3
```

An unconditional `finally` guard throws infrastructure outside the matcher
unless that completion was established. This prevents the retained generic
marker assertion from passing an unrelated refusal. Unexpected errors do not
become cap assertion failures or mutation kills.

All nine names and old assertions are retained. The 20-second child bound,
1 MiB child output bound, 150-second preparation bound, 45-second W08 bound and
25-second W09 bound are unchanged. All eight manifest rows, the prior provenance,
older frozen suites/helpers, coverage floors and canonical configuration remain
byte identical. No commit, push, protected edit or history change was performed.

## Calibration and focused checks

Pinned runtime: Node v24.21.0 on Windows.
Dependency pool: `tmp/t0188-green-validation/node_modules`, referenced
through private junctions without installation or writes to the pool.

Each outer runner and each inner probe uses an owned home/data/temp/cache root
and an allowlisted environment. No operator environment file, home, data or
database was copied. Private projects copy only the existing configuration and
required support files, including unchanged `src/lib/config/config-sections.ts`.
These are configuration resolution controls, not a full corpus or load test.

All rows below have the original nine identities, zero skips and zero runtime
error suites. Classification calls the repository's actual `assessJestRun`
with real Jest JSON reports and failure details.

| Private control | Pass | Fail | Classification |
| --- | ---: | ---: | --- |
| Unchanged baseline | 7 | 2 | assertion-failed, W05/W06 receive 63 |
| Cap1 | 7 | 2 | assertion-failed, W05/W06 exact-two matcher |
| Cap2 and actual invalid-object validation | 9 | 0 | passed |
| Cap8 | 3 | 6 | assertion-failed, W01-W06 |
| Invalid-only nonexistent launcher, actual ENOENT | 8 | 1 | infrastructure, W09 |
| Invalid-only launcher refusal, status 1 | 8 | 1 | infrastructure, W09 |
| Invalid-only real 20-second timeout, ETIMEDOUT/SIGTERM | 8 | 1 | infrastructure, W09 |
| Invalid-only Windows self-termination, status 1 without signal | 8 | 1 | infrastructure, W09 |
| Invalid-only injected SIGTERM result after actual Jest validation | 8 | 1 | infrastructure, W09 |
| Invalid-only unrelated normal exit, status 2 | 8 | 1 | infrastructure, W09 |
| Invalid-only missing diagnostic, status 1 | 8 | 1 | infrastructure, W09 |
| Invalid-only generic validation for another option | 8 | 1 | infrastructure, W09 |
| Invalid-only exact maxWorkers message with wrong exit 2 | 8 | 1 | infrastructure, W09 |

Every fault injection selects only the child configuration containing the
deliberately invalid object. Canonical probes and W01-W08 stay healthy with cap2.
The signal-result injection preserves actual Jest validation output and inventory
before changing only the returned status/signal fields. It is a labelled result
injection, not native standalone signal-delivery evidence. The earlier Windows
self-termination produced no signal field; its run and the resulting calibration
qualification failure are retained. The real timeout also reported SIGTERM, but
that alone would not isolate the signal check from the launch-error check.

Focused TypeScript checking and ESLint each exit 0 with no launch error or
signal. Both run on owned copies of the amended suite. TypeScript uses a private
configuration extending the existing tsconfig with only this suite included and
incremental output disabled. ESLint uses the copied repository configuration and
`--max-warnings 0`. No parent auxiliary validation or broad gate was run.

## Provenance and freeze

Original freeze, retained unchanged:
`tmp/t0205-worker-budget-author-1790912579436-22be7850/freeze.json`.
Original freeze SHA-256:
`5bbcd6ab6cc7548a4ea8d2845a4862895e1d621f27352a8c5b6f466a98d72fe5`.

Original suite SHA-256:
`fd6480fe8d519409ee58484e4efb083cc89b52c8063a3ad1cc8d264b2200be59`.
Amended suite SHA-256:
`66baeb8fee7b038f7950443c65d818e49ac5a8b18a4cb05a1cb56d74c0b8e5d1`.
Prior provenance SHA-256:
`4034576a56da46ab0e07ef41fe83532a1082f7b14d09603fd0449cabf612befd`.
Eight-row manifest SHA-256:
`e0351ee6f280092c055d1e71099257ddd233d43cca37ca1c8527829df814d982`.
Unimplemented baseline configuration SHA-256:
`5ae866bd40c5d63f83bb1b831c283909b0206e731ab91fe6950b8b13c8b5cd3d`.
Prior canonical red commit: `c1a88d7f9716de9b3941fb00f90cedf5d1c387f5`.

New owned evidence root:
`tmp/t0205-worker-budget-amendment-01a0fac3-e53abea633674b6681f4363fa1585fb8`.

`summary.json` binds actual classifications and report hashes.
`checks/receipts.json` records focused check exits.
`preservation-after.json` verifies the original frozen files, original
receipt inventory, seven old assertion statements, unchanged bounds and exact
original suite reconstruction after removing only the authorised additions.
`freeze.json` binds the amended suite hash, this provenance hash, all
nine executed names and the complete owned regular-file receipt inventory,
excluding dependency junctions and the freeze itself. Original receipts remain
at their original locations; the new freeze is a distinct file.

Author writes cease when this new freeze is generated. The parent must record
the amendment provenance and obtain independent review, reproduce and commit
canonical intended red before configuration implementation, then complete the
full unchanged gate, committed mutation controls/sweeps/restoration and native
exact-head hosted jobs. This amendment establishes none of those acceptance
steps, general stress reliability or clean worker teardown.

