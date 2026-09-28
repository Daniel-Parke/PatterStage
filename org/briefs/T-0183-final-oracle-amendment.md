# T-0183 independent closed-oracle amendment

Author owns only `tests/unit/mission-dispatch-race.test.ts` and `tests/unit/mission-schedule-claim-contention.test.ts`. Do not edit source, other tests, records or protected files. Preserve every test name and the behavioural assertions.

The fresh-worker case reloads modules while the first worker still owns an unresolved submission. It currently expects the operator-review marker without invoking boot recovery. Change its restarted-worker setup to invoke the real `reconcileRunsOnBoot()` before checking the marker. Keep the same run ID and no-replay assertions.

The new cron contention case correctly expects the duplicate occurrence to remain due while the gateway promise is pending. `lastStatus` is nullable before a first firing; make the negative matcher accept null without reducing its assertion against the misleading duplicate/finished label.

Run focused Jest, TypeScript test typecheck, file lint and report the before/after test-name sets and exact results. Do not commit. The coordinator will independently verify and freeze the amendment.
