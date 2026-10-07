# Proposed T0194/T0207 joint landing

Status: approved by Daniel Parke through the interactive answer on 2026-10-04. This is a process exception, not implementation or batch acceptance.

T0194's independent oracle commits are on the current local dev history while
its library implementation is still uncommitted. The additional DNS oracle was
created and executed on the same tree, then relocated as a prototype. Restore
its exact bytes to tests/unit before any full gate. The observed nine red DNS
controls must remain acceptance checks; do not exclude them to land T0194.

The source-bound DNS defect now has accepted ADR0020 authority and its own R3
record, T0207. Its repair should precede the next full acceptance run. T0194's
library regression controls currently pass 23/23 and its queue controls 59/59;
older fixture repairs and further independent review remain pending.

Proposed exception: land T0194 and T0207 in one implementation commit naming
both task IDs, after their independent red oracles, a single complete unchanged
tree gate and independent R3 review. Run the clean committed mutation sweep
against both tasks' controls, requiring causal failures and exact restoration.
Close both records separately with the same tree-bound gate and hosted evidence.
Retain explicit disjoint source inventories for either repair's rollback.

This changes the programme's one-implementation-commit-per-batch discipline.
It does not waive, weaken, reduce or exclude any check, permit self-approval,
change a target, or declare T0206's timing cause or the programme complete.
Push only dev. Merging and releasing remain operator actions.

Alternative: keep separate implementation commits and rebuild the unpublished
stack in an isolated checkout so each committed tree independently passes its
checks. Preserve the existing stack and receipts; do not silently rewrite their
source revision bindings. This costs additional validation and history work.
