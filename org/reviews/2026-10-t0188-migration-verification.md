# T-0188 independent migration oracle verification, 1 October 2026

Author: Newton, ORACLE session `01a0f80a-5091-7ac3-9d66-89e159495160`.
Authority: committed task, disjoint claims and corrected brief at
`3355cd02e9e09b2ef642a47a057aeb2d4997d6f6`, with independent R2 REVIEWER
Schrodinger's four Q-015 amendments and additive T-0204 contract authorisation.
This report freezes independent acceptance tests; it is not task closure,
implementation approval or installed acceptance.

## Isolation and independence

Primary: `C:/Users/Daniel/Documents/Coding/Github/PatterStage`.
Detached validation: `tmp/t0188-oracle-validation`, at the same committed setup.
Only the eight ORACLE claim paths are overlaid. Source and overlay bytes and
modes must match; each checkout retains its own before/after stamp.
No operator environment or data was copied. The validation checkout contains
the tracked `.env.example`, but no operator `.env` files.

Node is the assigned isolated `tmp/t0203-node24-runtime/node-v24.21.0-win-x64/node.exe`:
the runtime probe observed v24.21.0, ABI 137 and SQLite 3.53.2. The validation
`node_modules` junction resolves to the assigned immutable primary target.
Both lockfiles have SHA-256
`2ae2d3b5c5e3c0264d2a4f4bc157e233508341af9fabbd77a32e295b0ca82d63`.
Before module loading, PS_DATA_DIR and CH_DATA_DIR point to validation
`tmp/owned-data`, HERMES_HOME points to `tmp/owned-hermes`, and PATH begins with
the isolated runtime. No install, dependency mutation, port or unowned process
was used. Windows account-query-dependent safety tests use the authorised
escalated owned validation boundary.

Fixtures use real SQLite, committed historical SQL and local synthetic DDL.
They do not use replacement appliers to manufacture expected state.
The baseline helper is unchanged. Database implementation source was not
inspected; non-semantic tree hashes support the checkout stamps.

## Frozen oracle surface

| File under tests/unit | LF SHA-256 | Cases |
| --- | --- | --- |
| `migration-t0188-wrappers.test.ts` | `477bac9245bba5239be0c34d6c9fb67eb1d87abdb11842146d68df470e8fb381` | 33 |
| `migration-t0188-behaviour.test.ts` | `521ccea46246d5c9279b96a5353135087cbde0ab6553ce37577be2d094e88a91` | 31 |
| `migration-t0188-update-backup-order.test.ts` | `88fa484128de1f933ac8cfd30d515e5aef04bb682f15649340bc9692a8e0c77e` | 6 |
| `t0165-plan-contract.test.ts` | `2cf99094aa6fbbbc9d188fa074a7e64a2ff4eb39bc8bb43a8cd6645551345512` | 3 |
| `run-migrations-upgrade.integration.test.ts` | `573bb6e3670b94325402919bb80ef3c2a6634fe996c8d555f4c6a3e309bca4b0` | 6 |
| `u15-one-driver-for-sql-migrations.test.ts` | `770af455e96f60e7f7b15b27567210c5e9353fae2d7cfad4d90dc03be65876f8` | 5 |

The six suites total 84 cases. The four unchanged T-0161 safety suites add
21 passing cases. Existing test names, the measurement case, targets and
ledger totals are preserved as proved in the amendment ledger.
The three new suites add 717 LF lines; bounded closed-test amendments add a
net 79 LF lines. No helper extraction or additional frozen-file amendment was
used. Existing setup/selection/permissions coverage is reused as separate
unchanged controls rather than duplicated in the updater matrix.

Coverage:

- All eleven original wrapper import paths, exact two-argument type tuples,
  numeric returns, pending application, repeat behaviour and already-applied
  calls without obsolete SQL or new storage-shape validation.
- Empty and synthetic prior versions 3, 14, 23, 34, 36 and 42 reach 43 in one
  call, preserve projected user fields and remain stable on repeats. The
  existing degraded-legacy case remains unchanged.
- Pending v15 at version 14 rejects either missing required benchmark table;
  partial additive columns on both tables retain values and fill remaining
  columns. Missing/broken pending SQL cannot complete its step.
- NULL-only API-style repair and empty-only Hindsight/Hermes seeds preserve
  explicit user choices and repeat stability.
- Each 035/037 rebuild preserves exact rows and column metadata, status CHECKs,
  indexes, foreign keys and cascades. Actual SQLite tracing rejects missing or
  extra target columns before any DROP. A real SQL failure after destructive
  work rolls back that rebuild and restores incoming FK OFF or ON. No
  whole-run transaction assertion was added; T-0189 owns that scope.
- Existing mandatory Auth43 actual-storage validation remains effective at
  recorded versions 42 and 43; valid storage preserves auth rows.

## Accepted targeted validation

The complete run executes ten suites using Jest --runInBand --runTestsByPath,
with structured JSON and logs under ignored `tmp/t0188-oracle/`.
`jest-accepted-oracle-exit.json` records the exact command and exit code 1.
Observed result: 105 cases, 84 pass, 21 semantic failures, no runtime failures
and no skips. Type checking exits 0 for the complete test configuration.
ESLint exits 0 at zero warnings for the six files; the final wrapper signature
change also passes the complete type check and focused ESLint.

| Intentional red family | Failed cases |
| --- | --- |
| Eleven-wrapper pending missing-SQL controls | 9 |
| Fresh one-call convergence in new behaviour oracle | 1 |
| Missing required benchmark tables at pending v15 | 2 |
| Shared driver pending missing SQL | 1 |
| FK OFF restoration on 035/037 success and late failure | 4 |
| Authorised plan approval and ownership expectations | 2 |
| Authorised frozen fresh-first-pass expectation | 1 |
| Authorised SQL_MIGRATIONS length 29 | 1 |
| Total semantic reds | 21 |

The 21 failures are assertions against pending behaviour, not evidence of
completion. All eleven wrapper applicable-return controls and already-applied
controls pass. Supported-prior fixture construction and upgrades pass.
The remaining behaviour controls pass, including damaged-shape refusal before
drops, real rollback with FK ON, style/seed preservation and Auth43 validation.

## Infrastructure and harness receipts

Preserve all original receipts. `jest-first.json` has 81 pass and 24 failures:
21 semantic reds, two synthetic harness failures and one infrastructure failure.
The existing T-0161 baseline-backup subprocess failed before its assertion:
Node os.userInfo returned ENOMEM from uv_os_get_passwd in the default Windows
sandbox. The unchanged suite passes with the same pinned runtime under the
authorised escalated owned boundary. No test or configuration was altered to
hide that denial.

The initial synthetic updater controls assumed legacy-before-schema command
order, which was not an accepted requirement. Removing only that unsupported
ordering assumption exposed an additional harness demand for complete updater
success after the inspected migration boundaries. Neither issue establishes a
product defect or expands implementation scope. Both are corrected in the new
oracle by inspecting both entries without imposing their mutual order and
stopping deliberately after the owned boundary. `jest-final.json` preserves the
intermediate escalated result. `jest-freeze.json` preserves the corrected-boundary
run. Initial TypeScript syntax/environment typing errors were corrected before
acceptance; their logs remain separate and never count as semantic reds.

Accepted structured Jest JSON SHA-256:
`eb607bdd1a1a7b8c076fbe01bfc8d120f838af28244a5573e1bdc53c89882317`.
The tested six-file raw identity receipt SHA-256 is
`f3089214bb4c5946c9f6893f34e8c9d2f27647cecd77a42749c2d97810fd0042`.

## Synthetic updater boundary and remaining acceptance

Both public CLI modes, update and rebuild, execute their real copied CLI and
filesystem backup work. Only external child commands are intercepted. Real
SQLite fixtures are closed and quiescent before offline file copies.
At each migration-command entry the backup must already exist, open read-only,
pass SQLite integrity checking and match the pre-upgrade logical schema,
version and user rows. The stub then changes the live sentinel; the backup
must retain its original state. Backup failure prevents migrations/imports;
migration failure preserves the inspected backup and stops later required work.
All six controls pass. Deliberate boundary-stop failures are expected test
controls, not a claim that the complete updater succeeds.

These controls are explicitly synthetic. They do not prove installed migration
acceptance, online/WAL-consistent snapshots or a complete updater run. Native
Linux and Windows installed-entrypoint acceptance, with genuine dependencies,
quiescent prior data and exact backup bytes, remains additional evidence.
The operator separately reports four Windows installed-entrypoint invocations
passing on two private fixtures; this ORACLE did not execute or inspect those
private controls. Full updater acceptance remains separate.

## Suggested mutation fault classes and hand-off

Suggested faults: remove/change a wrapper export/signature/return; skip or
reorder a migration; return after fresh baseline; swallow pending missing SQL
or missing-table errors; mark a failed step complete; skip remaining additive
columns; overwrite explicit styles; seed populated tables or duplicate defaults;
move rebuild shape checks after DROP; omit a rebuild transaction or copy field;
force FK ON; bypass Auth43 validation at head; start migration before backup;
continue after backup/migration failure; weaken any prerequisite obligation.
No mutation sweep or implementation was performed by this lane.

After the eight-file identity and per-checkout stamps are recorded in
`tmp/t0188-oracle/freeze-manifest.json`, the ORACLE ceases writing. The coordinator
owns the red commit, plan/ownership changes, implementation and subsequent
candidate validation. No task closure, release or T-0200 retirement is implied.


## 2026-10-01: authorised non-NULL composer witness amendment, before authorship

Independent R2 REVIEWER Schrodinger authorised this bounded amendment at 2026-10-01T19:41:24.232Z; Newton authors it in the independent ORACLE lane. Only migration-t0188-behaviour.test.ts and append-only entries in the two existing oracle review ledgers are owned. The change adds valid non-NULL composer run/node error values and a v35 parent_node_run_id link alongside the retained NULL rows. All 105 selected names and all existing assertions remain. Temporary copies of committed historical SQL in owned test data will prove the exact-row oracle detects each wipe-to-NULL copy fault. No DB implementation or primary source diff is read. The original freeze and receipts remain immutable. Validation uses the detached setup checkout at 3355cd02e9e09b2ef642a47a057aeb2d4997d6f6; no installation or operator data is involved.

Old raw/LF SHA-256 of the behaviour test: 521ccea46246d5c9279b96a5353135087cbde0ab6553ce37577be2d094e88a91. Separate amendment receipts: tmp/t0188-oracle-amendment-nonnull/. Final new hashes and prefix proofs will be recorded there after validation.


## 2026-10-01: non-NULL composer witness amendment validated and frozen

Author: Newton, session 01a0f80a-5091-7ac3-9d66-89e159495160. Authoriser: independent R2 REVIEWER Schrodinger, session 01a0f7b7-f68a-79b2-ba74-81cdddf2f3ef; recorded authority 2026-10-01T19:41:24.232Z. Completed 2026-10-01T19:52:32.594552+00:00.

The fixture retains r/nr with NULL error values and a NULL parent link. It adds r-witness with Owned run error and parent_node_run_id=nr, plus nr-witness with Owned node error under r. The parent target exists. The existing exact-row, schema, constraint, index, cascade, rollback and incoming-FK assertions remain unchanged. Every original test line is retained in order. No selected name is added, removed or renamed.

Temporary copies of historical 035/037 SQL replace one SELECT copy expression with NULL. The SQL remains valid; the rebuild completes, both the witness and retained NULL row have NULL in that field, and the existing exact-row comparison rejects the wiped witness. Four fault classes were tested under incoming FK=0 and FK=1, eight successful detection controls: 035 composer_runs.error; 035 composer_runs.parent_node_run_id; 035 composer_node_runs.error; 037 composer_node_runs.error. Shipped SQL and DB implementation remain untouched by this lane.

On the original detached setup checkout, all 105 selected identities and statuses match the original run: 84 pass, 21 intentional semantic failures, zero runtime/infrastructure failures, zero skips. The 21 failure matcher fingerprints also match. Type checking and focused lint exit 0. No oracle adjustment was made for the independently fixed cross-realm duplicate-column classification issue. These synthetic real-SQL controls do not establish installed-upgrade or full-updater acceptance.

Behaviour test old raw/LF SHA-256: 521ccea46246d5c9279b96a5353135087cbde0ab6553ce37577be2d094e88a91. New raw/LF SHA-256: 1653aa5dde884b431fcf175e2d646c3b990d6ed4c83934c2f766ae981440ae6f. Both ledgers retain their entire incoming bytes as prefixes. Their old/new raw/LF hashes, prefix lengths, identical primary/validation overlays, before/after stamps, immutable original receipt proof and 105 identities are bound in tmp/t0188-oracle-amendment-nonnull/freeze-manifest.json. The original cf8803e4 freeze and all 141 original receipt files remain unchanged. No commits or installations were performed. Authorship ceases after this separate amendment freeze.
