# T-0205 canonical Jest worker-budget oracle

Date: 2026-10-02. Author: `01a0fab0-5743-72e0-8180-82c278279ccf`.
Claim: `T0205-worker-budget-oracle` in `org/claims.json`.
Task minimum: R1; separate-author oracle and independent R2 acceptance retained.

## Scope and independence

Authored from START, the ORACLE charter, task invariants and the written worker-budget
brief before the permanent worker setting exists. The unchanged baseline config was
read to identify the support files needed by its real Next/Jest loader. No future
implementation or parent candidate source was inspected. Parent candidate dependencies
were referenced read-only. No process was run in that candidate.

Exclusive tracked writes:
- `tests/unit/release-jest-worker-budget.test.ts`
- This report.
- Append m8 only to `tests/fixtures/mutants/T-0205.json`.

No config, older frozen test/helper, task record or coverage floor was changed.
The report and private freeze receipt are the hand-off; the parent owns record updates,
the intended-red commit, implementation, full gate and acceptance. This author neither
committed nor pushed.

## Behaviour and isolation

Nine new named cases use actual Node child invocations of installed Jest with
`--showConfig`. The canonical config and its required support files are byte copied
into each fresh private project. The actual Next/Jest loader runs there with no
operator `.env`, home or data. No product source, database, credentials or operator
data is copied. A dependency junction/symlink references the installed pool; no
dependency install, worktree or parent validation run occurs.

A preload supplies both `os.cpus()` and `os.availableParallelism()`, synchronises
ES module exports, and records the controlled inventory. Ordinary and coverage
resolution each use inventories of 1, 2 and 64. Assertions require an integer
resolved pool greater than zero and no larger than two. A removed-budget control
also requires Jest to consume the supplied CPU inventory. The large-host default
resolves 63 and exposes the missing cap.

W08 verifies explicit `--maxWorkers=5` remains effective in both modes. No CLI
override is prohibited. W09 verifies invalid configuration is refused as infrastructure.
The suite runs no inner test corpus and creates no inner worker pool: this is resolved
scheduling configuration evidence, not a load benchmark.

Each child has a 20-second timeout and 1 MiB output limit. Shared preparation is
bounded at 150 seconds; additional cases retain explicit bounded timeouts. Existing
six-second fixture watchdogs and all older identities/assertions remain untouched.
Every probe gets a unique owned root with fresh home/data/temp/cache and an allowlisted
environment. Successful and failed roots, stdout, stderr, inventory and status receipts
are preserved. Infrastructure refusal is raised before any cap assertion.

## Executed final calibration

Runtime: pinned Node v24.21.0 on Windows.
All final reports contain the same nine identities, zero skips, no launch errors or
signals. Classification uses the repository's actual `assessJestRun`, including
matcher details and stack evidence.

| Private control | Exit | Pass | Fail | Strict classification |
| --- | ---: | ---: | ---: | --- |
| Unchanged canonical baseline | 1 | 7 | 2 | assertion-failed |
| Authored two-worker reference | 0 | 9 | 0 | passed |
| Removed budget | 1 | 7 | 2 | assertion-failed |
| Valid configured eight-worker pool | 1 | 3 | 6 | assertion-failed |
| Invalid configured object | 1 | 0 | 9 setup failures | infrastructure |

Baseline and removed-budget controls execute W05/W06's
`toBeLessThanOrEqual(2)` and receive 63. The eight-worker control executes the same
matcher in all six default cases and receives 8. Valid configuration parsing and CPU
inventory receipts accompany these failures. The invalid-object control has no cap
matcher evidence and is never counted as red or a kill.

An earlier calibration used a private wrapper whose dependency was not copied into
the inner root. Its four refused controls are retained and strictly classified as
infrastructure. They are excluded from every qualified red/kill statement.
The corrected controls alter only the owned config copy and require a unique anchor.

Validation completed with exit 0:
- `node24 node_modules/typescript/bin/tsc --noEmit -p tsconfig.tests.json`
- `node24 node_modules/eslint/bin/eslint.js tests/unit/release-jest-worker-budget.test.ts --max-warnings 0`

The initial focused type check found two Error.code typing errors. These were fixed
before final calibration and freeze. They were not oracle red evidence.

## m8 and freeze

m8 identity: `m8-expand-canonical-jest-worker-budget`.
File: `jest.config.js`.
Unique intended anchor: `  maxWorkers: 2,`.
Replacement: `  maxWorkers: 8,`.
Selection: only `tests/unit/release-jest-worker-budget.test.ts`.

The private two/eight controls calibrate that exact valid replacement. On the unchanged
canonical baseline the anchor is absent, so actual m8 application/kill remains pending.
The parent must later prove clean committed control, unique application, executed
assertion kill and exact restoration. Calibration is not a committed mutation sweep.

The manifest was changed by a binary insertion. The entire original prefix and suffix,
including all seven old object rows, were verified byte identical.
Original manifest SHA-256:
`2c1613e89f7eb99eb665a6cd5687ae85763b8a2b854e33e915c611c61421af5a`.
Appended manifest SHA-256:
`e0351ee6f280092c055d1e71099257ddd233d43cca37ca1c8527829df814d982`.
Frozen suite SHA-256:
`fd6480fe8d519409ee58484e4efb083cc89b52c8063a3ad1cc8d264b2200be59`.
Unchanged baseline config SHA-256:
`5ae866bd40c5d63f83bb1b831c283909b0206e731ab91fe6950b8b13c8b5cd3d`.

Owned evidence root: `tmp/t0205-worker-budget-author-1790912579436-22be7850`.
Final controls: `summary-final.json` and `final-*/jest.json`.
Strict qualification and full nine-name freeze: `qualification-final.json`.
Byte-preservation receipt: `manifest-append-receipt.json`.
Final provenance: `freeze.json`, including all three tracked hashes and the complete
owned regular-file hash inventory. Dependency symlinks are excluded from that inventory.

Author writes cease at this freeze. Amendments require a separate authorised author.

## Remaining acceptance

This is independent red-first oracle evidence. The parent still owns canonical
red reproduction/commit, the permanent config edit, the complete unchanged ten-stage
gate, clean committed mutation sweeps, independent acceptance and exact-head hosted
jobs. Native macOS loopback evidence is handled separately. Scheduling mechanism,
general stress reliability and clean worker teardown are not established here.
