# T-0188 independent oracle brief, 1 October 2026

Newton adopts ORACLE. Read the task record and assigned claims; do not inspect
the migration implementation. Authoring starts only after every required
hosted job at T-0203 closure `9c824422` passes and the coordinator assigns the
disjoint writing lane. At most two writers may run. Use real SQLite with owned
temporary data and the isolated, checksum-verified Node 24.21.0 runtime.

Author `migration-t0188-wrappers.test.ts` and
`migration-t0188-behaviour.test.ts`. Keep synthetic fixture builders local.
An optional `migration-t0188-update-backup-order.test.ts` may exercise the
documented updater without reading database implementation. Do not edit the
baseline helper. Historical SQL is permitted as an independent fixture source;
do not derive expected state through the replacement implementation.

Cover all eleven wrappers' supplied public paths, signatures and return values;
fresh/supported prior one-call convergence to 43 with user rows and repeat
stability; damaged pending v15 at version 14 without required benchmark tables;
partial additive state; pending missing SQL; user-set and NULL model styles;
empty-only seeds; 035/037 exact lossless shape, per-rebuild atomic rollback and
incoming FK ON/OFF restoration on success and failure; mandatory Auth43 shape
validation even when the recorded version is already 43. Do not require a
whole-chain transaction: T-0189 owns broader transaction work. Ordinary
already-applied wrappers need not inspect old SQL or revalidate old shape.

Schrodinger independently authorised these exact Q-015 amendments:

1. In `t0165-plan-contract.test.ts`, preserve all three names, the complete
   measurement test and unrelated assertions. Replace only obsolete approval
   and sequence requirements. Require approval `operator-approved-2026-09-28`,
   Q-032, T-0188's exact dependency on T-0187 and
   `release-verification-repairs-complete`, and T-0199's exact dependency on
   T-0198. Both use Q-032 before-release authority. The external contract must
   assert all T-0202 independent closure/local gate/committed clean sweep/15
   HTTP matrix obligations AND all T-0203 independent closure/current full
   gate/committed clean sweep/every exact-head push and PR job/native macOS all
   21 HTTP obligations. Declare requirements, not execution evidence.
   Preserve T-0200 R3, operator-v1-release dependency, through-1.0 promise and
   first post-1.0 retirement; T-0201 depends exactly on T-0200. Prove the whole
   T-0200 row unchanged at amendment time, without permanently freezing its
   movable file claims. Keep the alias-reader inventory assertion.
2. In that test's ownership case add only three owning-task expectations:
   lib-data-01, lib-data-02 and the existing lib-data-01 split disposition map
   to T-0188. Preserve all 265 findings, 163 split dispositions, 285 atoms and
   every other owner, reason and outcome.
3. In `run-migrations-upgrade.integration.test.ts`, change only the fresh first
   pass expectation from 3 to MIGRATION_HEAD_SCHEMA_VERSION (43), and Composer
   workflows from absent to present. Preserve every name, degraded test,
   eight-pass loop, later schema/table assertions and cleanup.
4. In `u15-one-driver-for-sql-migrations.test.ts`, change only SQL_MIGRATIONS
   length 18 to 29, plus a dated clarification. Keep its historical title and
   every order/uniqueness/real-file/prefix/worker/version assertion.

Write dated provenance to `org/reviews/2026-10-t0188-oracle-amendment.md`
before changing those frozen files. Record old/new LF hashes, exact names and
bounded diff proof. No protected or historical task record edits.

Run complete targeted suites and save structured Jest JSON plus logs under
ignored `tmp/t0188-oracle/`. Report genuine assertion failures separately from
launch/configuration/runtime failures. Freeze hashes and return identity proof;
then cease writing before coordinator red commit and implementation. An updater
boundary that cannot prove ordering is explicitly unresolved, not a synthetic
substitute for Linux/Windows installed acceptance.
