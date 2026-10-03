# T-0202 independent R2 review

Read `org/tasks/T-0202.json`, `org/TESTING.md` and the EXECUTOR/REVIEWER
charters within the applicable boot budget. Inspect the HTTP-smoke diff against
red-oracle commit `10881bca`. Write nothing. Run only isolated behavioural
checks; do not stop unowned processes or disclose fixture credentials.

The frozen suite/helper hashes are on the record. Check exact statuses,
dotenv/file credential selection, spaced workspace paths, wrong credentials,
pre-existing listener rejection, request and cleanup deadlines, exception
reporting and owned PID handling. The harness is Linux-only inside Docker;
the independent probe also runs Windows Git Bash. Distinguish reproduced
failures from concerns. Do not call infrastructure errors mutation kills.

Confirm the existing scenario identities and application source are unchanged.
The legacy-database fixture and whole-harness signal/removal behaviour are
separate unresolved defects. Report any adjacent defect that makes the scoped
repair invalid, with a re-runnable counterexample. Do not manufacture a pass
because focused tests are green. The full gate and release matrix are the
coordinator's separate obligations.
