---
summary: Independent T-0185 oracle consolidation under the fixed C4 census
type: brief
tags: [missions, oracle, testing]
---

# T-0185 census amendment

Full Jest exposed C4's unchanged 4,800 repeated-test-window ceiling: the
current tree counts 4,908. The four new mission model and old-link suites
repeat mock setup. Extract shared test fixtures into
`tests/helpers/mission-model-boundary.ts` and
`tests/helpers/mission-old-link-boundary.tsx`, and
amend only these frozen suites:

- `tests/unit/mission-model-input-boundary.test.ts`
- `tests/unit/mission-model-null-boundary.test.ts`
- `tests/unit/mission-old-link-retention.test.tsx`
- `tests/unit/mission-old-link-overlap.test.tsx`

This assignment begins only after an independent R2 REVIEWER authorises the
amendment. The author must be different from the implementer and original
authors. Preserve every test name and behavioural assertion. Keep C4's
4,800 ceiling, its algorithm, coverage floors and all source code unchanged.
Do not replace behavioural checks with source-text checks, skips or timing
assumptions. The helper must not reference operator data.

Measure `node scripts/tooling/line-census.mjs --report` before and after.
The target is at most 4,800 repeated test-window lines without an allow-growth
entry. Run the four focused suites, C4, test typecheck and ESLint. Report the
old/new SHA-256 values, exact name sets and census count. Commit nothing.
The coordinator will record the append-only amendment and rerun the gate.
