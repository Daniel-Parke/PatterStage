---
summary: Independent behaviour tests for two surviving T-0185 mutants
type: brief
tags: [missions, oracle, mutation]
---

# T-0185 mutation follow-up

The clean-tree sweep at `178551c2` killed four of six mutants and restored
the tree. Two survived because the current tests did not observe their effects.
Own only the files named in the lane claim. Commit nothing. The first draft
made C4's fixed repeated-test-window count 4,862 against 4,800. A third
claimed file, `tests/helpers/mission-async-deferred.ts`, may hold the genuine
deferred-promise fixture. Factor the scenario setup within the new suite so
the final count is at most 4,800. Do not hide repetition by formatting or
change the census rule or baseline.

1. `tests/unit/mission-prompt-instruction-literal.test.ts`: build and parse a
   stored prompt whose **real instruction itself** contains a literal
   `<task><![CDATA[decoy]]></task>` sequence. The parsed instruction must
   round-trip exactly, including that literal. Include a normal instruction
   control. This distinguishes the `insideCdata` skip from selecting the
   final candidate.
2. `tests/unit/mission-old-link-restoration-boundary.test.tsx`: load an old
   mission by its published deep link, start overlapping by-ID refreshes,
   let the later lookup return 404, then resolve the earlier success. Start
   another board refresh. The stale success must not restore the old retained
   reference or cause a new by-ID fetch/reappearance. Use the counted
   `tests/helpers/mission-old-link-boundary.tsx` fixture, controlled deferred
   promises and a same-order success control. Do not weaken the existing
   overlap test or use source-text assertions.

Read `org/START.md`, `org/tasks/T-0185.json`, and `org/roles/ORACLE.md`.
Run focused Jest on the committed unmutated source, test typecheck and ESLint.
Report exact test names, pass/fail counts and SHA-256 values. The coordinator
will commit these follow-up tests separately, rerun the sweep and preserve
the fixed C4 census ceiling.
