# T-0205: canonical identity for an owned worker-oracle project

Authorisation: independent R2 REVIEWER Schrodinger
01a0f7b7-f68a-79b2-ba74-81cdddf2f3ef, 2026-10-02, Q-015.
The complete inventory-correction gate has ended with all ten stages passing.

A separate ORACLE author owns only tests/unit/release-jest-worker-budget.test.ts
and org/reviews/2026-10-t0205-worker-root-amendment.md. Private calibration files
and receipts belong under a new uniquely named tmp/t0205-worker-root-* directory.
Do not inspect or edit product implementation, CI, task records or shared fixtures.

Both native Mac runs at a92487c4 refused the worker oracle before assertions
with the combined configuration/inventory predicate. Installed Jest 30.3.0
canonicalises rootDir through tryRealpath and realpathSync.native. The current
oracle derives project from an uncanonicalised temporary root. The exact native
failure predicate remains unconfirmed because its individual values were not
retained; do not claim that /var versus /private/var was proven historically.

Permitted amendment: canonicalise the freshly created owned root before deriving
project. Preserve strict root equality, all other qualification predicates, the
nine test names, assertions, CLI override, invalid-configuration classification,
timeouts and coverage floors. No new exception for a different directory.

Before amendment, prove actual symlink/junction alias refusal with real Jest
configuration resolution. After amendment, prove the same-directory alias passes
and a genuinely different-directory configuration is still rejected despite
normal successful CLI output. Preserve the original oracle copy and all receipts.
Use owned directories only, safe Windows junction handling and pinned Node24.
Also run all nine unchanged identities normally; preserve failed infrastructure
controls as refusals, not mutation kills. Record precise hashes, source revision,
commands, identity comparison, limitations and a freeze manifest, then stop writing.
Native Mac full-run acceptance remains mandatory. No push or closure is authorised.
