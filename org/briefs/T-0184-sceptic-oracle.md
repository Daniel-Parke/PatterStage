---
summary: Independent supplemental oracle for T-0184 category visibility
type: brief
tags: [missions, oracle, review]
---

# T-0184 supplemental oracle brief

The independent sceptic reproduced three category behaviours outside the
first frozen oracle. The original tests remain frozen. Author a separate
red-first behavioural suite in only
`tests/unit/mission-category-visibility.test.ts`. Use isolated SQLite and a
temporary template directory; do not change source, other tests, task records,
baselines or protected files.

1. Deleting an unused category succeeds when an unrelated malformed `.json`
   file or directory ending in `.json` exists. Its bytes remain unchanged.
   Do not require symlink creation on Windows.
2. Deleting a category with explicit reassignment to `null` makes affected
   custom templates read back with `categoryId: null`, matching the UI's
   “Uncategorized” choice, and leaves no deleted category ID on disk. A
   missing category field on an unrelated legacy template retains its
   existing General fallback.
3. Warm the template list cache, move a category, and read again without a
   sleep. The returned category must reflect the successful move, both for
   custom disk templates and catalog rows. Assert the cache actually held the
   before response, so the test cannot pass without exercising invalidation.
4. A subsequent custom-template update or a new custom-template create with
   an explicit `categoryId: null` must preserve the UI's Uncategorized choice
   through the write and read. A missing category ID retains its existing
   General fallback.

Run the new cases against the unchanged T-0184 implementation and report
test names, real assertion failures, and the SHA-256 hash. The expected red
result is a prerequisite to the coordinator's repair. Do not edit this suite
after it is frozen; amendments require another author.
