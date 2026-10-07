# T-0176 independent closed-oracle amendment brief

Author: a session other than the T-0175 oracle author, the T-0176 oracle author and the T-0176 implementer. Own only `tests/unit/t0175-dependency-proposals.test.ts`. Read `org/START.md`, `org/roles/ORACLE.md`, `org/tasks/T-0175.json` and `org/tasks/T-0176.json`.

The T-0176 visual dependency update changed only three intended direct ranges. The T-0175 oracle's `preserves every other direct dependency range` case now fails because it embeds the old xyflow and lucide ranges; its development-range case also embeds old Tailwind PostCSS. Make the smallest exact-value update to those expectations so the suite holds the new approved ranges. Keep all seven T-0175 test names, all assertions, all coverage and every other expected dependency unchanged. Do not skip or weaken a case, and do not edit T-0176's independent oracle.

Run the focused suite before and after, and prove that the full set of seven test names is identical. Report the initial red assertion, the final count, the exact changed lines and file hash. Do not commit; the coordinator will freeze the amendment before the dependency implementation commit.
