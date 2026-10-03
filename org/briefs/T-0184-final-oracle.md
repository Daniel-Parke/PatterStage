---
summary: Independent T-0184 oracle for failed reads and Uncategorized grouping
type: brief
tags: [missions, oracle, review]
---

# T-0184 final boundary oracle

The second independent sceptic pass confirmed the six supplemental
visibility cases, then found two more failures. Author a separate red-first
behavioural suite in only `tests/unit/mission-category-final-boundary.test.ts`.
Do not edit source, existing tests, task records, baselines or protected files.

1. In isolated SQLite and a temporary templates directory, inject a genuine
   `readFileSync` I/O error for a custom template whose category is the source.
   `deleteCategory(source, target)` must report failure and retain the source
   category, database references and original template bytes. Distinguish
   this from a readable but malformed unrelated JSON file, which the previous
   oracle permits skipping.
2. `groupTemplatesByCategory` must put a template with explicit
   `categoryId: null` and stale legacy `category: "Source"` in the
   Uncategorized group (`categoryId: null`). An absent `categoryId` retains
   the established legacy category fallback.

Run the focused suite against unchanged source. Report each test name,
assertion-level red result and SHA-256 hash. No test amendment by the source
implementer. The coordinator will freeze the suite in a separate commit.
