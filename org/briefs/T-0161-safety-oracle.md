# T-0161 independent safety ORACLE brief

Role: ORACLE. Set `EOS_SESSION_ID=T-0161-safety-oracle`. In a forked checkout,
own only these three paths:

- `tests/unit/t0161-hermes-import.test.ts`
- `tests/unit/t0161-backup-order.test.ts`
- `tests/unit/b15-docs-pipeline-is-wired.test.ts`

Do not edit implementation. The build-purity oracle is already frozen in
`089cc00d`. Add acceptance for the other two T-0161 invariants before
implementation:

1. Create a disposable migrated SQLite database and fictional Hermes
   `config.yaml` and `.env` under temporary directories. Invoke the explicit
   Hermes registry import CLI with `PS_DATA_DIR` and `HERMES_HOME`, no database
   path argument. Assert the model, default and credential exist in that
   database; never print the fictional credential. Assert a malformed import
   exits non-zero rather than claiming success. Run only in the forked checkout.
2. Source `scripts/lib/ps-migrate.sh` in Git Bash with stubbed logging and a
   `ps_backup_db` that fails. Provide a disposable existing database and a
   fake npm executable that marks invocation. Assert `ps_migrate_run` exits
   non-zero and no schema migration is invoked. No operator database is read.

Amend the closed B15 docs-pipeline oracle under Q-015, independently of the
implementer, to require the future `prebuild` lifecycle to run help generation
without invoking a database script. Keep its test-name set and assertion count;
report both before and after. Do not weaken another B15 assertion.

Run the focused suites against the current tree. A genuine failing assertion
is red evidence; a launch or setup error is not. Commit the test changes red
as one oracle commit and report each case, exact failure, hashes and checkout
path. The coordinator owns all implementation, fixtures outside these test
files, and full-gate integration.
