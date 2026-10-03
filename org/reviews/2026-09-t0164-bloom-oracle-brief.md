---
summary: Independent closed-oracle amendment brief for the Composer bloom fix
type: review
tags: [review, oracle, phase-1]
status: complete
---

# T-0164 independent bloom-oracle amendment

The unchanged-tree full gate at `81d42250` passed lint and TypeScript, then
Jest failed one of 7,326 tests in `tests/unit/bloom-paint-rule.test.ts`.
The old source-text assertion requires every `[data-bloom]` to become
`position: relative`. The T-0164 Composer fix deliberately excludes
`.absolute` targets, because forcing relative hides the Composer palette and
inspector. The existing Playwright regression is green for the actual screen.

Hilbert owns only `tests/unit/bloom-paint-rule.test.ts` as the independent
amendment author under Q-015. Read the current CSS and the old oracle. Keep
the **same test-name set and count** before and after; do not skip, delete,
rename or weaken a check. Replace the stale selector assertion with a precise
invariant that still requires a positioning context for ordinary bloom
containers while preserving an already absolutely positioned container.
Keep the reduced-motion and pointer-event assertions intact. Run the focused
suite and targeted lint/TypeScript, and provide before/after name sets and
exits. Do not edit CSS, policy, other tests, records or generated views.

The coordinator will run the full Jest corpus and all ten gate steps on the
finished commit. This brief is evidence for a narrow independently authored
oracle correction, not authority to change product behaviour.

Hilbert changed only the claimed test file. Its nine test names are identical
before and after. Focused Jest was red before the amendment (one failure,
eight passes) and green after it (nine passes); targeted ESLint, TypeScript
and `git diff --check` exited zero. The coordinator repeated the bloom and
recon suites together (12 passes). The amended assertion excludes `.absolute`
from the relative-position selector, while preserving the existing motion and
pointer-event checks.
