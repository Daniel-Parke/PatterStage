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


## 2026-10-01: authorised Auth43 public-chain witness amendment, before authorship

Independent R2 REVIEWER Schrodinger authorises the renewed Newton ORACLE lane at 2026-10-01T22:55:44.419Z under Q-015, as recorded in org/briefs/T-0188-auth-wiring-amendment.md. Only the behaviour oracle and append-only provenance in these two ledgers are amended. Both malformed Auth42/43 identities, every direct-worker assertion, all prior test lines and all 105 selected names remain. Separate otherwise valid fixtures use independently replayed historical SQL, damage Auth storage only, and require actual runMigrations to reject malformed Auth storage without changing version/schema/rows. Valid headed controls exclude unrelated missing-table failure.

The existing 13-mutant receipt remains qualified: m12 was killed by fresh/upgraded failures and did not prove recorded43 validation. Calibration will instantiate that unchanged existing definition only in a uniquely owned copy, with exact restoration and no inspection of DB implementation or primary source diffs. The previously accepted paired copy is read-only. No source fix, mutant-definition/manifest change, protected edit, installation, operator data access or acceptance is implied. Original receipts remain immutable.

Incoming behaviour LF SHA-256: 1653aa5dde884b431fcf175e2d646c3b990d6ed4c83934c2f766ae981440ae6f. Incoming ledger LF SHA-256 values: 2e80a5efbbce51170ff544132788ec08800df69384ad9d6dfca2762261d66056 and a0c832732f3a6349ff0c5a99569a7b7dfe9395bdd04340f2724e89d60b3b19ed. Old raw bytes/hashes and dated authority are saved in tmp/t0188-auth-wiring-amendment/before.json; final hashes and identity proof will be frozen separately there.


## 2026-10-02: Auth43 public-chain wiring witnesses validated and frozen

Newton, independent ORACLE session 01a0f80a-5091-7ac3-9d66-89e159495160, authors this additive amendment under independent R2 REVIEWER Schrodinger authority 2026-10-01T22:55:44.419Z. Completed 2026-10-01T23:10:34.810103+00:00. Only the behaviour test and append-only entries in the two authorised ledgers change. The original 401 test lines, direct-worker assertions and all 105 selected identities remain exactly preserved. No migration implementation or primary source diff was inspected.

Within each existing malformed recorded42/43 identity, a separately replayed historical-SQL fixture reaches the otherwise valid headed schema, contains cron_jobs and an unrelated mission sentinel, and is recorded at42/43. Its valid Auth storage control runs the actual public runMigrations, preserves the real Auth sentinel, reaches43 and repeats stably. The damaged fixture is independently replayed again, never manufactured from the control or a new implementation run. Only auth_sessions is replaced with malformed storage. The actual public chain must throw an Auth-specific error and leave the recorded version and full schema/row snapshot unchanged. The original minimal direct-worker checks remain unchanged.

The uniquely owned tmp/t0188-auth-wiring-newton-candidate checkout uses candidate b262fcb7213da1ad27e7075fb20a17d0f98ed18f, Node24.21.0/ABI137 and the pinned real native pool junction. The previously accepted tmp/t0188-paired-final tracked tree and HEAD remain unchanged. No build, installation, operator environment/data, new source fix, authored mutation, mutation manifest edit, protected edit or commit was performed. Existing m12 was instantiated solely by the unchanged mutation engine in the owned copy. The authorised test overlay was present during test execution and restored around clean-baseline engine controls; the exact original source bytes and final authored overlays were restored. This is controlled-overlay calibration, not a newly committed clean-tree sweep or final acceptance.

Normal native validation:105pass/0fail/0skip/0runtime. Type checking and focused lint exit0. The first103pass/2failure receipt is retained and classified as Git safe-directory infrastructure, not product assertions; process-local GIT_CONFIG_COUNT=1, GIT_CONFIG_KEY_0=safe.directory, GIT_CONFIG_VALUE_0 equal to the exact owned candidate path solved it without global policy or oracle changes. A receipt-verifier first attempt also incorrectly required optional matcherResult.name; its correction uses the canonical matcher invocation, with no test/source change or rerun.

Existing m12-head-auth-storage-unvalidated calibration:22pass/9semantic failures/0infrastructure/0skip. Both unmutated31-case controls pass. In the recorded43 malformed identity, the three direct-worker assertions and all five valid headed-control assertions pass before the intended new matcher fails: expect(received).toThrow(expected), expected Auth-specific pattern /auth(?:[_ ]sessions?|43)/i, received function did not throw. The recorded42 identity fails its valid-control43 convergence assertion, received42. The former13-mutant receipt retains its fresh/upgraded-only qualification; it is not rewritten or promoted to final acceptance.

Old behaviour LF SHA-256: 1653aa5dde884b431fcf175e2d646c3b990d6ed4c83934c2f766ae981440ae6f. New behaviour LF SHA-256: 95e29d4dba1f7902c3f8bc6f656a4f3d266f4da026b980436e7af6a0f07112ee. Incoming ledger LF hashes remain 2e80a5efbbce51170ff544132788ec08800df69384ad9d6dfca2762261d66056 and a0c832732f3a6349ff0c5a99569a7b7dfe9395bdd04340f2724e89d60b3b19ed as byte-preserved prefixes. Final old/new raw/LF hashes, prefix lengths, before/after stamps, exact105-name proof, normal/m12 structured receipts and prior receipt preservation are bound by tmp/t0188-auth-wiring-amendment/freeze-manifest.json. Coordinator commits the amendment, repeats the full unchanged-tree gate and clean committed sweep, and obtains separate acceptance. Authorship ceases after this freeze.
